(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const money = value => text(formatWon(value));
  const shareLabel = row => row.percent ? row.percent + '%' : '1% 미만';

  function render({ cost, categories }) {
    const positiveTotal = categories.reduce((sum, row) => sum + row.amount, 0);
    const rows = categories.map(row => ({ ...row, color: window.TripLog.data.expenseCategories.get(row.name, 'overview').color }));
    const total = money(cost.total);
    const breakdown = rows.length ? `
      <div class="tc-composition" role="img" aria-label="${text(`지출 구성, ${rows.map(row => `${row.name} ${formatWon(row.amount)} ${shareLabel(row)}`).join(', ')}${cost.refunds < 0 ? ', 환불 전 지출 기준' : ''}`)}">
        ${rows.map(row => `<span style="--tc-color:${row.color};flex-grow:${row.amount / positiveTotal}" data-cost-share="${text(row.name)}" aria-hidden="true"></span>`).join('')}
      </div>
      <ul class="tc-category-list" aria-label="항목별 지출 비율">
        ${rows.map(row => `<li><button type="button" class="tc-category" data-rd-action="cost-category" data-category="${text(row.name)}" title="${text(`${row.name} ${formatWon(row.amount)}`)}" aria-label="${text(`${row.name} 지출 ${formatWon(row.amount)}, ${shareLabel(row)}, 내역 보기`)}"><span class="tc-category-name"><span class="tc-color-dot" style="--tc-color:${row.color}" aria-hidden="true"></span><span>${text(row.name)}</span></span><span class="tc-category-percent">${shareLabel(row)}</span></button></li>`).join('')}
      </ul>` : `<div class="tc-empty"><p>${cost.count ? '아직 지출 구성에 표시할 금액이 없어요.' : '첫 지출을 기록해 보세요.'}</p><button type="button" class="rd-button rd-empty-add" data-rd-action="expense-new">${icon('plus')} 지출 추가</button></div>`;
    const cards = window.TripLog.features.overview.card;
    return cards.render({ className: 'rd-overview-budget rd-overview-cost tc-card', labelledBy: 'tcCardTitle', header: cards.header({ title: '여행 경비', titleId: 'tcCardTitle', iconName: 'wallet', action: { nav: 'budget', label: '지출 기록 보기' } }), content: `
      <div class="tc-main"><strong class="tc-total${total.length > 13 ? ' is-long' : ''}">${total}</strong><span class="tc-main-caption">누적 지출</span></div>
      <dl class="tc-card-facts"><div><dt>기록한 지출</dt><dd>${cost.count.toLocaleString('ko-KR')}건</dd></div><div><dt>1인 평균</dt><dd>${money(cost.perPerson)}</dd></div></dl>
      <div class="tc-breakdown"><h3>지출 구성</h3>${breakdown}${cost.refunds < 0 ? `<p class="tc-refund-note">환불 ${money(Math.abs(cost.refunds))} 반영${rows.length ? ' · 지출 구성은 환불 전 금액 기준' : ''}</p>` : ''}</div>
    ` });
  }
  window.TripLog.register('features.overview.travelCostCard', { render });
})();
