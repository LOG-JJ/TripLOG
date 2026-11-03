(() => {
  'use strict';
  const { text, icon, money } = window.TripLog.ui.markup;
  function shortDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '날짜 미지정';
    const parsed = new Date(`${date}T12:00:00`);
    return `${parsed.getMonth() + 1}. ${parsed.getDate()}. (${'일월화수목금토'[parsed.getDay()]})`;
  }
  function table({ body = '', bodyId = '', caption = '지출 기록', manageHeader = '', className = '' } = {}) {
    return `<table class="ex-table ${text(className)}"><caption class="ex-sr-only">${text(caption)}</caption><thead><tr><th scope="col">날짜</th><th scope="col">내용</th><th scope="col">카테고리</th><th scope="col">결제 수단</th><th scope="col">금액</th><th scope="col">${manageHeader ? text(manageHeader) : '<span class="ex-sr-only">관리</span>'}</th></tr></thead><tbody${bodyId ? ` id="${text(bodyId)}"` : ''}>${body}</tbody></table>`;
  }
  function row(entry, { actions = '', extra = '', amountExtra = '', attributes = '', action = 'expense-edit', settlement = false, readOnly = false } = {}) {
    const catalog = window.TripLog.data.expenseCategories;
    const category = catalog.get(catalog.ledgerOrder.includes(entry.category) ? entry.category : '기타', 'ledger');
    const date = window.TripLog.shared.travelCosts.paymentDate(entry), payment = getPaymentMethodLabel(entry.paymentMethod);
    const dayIndex = getTripDays().findIndex(day => day.date === entry.date);
    const pretrip = isPreTripExpenseDate(entry.date), period = pretrip ? '사전구매' : dayIndex >= 0 ? `Day ${dayIndex + 1}` : shortDate(entry.date);
    const event = readOnly ? '' : `${settlement ? 'data-settle-action' : 'data-rd-action'}="${text(action)}" data-id="${text(entry.id)}"`;
    const chips = `<span class="ex-row-mobile-meta"><span class="ex-meta-chip" title="여행 일정">${icon(pretrip ? 'airplane-tilt' : 'calendar-blank')}${text(period)}</span><span class="ex-meta-chip">${icon(entry.paymentMethod === 'cash' ? 'money' : 'credit-card')}${text(payment || '미지정')}</span></span>`;
    const note = `<small class="ex-note${entry.note ? '' : ' is-empty'}" title="${text(entry.note || period)}"><span class="ex-desktop-period">${text(period)}</span>${entry.note ? `${icon('note-blank')}<span>${text(entry.note)}</span>` : ''}</small>${extra}`;
    const foreign = entry.currency && entry.currency !== 'KRW' && Number(entry.foreignAmount) > 0 ? `${text(entry.currency)} ${Number(entry.foreignAmount).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : '';
    const title = readOnly ? `<span class="ex-entry-title">${text(entry.description)}</span>` : `<button type="button" class="ex-entry-title" ${event} aria-label="${text(entry.description)} ${settlement ? '분담 수정' : '수정'}">${text(entry.description)}</button>`;
    return `<tr ${event} ${attributes}><td class="ex-row-date"><time datetime="${text(date)}" title="결제일">${text(shortDate(date))}</time>${chips}</td><td class="ex-row-copy">${title}${note}</td><td class="ex-row-category"><span style="--ex-category:${category.color}" title="${text(category.name)}">${icon(category.icon)}<span>${text(category.name)}</span></span></td><td class="ex-row-payment">${payment ? `${icon(entry.paymentMethod === 'cash' ? 'money' : 'credit-card')}<span>${text(payment)}</span>` : '<span>미지정</span>'}</td><td class="ex-row-amount"><strong>${money(entry.amount)}</strong>${foreign ? `<small>${foreign}</small>` : ''}${amountExtra}</td><td class="ex-row-edit"><span class="ex-row-actions">${actions}</span></td></tr>`;
  }
  window.TripLog.register('ui.expenseLedger', { table, row });
})();
