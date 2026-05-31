function formatCurrency(val) {
  const amount = Number(val || 0);
  if (state.travelMode === "overseas") {
    const currency = getPreferredCurrencyMeta();
    return `${currency.symbol} ${amount.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (${currency.unit})`;
  }
  return formatWon(amount);
}

function formatSettlementCurrency(val, sourceState = state) {
  const amount = Number(val || 0);
  if (sourceState?.travelMode === "overseas") {
    const currency = getPreferredCurrencyMeta(sourceState);
    return `${currency.symbol} ${amount.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (${currency.unit})`;
  }
  return formatWon(Math.round(amount));
}

window.TripLog.register("features.settlement.formatting", {
  formatCurrency,
  formatSettlementCurrency,
});
