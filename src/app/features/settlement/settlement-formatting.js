function formatCurrency(val) {
  if (state.travelMode === "overseas") {
    const symbol = state.currencySymbol || "$";
    const unit = state.currencyUnit || "달러";
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (${unit})`;
  } else {
    return `${val.toLocaleString()}원`;
  }
}

function formatSettlementCurrency(val, sourceState = state) {
  const amount = Number(val || 0);
  if (sourceState?.travelMode === "overseas") {
    const symbol = sourceState.currencySymbol || "$";
    const unit = sourceState.currencyUnit || "달러";
    return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (${unit})`;
  }
  return `${Math.round(amount).toLocaleString()}원`;
}

window.TripLog.register("features.settlement.formatting", {
  formatCurrency,
  formatSettlementCurrency,
});
