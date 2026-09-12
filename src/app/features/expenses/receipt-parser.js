// Receipt extraction is deliberately conservative: an unreadable total stays empty.
(function createReceiptParser() {
  const totalLabels = /(?:grand\s*total|total\s*(?:amount|due)?|amount\s*due|balance\s*due|합\s*계|총\s*(?:액|금액|결제)|결제\s*금액|승인\s*금액|청구\s*금액|합산\s*금액|合\s*計|お会計|支払金額)/i;
  const excludedTotals = /(?:sub\s*total|tax\b|tendered|change\b|소\s*계|공급가|부가세|거스름|거슬러|받은\s*(?:돈|금액)|잔액|小計|お預[りか]|お釣り)/i;
  const metadataLine = /(?:\b(?:tel|phone|date|time|vat|invoice|receipt\s*(?:no|#))\b|전화|사업자|등록번호|승인번호|카드번호|거래번호|대표|주소|일시|日時|電話|登録番号)/i;
  const clean = (value) => String(value || '').normalize('NFKC').replace(/[\t\u00a0]/g, ' ').trim();

  function parseReceiptNumber(value) {
    let text = clean(value).replace(/[^\d.,'’\s+-]/g, '').replace(/[\s'’]/g, '');
    if (!text || !/\d/.test(text)) return null;
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? ',' : '.';
      const grouping = decimal === ',' ? /\./g : /,/g;
      text = text.replace(grouping, '').replace(decimal, '.');
    } else if (comma >= 0 || dot >= 0) {
      const separator = comma >= 0 ? ',' : '.';
      const parts = text.split(separator);
      if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) {
        text = parts.join('');
      } else if (parts.length === 2 && parts[1].length <= 2) {
        text = parts.join('.');
      } else return null;
    }
    const number = Number(text);
    return Number.isFinite(number) && Math.abs(number) <= 1e12 ? number : null;
  }

  function amountsInLine(text) {
    return (text.match(/[-+]?\d+(?:[.,'’ ]\d{3})*(?:[.,]\d{1,2})?/g) || [])
      .map(parseReceiptNumber).filter((value) => value !== null);
  }

  function validDate(year, month, day) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (Number(year) < 2000 || Number(year) > 2100 || date.getUTCFullYear() !== Number(year)
      || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseReceiptDate(lines) {
    const dates = new Set();
    let ambiguous = false;
    for (const line of lines) {
      const text = line.text;
      const iso = text.match(/\b(20\d{2})\s*[년年./-]\s*(\d{1,2})\s*[월月./-]\s*(\d{1,2})(?:일|日|\b)/);
      if (iso) {
        const date = validDate(iso[1], iso[2], iso[3]);
        if (date) dates.add(date);
        continue;
      }
      const reverse = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
      if (!reverse) continue;
      const a = Number(reverse[1]);
      const b = Number(reverse[2]);
      if (a <= 12 && b <= 12 && a !== b) { ambiguous = true; continue; }
      const date = validDate(reverse[3], a > 12 ? b : a, a > 12 ? a : b);
      if (date) dates.add(date);
    }
    return { date: dates.size === 1 && !ambiguous ? [...dates][0] : '', ambiguous: ambiguous || dates.size > 1 };
  }

  function detectCurrency(text) {
    const found = new Set();
    const rules = {
      KRW: /\bKRW\b|₩|\d[\d,.\s]*원/i,
      USD: /\bUSD\b|US\s*\$/i,
      JPY: /\bJPY\b|円/i,
      CNY: /\b(?:CNY|RMB)\b|人民币|人民幣|\d[\d,.]*\s*元/i,
      EUR: /\bEUR\b|€/i,
      GBP: /\bGBP\b|£/i,
      TWD: /\bTWD\b|NT\s*\$/i,
      THB: /\bTHB\b|฿/i,
      VND: /\bVND\b|₫/i,
    };
    Object.entries(rules).forEach(([code, rule]) => { if (rule.test(text)) found.add(code); });
    return { currency: found.size === 1 ? [...found][0] : '', ambiguous: found.size > 1 || (!found.size && /[$¥]/.test(text)) };
  }

  function parseReceipt(input) {
    const lines = (Array.isArray(input) ? input : String(input || '').split(/\r?\n/))
      .map((line) => typeof line === 'string' ? { text: clean(line) } : { ...line, text: clean(line.text) })
      .filter((line) => line.text);
    const text = lines.map((line) => line.text).join('\n');
    const warnings = [];
    const candidates = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!totalLabels.test(line.text) || excludedTotals.test(line.text) || metadataLine.test(line.text)) continue;
      const values = amountsInLine(line.text);
      let amount = values.at(-1);
      let amountLine = line;
      // A total label may be on a separate line, but never cross another label.
      if (amount === undefined) {
        const next = lines[index + 1];
        if (next && /^[\s\d.,'’+\-₩¥$€£円원A-Z]+$/.test(next.text)) {
          amount = amountsInLine(next.text).at(-1);
          amountLine = next;
        }
      }
      if (amount === undefined) continue;
      const score = /grand\s*total|결제\s*금액|총\s*결제|승인\s*금액|支払金額/i.test(line.text) ? 2 : 1;
      candidates.push({ amount, score, evidence: line.text, confidence: amountLine.confidence });
    }
    const bestScore = Math.max(0, ...candidates.map((item) => item.score));
    const best = candidates.filter((item) => item.score === bestScore);
    const unique = [...new Set(best.map((item) => item.amount))];
    let amount = unique.length === 1 && unique[0] > 0 ? unique[0] : null;
    if (/\b(?:refund|refunded|return receipt)\b|환불|반품|返品/.test(text.toLowerCase()) || unique.some((value) => value < 0)) {
      amount = null;
      warnings.push('환불·취소 영수증일 수 있습니다. 금액과 기존 지출을 직접 확인해 주세요.');
    } else if (unique.length > 1) warnings.push('서로 다른 결제금액이 보입니다. 실제 결제한 금액을 입력해 주세요.');
    else if (amount === null) warnings.push('최종 결제금액을 찾지 못했습니다. 원본을 보고 입력해 주세요.');
    if (best.some((item) => Number.isFinite(item.confidence) && item.confidence < 65)) {
      warnings.push('금액의 글자가 흐립니다. 숫자를 원본과 비교해 주세요.');
    }
    const dateResult = parseReceiptDate(lines);
    if (!dateResult.date) warnings.push(dateResult.ambiguous ? '날짜 표기가 모호합니다. 결제일을 확인해 주세요.' : '결제일을 찾지 못했습니다. 날짜를 확인해 주세요.');
    const currencyResult = detectCurrency(text);
    if (!currencyResult.currency) warnings.push('통화를 확인해서 선택해 주세요. 통화 기호만으로는 확정하지 않습니다.');

    let merchant = '';
    const named = lines.find((line) => /^(?:상호|가맹점명|매장명|merchant)\s*[:：]/i.test(line.text));
    if (named) merchant = named.text.replace(/^[^:：]+[:：]\s*/, '');
    else {
      merchant = lines.slice(0, 8).find((line) => {
        const value = line.text;
        return /[\p{L}]{2}/u.test(value) && !metadataLine.test(value) && !totalLabels.test(value)
          && !/영수증|거래명세|신용카드|현금영수증|receipt|invoice|領収書|レシート|[$₩¥€£]|\d{2}[./:-]\d{2}|(?:\d[,.]\d{3})/i.test(value)
          && !/^[-=*_\s]+$/.test(value);
      })?.text || '';
    }
    let category = '기타';
    const categoryRules = [
      ['식비', /카페|커피|식당|식사|라멘|김밥|치킨|베이커리|\bcaf[eé]\b|coffee|restaurant|bakery|カフェ|寿司|食堂|ラーメン/i],
      ['교통', /택시|철도|주차|주유|\btaxi\b|parking|railway|タクシー|駐車|乗車/i],
      ['관광', /박물관|입장권|미술관|museum|admission|입장료|入場/i],
      ['쇼핑', /마트|편의점|백화점|쇼핑|market|store|shop|seven.eleven|7.eleven|lawson|ローソン|ファミリーマート/i],
      ['숙소', /호텔|숙박|리조트|hotel|resort|ホテル|旅館/i],
    ];
    category = categoryRules.find(([, rule]) => rule.test(`${merchant}\n${text}`))?.[0] || category;
    const card = /신용|체크카드|카드\s*(?:결제|승인)|\b(?:visa|mastercard|credit|debit|card)\b|クレジット|カード/i.test(text);
    const cash = /현금\s*(?:결제|영수증)|\bcash\b|現金/i.test(text);
    const paymentMethod = card === cash ? '' : card ? 'card' : 'cash';
    if (!paymentMethod) warnings.push('결제 방식을 선택해 주세요.');
    return { merchant: merchant.slice(0, 44), date: dateResult.date, amount,
      currency: currencyResult.currency, category, paymentMethod, warnings, text };
  }

  function findReceiptDuplicate(entries, draft, ignoredId) {
    return (entries || []).find((entry) => {
      if (entry.id === ignoredId) return false;
      if (draft.fingerprint && entry.receipt?.fingerprint === draft.fingerprint) return true;
      const code = entry.mode === 'overseas' ? entry.currency : 'KRW';
      const value = entry.mode === 'overseas' ? entry.foreignAmount : entry.amount;
      return draft.date === entry.date && code === draft.currency
        && clean(draft.merchant).replace(/\s/g, '').toLowerCase() === clean(entry.description).replace(/\s/g, '').toLowerCase()
        && Math.abs(Number(value) - Number(draft.amount)) < 0.005;
    });
  }
  window.TripLog.register('features.expenses.receiptParser', { parseReceipt, parseReceiptNumber, findReceiptDuplicate });
})();
