(() => {
  'use strict';
  function render(cost, variant = 'report') {
    const money = value => escapeHtml(formatWon(Math.round(Number(value) || 0)));
    if (variant === 'ledger') {
      return `<div class="ex-budget-values"><div><span>여행 경비</span><strong>${money(cost.total)}</strong></div><div class="ex-per-person"><span>1인 평균</span><strong>${money(cost.perPerson)}</strong></div><div class="ex-budget-meta"><i class="ph ph-receipt" aria-hidden="true"></i><span>기록한 지출 <b>${cost.count}건</b></span><small>사전구매·환불 포함 · 누적 금액</small></div></div>`;
    }
    return `<p class="rd-metric-label">여행 경비</p><strong class="rd-total">${money(cost.total)}</strong><p class="rd-budget-caption">기록한 지출 ${cost.count}건 · 1인 평균 ${money(cost.perPerson)}</p>`;
  }
  window.TripLog.register('ui.costSummary', { render });
})();
