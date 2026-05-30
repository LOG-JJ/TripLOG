function isForeignEntry(entry) {
  return entry?.mode === "overseas" && Number(entry.foreignAmount || 0) > 0;
}

function getCurrencyMeta(code) {
  return currencies.find((currency) => currency.code === code) || currencies[0];
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

function getEditableExchangeRate(entry) {
  if (!isForeignEntry(entry)) return "";
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
  return `${formatForeignNumber(entry.foreignAmount)}${currency.unit}`;
}

function formatEntryAmountText(entry) {
  if (!isForeignEntry(entry)) return formatWon(entry.amount);
  return `${formatForeignAmount(entry)} (${formatWon(entry.amount)})`;
}

function formatEntryAmountHtml(entry) {
  if (!isForeignEntry(entry)) return escapeHtml(formatWon(entry.amount));
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
  getCurrencyMeta,
  getEntryCurrency,
  getEditableExchangeRate,
  getDefaultTripName,
  getSnapshotDefaultTripName,
  formatRateBase,
  formatForeignNumber,
  formatForeignAmount,
  formatEntryAmountText,
  formatEntryAmountHtml,
});
