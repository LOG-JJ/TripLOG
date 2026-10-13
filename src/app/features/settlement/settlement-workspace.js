(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { icon, text, money, button, row, avatar } = window.TripLog.ui.markup;
  function renderSettlement(totals) {
    const source=getSelectedSettlementExpenseSource(getSettlementExpenseSources(totals)),model=buildSettlementModel(source);
    $('#settlementPage .rd-heading p').textContent=`${state.tripName} · ${model.members.length}명`;
    const unequal=model.entryRows.some(r=>r.mode==='custom'),n=model.members.length;
    $('#rdSettlement').innerHTML=`<section class="rd-settle-hero rd-outline"><div><span>함께 쓴 돈</span><strong>${money(model.totalTripSpent)}</strong><hr><span>${unequal?'평균 부담액':'1인 부담액'}</span><strong>${money(model.totalTripSpent/n)}</strong></div><div><span class="rd-badge">${unequal?'직접 분담':'균등 분담'}</span>${button('분담 수정','split','rd-secondary')}</div></section><h2>멤버별 정산</h2><div class="rd-member-balances">${model.memberSummaries.map((m,i)=>`<div class="rd-balance-row">${avatar(m.name,i)}<span>${m.isLeader ? `<button type="button" class="rd-settlement-name" data-rd-action="settlement-name" aria-label="${text(m.name)} 정산 이름 수정"${window.TripLog.features.redesign.workspace.canEditTripSettings() ? '' : ' disabled'}><b>${text(m.name)}</b>${icon('pencil-simple')}</button>` : `<b>${text(m.name)}</b>`}<small>낸 돈 ${money(m.paid)}</small></span><div class="${m.balance>0?'receives':''}"><b>${money(Math.abs(m.balance))}</b><small>${m.balance>0?'받을 돈':m.balance<0?'보낼 돈':'정산 완료'}</small></div></div>`).join('')}</div><h2>이렇게 보내면 끝!</h2><div class="rd-transfers rd-outline">${model.invalidEntries.length?'<p role="alert">항목별 분담 합계를 먼저 확인해 주세요.</p>':model.transactions.length?model.transactions.map(t=>`<div><b>${text(t.from)} → ${text(t.to)}</b><b>${money(t.amount)}</b></div>`).join(''):'<p>서로 주고받을 금액이 없어요.</p>'}</div><p class="rd-muted">송금 안내이며 실제 이체는 하지 않아요.</p>${row('항목별 분담 보기','file-text','split')}<div class="rd-page-footer">${button(`${icon('user-plus')} 멤버 추가·관리`,'companions','rd-secondary')}</div>`;
  }
  window.TripLog.register('features.settlement.workspace', { render: renderSettlement });
})();
