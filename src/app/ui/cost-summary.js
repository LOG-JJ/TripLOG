(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  function renderMetrics({ primary, facts }) {
    const amount = value => {
      const label = text(value);
      const isLong = label.length > 11;
      return `<strong class="cost-summary-amount${isLong ? ' is-long' : ''}">${isLong ? label.replaceAll(',', ',<wbr>') : label}</strong>`;
    };
    return `<div class="cost-summary">
      <div class="cost-summary-primary">
        <span class="cost-summary-wallet${primary.artwork === 'wallet' ? '' : ' cost-summary-symbol'}" aria-hidden="true">${primary.artwork === 'wallet' ? '<img src="./icons/cost-summary-wallet.png" width="120" height="120" alt="" />' : `<i class="ph ph-${text(primary.icon)}"></i>`}</span>
        <div class="cost-summary-main">
          <p class="cost-summary-title">${text(primary.label)}</p>
          ${amount(primary.value)}
        </div>
      </div>
      <dl class="cost-summary-facts">
        ${facts.map(fact => `<div class="cost-summary-fact"><dt><span class="cost-summary-icon" data-tone="${text(fact.tone || 'blue')}" aria-hidden="true"><i class="ph ph-${text(fact.icon)}"></i></span><span>${text(fact.label)}</span></dt><dd>${amount(fact.value)}</dd></div>`).join('')}
      </dl>
    </div>`;
  }
  function render(cost) {
    const money = value => formatWon(Math.round(Number(value) || 0));
    const count = Math.max(0, Math.floor(Number(cost.count) || 0)).toLocaleString('ko-KR');
    return renderMetrics({ primary: { label:'여행 경비',value:money(cost.total),artwork:'wallet' },facts:[
      { label:'1인 평균',value:money(cost.perPerson),icon:'user' },
      { label:'기록한 지출',value:count+'건',icon:'receipt' },
    ] });
  }
  window.TripLog.register('ui.costSummary', { render, renderMetrics });
})();
