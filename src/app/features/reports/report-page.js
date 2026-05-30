function renderReportPage(totals, days) {
  const reportMaxExpenseTitle = document.querySelector("#reportMaxExpenseTitle");
  const reportMaxExpenseAmount = document.querySelector("#reportMaxExpenseAmount");
  const reportAvgExpenseAmount = document.querySelector("#reportAvgExpenseAmount");

  if (reportMaxExpenseTitle && reportMaxExpenseAmount && reportAvgExpenseAmount) {
    const maxVal = totals.maxEntry ? totals.maxEntry.amount : 0;
    const maxDesc = totals.maxEntry ? totals.maxEntry.description : "-";
    reportMaxExpenseTitle.textContent = maxDesc;
    reportMaxExpenseAmount.textContent = formatCurrency(maxVal);

    const activeDays = days.length || 1;
    const dailyAvg = totals.total / activeDays;
    reportAvgExpenseAmount.textContent = formatCurrency(dailyAvg);
  }

  renderDailySpendTrend(days);
}


window.TripLog.register("features.reports.page", {
  renderReportPage,
});
