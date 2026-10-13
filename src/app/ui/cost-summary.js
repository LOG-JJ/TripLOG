(() => {
  'use strict';
  function render(cost) {
    const money = value => {
      const label = escapeHtml(formatWon(Math.round(Number(value) || 0)));
      const isLong = label.length > 11;
      return `<strong class="cost-summary-amount${isLong ? ' is-long' : ''}">${isLong ? label.replaceAll(',', ',<wbr>') : label}</strong>`;
    };
    const count = Math.max(0, Math.floor(Number(cost.count) || 0)).toLocaleString('ko-KR');
    return `<div class="cost-summary">
      <div class="cost-summary-primary">
        <span class="cost-summary-wallet" aria-hidden="true"><img src="./icons/cost-summary-wallet.png" width="120" height="120" alt="" /></span>
        <div class="cost-summary-main">
          <p class="cost-summary-title">여행 경비</p>
          ${money(cost.total)}
        </div>
      </div>
      <dl class="cost-summary-facts">
        <div class="cost-summary-fact">
          <dt><span class="cost-summary-icon" aria-hidden="true"><i class="ph ph-user"></i></span><span>1인 평균</span></dt>
          <dd>${money(cost.perPerson)}</dd>
        </div>
        <div class="cost-summary-fact">
          <dt><span class="cost-summary-icon" aria-hidden="true"><i class="ph ph-receipt"></i></span><span>기록한 지출</span></dt>
          <dd><strong class="cost-summary-amount">${count}건</strong></dd>
        </div>
      </dl>
    </div>`;
  }
  window.TripLog.register('ui.costSummary', { render });
})();
