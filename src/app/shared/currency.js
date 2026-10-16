function isForeignEntry(entry) {
  return entry?.mode === "overseas" && Number(entry.foreignAmount || 0) > 0;
}

function isWonCurrency(currencyOrCode) {
  const code = typeof currencyOrCode === "string" ? currencyOrCode : currencyOrCode?.code;
  return code === "KRW";
}

const EURO_COUNTRY_CODES = new Set([
  "AD", "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MC", "MT", "NL", "PT", "SI", "SK", "SM", "VA",
]);

const COUNTRY_CURRENCY_OVERRIDES = {
  CN: "CNY",
  GB: "GBP",
  HK: "CNY",
  JP: "JPY",
  KR: "KRW",
  MO: "CNY",
  TH: "THB",
  TW: "TWD",
  US: "USD",
  VN: "VND",
};

const FALLBACK_EXCHANGE_RATES_TO_KRW = {
  CNY: 205,
  EUR: 1620,
  GBP: 1900,
  JPY: 950,
  KRW: 1,
  THB: 42,
  TWD: 46,
  USD: 1450,
  VND: 5.7,
};

function getCurrencyMeta(code) {
  return currencies.find((currency) => currency.code === code) || currencies[0];
}

function getCurrencyCodeForCountry(countryCode = "", travelMode = state.travelMode) {
  const normalized = String(countryCode || "").trim().toUpperCase();
  if (travelMode !== "overseas") return "KRW";
  if (EURO_COUNTRY_CODES.has(normalized)) return "EUR";
  return COUNTRY_CURRENCY_OVERRIDES[normalized] || "USD";
}

function getDefaultExchangeRateForCurrency(code = "JPY") {
  const currency = getCurrencyMeta(code);
  return Number(FALLBACK_EXCHANGE_RATES_TO_KRW[currency.code] || FALLBACK_EXCHANGE_RATES_TO_KRW.USD || 1);
}

async function fetchLatestExchangeRateToKrw(code = "JPY") {
  const currency = getCurrencyMeta(code);
  if (isWonCurrency(currency)) {
    return { rate: 1, date: new Date().toISOString().slice(0, 10), source: "KRW" };
  }

  const response = await fetch(`https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(currency.code)}&to=KRW`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("환율 API 요청에 실패했습니다.");
  const data = await response.json();
  const unitRate = Number(data?.rates?.KRW || 0);
  if (!unitRate) throw new Error("KRW 환율을 찾지 못했습니다.");
  return {
    rate: Number((unitRate * (currency.rateBase || 1)).toFixed(4)),
    date: data?.date || "",
    source: "Frankfurter",
  };
}

function getEntryCurrency(entry) {
  const fallback = getCurrencyMeta(entry.currency);
  return {
    ...fallback,
    symbol: entry.currencySymbol || fallback.symbol,
    unit: entry.currencyUnit || fallback.unit,
    rateBase: Number(entry.exchangeBase || fallback.rateBase || 1),
  };
}

function getPreferredCurrencyMeta(sourceState = state) {
  const liveCode = sourceState === state
    ? els.settingsCurrencySelect?.value || els.currencySelect?.value
    : "";
  const fallback = getCurrencyMeta(sourceState?.currencyCode || liveCode || "JPY");
  return {
    ...fallback,
    symbol: sourceState?.currencySymbol || fallback.symbol,
    unit: sourceState?.currencyUnit || fallback.unit,
    rateBase: Number(sourceState?.exchangeBase || fallback.rateBase || 1),
  };
}

function setPreferredCurrency(code) {
  const currency = getCurrencyMeta(code);
  state.currencyCode = currency.code;
  state.currencySymbol = currency.symbol;
  state.currencyUnit = currency.unit;
  state.exchangeBase = currency.rateBase;
  return currency;
}

function getEditableExchangeRate(entry) {
  if (!isForeignEntry(entry)) return "";
  if (isWonCurrency(entry.currency)) return "1";
  if (entry.exchangeBase) return entry.exchangeRate || "";

  const currency = getCurrencyMeta(entry.currency);
  const foreignAmount = Number(entry.foreignAmount || 0);
  const amount = Number(entry.amount || 0);
  if (!foreignAmount || !amount) return entry.exchangeRate || "";
  return Number(((amount / foreignAmount) * currency.rateBase).toFixed(4));
}

function getDefaultTripName() {
  return state.travelMode === "overseas" ? "해외 여행" : "국내 여행";
}

function getSnapshotDefaultTripName(snapshot) {
  return snapshot?.travelMode === "overseas" ? "해외 여행" : "국내 여행";
}

function formatRateBase(currency) {
  return `${formatForeignNumber(currency.rateBase || 1)}${currency.unit}`;
}

function formatForeignNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  });
}

function formatForeignAmount(entry) {
  const currency = getEntryCurrency(entry);
  if (isWonCurrency(currency)) return formatWon(entry.foreignAmount);
  return `${formatForeignNumber(entry.foreignAmount)}${currency.unit}`;
}

function formatEntryAmountHtml(entry) {
  if (!isForeignEntry(entry)) return escapeHtml(formatWon(entry.amount));
  if (isWonCurrency(entry.currency)) return escapeHtml(formatWon(entry.amount));
  const currency = getEntryCurrency(entry);
  return `
    <span class="foreign-amount" title="환율 ${escapeHtml(formatWon(entry.exchangeRate))} / ${escapeHtml(formatRateBase(currency))} 기준">
      <span class="currency-pill">${escapeHtml(currency.symbol)}</span>
      <span>${escapeHtml(formatForeignAmount(entry))}</span>
      <em>(${escapeHtml(formatWon(entry.amount))})</em>
    </span>
  `;
}

window.TripLog.register("shared.currency", {
  isForeignEntry,
  isWonCurrency,
  getCurrencyCodeForCountry,
  getDefaultExchangeRateForCurrency,
  fetchLatestExchangeRateToKrw,
  getCurrencyMeta,
  getEntryCurrency,
  getPreferredCurrencyMeta,
  setPreferredCurrency,
  getEditableExchangeRate,
  getDefaultTripName,
  getSnapshotDefaultTripName,
  formatRateBase,
  formatForeignNumber,
  formatForeignAmount,
  formatEntryAmountHtml,
});
