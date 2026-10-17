'use strict';
const text = (key, label, required = false, value = '', extra = {}) => ({ key, label, required, value, type: 'text', ...extra });
const number = (key, label, value = 0, extra = {}) => text(key, label, true, value, { type: 'number', ...extra });
const select = (key, label, options, value) => ({ key, label, type: 'select', value: value ?? options[0][0], options: options.map(([value, label]) => ({ value, label })) });
const yesNo = (key, label, value = false) => select(key, label, [['false', '아니요'], ['true', '예']], String(value));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
function fieldsFor(kind, trip, row = {}) {
  let fields;
  const day = trip?.startDate || today();
  if (kind === 'trip') fields = [text('tripName', '여행 이름', true), text('startDate', '시작일 YYYY-MM-DD', true, day), text('endDate', '종료일 YYYY-MM-DD', true, trip?.endDate || day), text('city', '도시'), text('country', '국가', true, '대한민국'), text('countryCode', '국가 코드', true, 'KR'), select('travelMode', '여행 유형', [['domestic', '국내'], ['overseas', '해외']]), text('currencyCode', '통화 코드', true, 'KRW'), number('exchangeRate', '환율', 1), number('exchangeBase', '환율 기준 단위', 1)];
  else if (kind === 'itinerary') fields = [text('place', '장소 / 일정 이름', true), text('date', '일자 YYYY-MM-DD', true, day), text('time', '시작 HH:MM'), text('endTime', '종료 HH:MM'), text('location', '주소'), text('memo', '메모'), select('trans', '이동 수단', [['none', '미정'], ['walk', '도보'], ['bus', '버스'], ['train', '기차'], ['subway', '지하철'], ['car', '자동차'], ['taxi', '택시'], ['flight', '항공'], ['ferry', '배']]), number('duration', '이동 시간 (분)'), number('cost', '이동 비용 (원)'), yesNo('syncExpense', '이동 비용을 지출에 연결')];
  else if (kind === 'expense') fields = [text('description', '지출 내용', true), text('date', '일자 / 사전구매는 __pretrip__', true, day), text('category', '분류', true, '식비'), number('amount', '원화 금액'), select('paymentMethod', '결제 수단', [['card', '카드'], ['cash', '현금']]), select('payerKey', '결제자', [['leader', '여행 대표'], ...(trip?.companions || []).map(person => [`companion:${person.id}`, person.name])]), text('note', '메모'), select('mode', '금액 유형', [['domestic', '원화'], ['overseas', '외화']]), text('currency', '통화 코드', true, trip?.currencyCode || 'JPY', { when: v => v.mode === 'overseas' }), number('foreignAmount', '외화 금액', 0, { when: v => v.mode === 'overseas' }), number('exchangeRate', '환율', trip?.exchangeRate || 1, { when: v => v.mode === 'overseas' }), number('exchangeBase', '환율 기준 단위', trip?.exchangeBase || 1, { when: v => v.mode === 'overseas' })];
  else if (kind === 'packing') fields = [text('name', '준비물 이름', true), yesNo('checked', '준비 완료')];
  else if (kind === 'companion') fields = [text('name', '동행인 이름', true), number('individualSpent', '별도 개인 지출 (원)')];
  else if (kind === 'reservation') fields = [select('type', '예약 종류', [['stay', '숙소'], ['transport', '교통'], ['activity', '입장권 / 활동'], ['other', '기타']]), text('title', '예약 이름', true), text('date', '예약일 / 체크인', true, day), text('endDate', '체크아웃', true, trip?.endDate || day, { when: v => v.type === 'stay' }), text('time', '출발 / 시작 HH:MM'), text('endTime', '도착 / 종료 HH:MM'), text('arrivalDate', '도착일 (다른 날인 경우)', false, '', { when: v => v.type === 'transport' }), select('transportKind', '교통수단', [['train', '기차'], ['flight', '항공'], ['bus', '버스'], ['car', '자동차'], ['ferry', '배'], ['other', '기타']]), text('from', '출발지'), text('to', '도착지'), text('reference', '예약 번호'), text('location', '주소'), text('note', '메모'), text('url', '예약 링크')];
  else fields = [];
  return fields.map(field => ({ ...field, value: Object.hasOwn(row, field.key) ? row[field.key] : field.value }));
}
function valuesFor(fields) { return Object.fromEntries(fields.map(field => [field.key, String(field.value ?? '')])); }
function collect(fields, values) {
  const data = {};
  for (const field of fields.filter(field => !field.when || field.when(values))) {
    const value = String(values[field.key] ?? '');
    if (field.required && !value.trim()) throw new Error(`${field.label}을(를) 입력해 주세요.`);
    if (field.type === 'select' && !field.options.some(option => String(option.value) === value)) throw new Error(`${field.label}의 선택지 중 하나를 입력해 주세요.`);
    if (field.type === 'number') { if (!value.trim() || !Number.isFinite(Number(value.replaceAll(',', '')))) throw new Error(`${field.label}은(는) 숫자로 입력해 주세요.`); data[field.key] = Number(value.replaceAll(',', '')); }
    else if (field.type === 'select' && field.options.every(option => ['true', 'false'].includes(option.value))) data[field.key] = value === 'true';
    else data[field.key] = value;
  }
  return data;
}
module.exports = { fieldsFor, valuesFor, collect, text, number, select, yesNo, today };
