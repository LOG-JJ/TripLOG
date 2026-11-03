(() => {
  'use strict';
  const math = () => window.TripLog.shared.expenseAllocation;
  const esc = value => escapeHtml(String(value ?? ''));
  const money = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('ko-KR') : '—';
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const account = () => window.TripLog.sync.controller.getAccount()?.id || '';
  const signature = value => JSON.stringify(value?.mode === 'custom' ? { mode: 'custom', shares: Object.entries(value.shares || {}).sort(([a], [b]) => a.localeCompare(b)) } : { mode: 'equal' });
  async function persist(token) {
    if (!token || token.tripId !== state.id || token.account !== account()) throw new Error('여행이나 계정이 변경됐어요. 다시 열어 주세요.');
    const repository = window.TripLogSyncRepository, record = repository.cached(token.tripId);
    if (!record || record.archivedAt || record.removal) throw new Error('현재 여행을 확인한 뒤 다시 열어 주세요.');
    const before = record.snapshot, entry = before.entries.find(row => row.id === token.session.editId);
    if (!entry || entry.amount !== token.session.originalAmount || signature(before.settlement?.itemSplits?.[token.key]) !== signature(token.before)) throw new Error('분담 기준이 변경됐어요. 닫고 다시 열어 주세요.');
    const value = clone(state.settlement?.itemSplits?.[token.key]);
    if (signature(value) !== token.after) throw new Error('분담 입력이 변경됐어요. 다시 확인해 주세요.');
    // Save only this split against the exact stored baseline, preserving all
    // unrelated fields and the repository's tab/server conflict handling.
    const candidate = { ...before, settlement: { ...before.settlement, itemSplits: { ...before.settlement?.itemSplits, [token.key]: value } } };
    await repository.save(candidate, before, { sourceSnapshot: before, expectedScope: { accountId:record.accountId,projectId:record.projectId,serverId:record.serverId } });
    if (token.tripId !== state.id || token.account !== account()) return false;
    window.TripLog.persistence.stateStorage.applyRepositoryChange(token.tripId);
    return true;
  }
  function create({ id = 'exAllocation', inputPrefix = 'exSplitInput', getEditId, getTotal, onUpdate = () => {}, onChange = () => {}, showNames = true }) {
    const panel = document.createElement('section'); panel.id = id; panel.className = 'ex-allocation'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', `${id}Title`);
    panel.innerHTML = `<h3 id="${id}Title">분담 설정</h3><div class="ex-split-modes" role="group" aria-label="분담 방식">${[['equal','균등'],['amount','금액'],['percent','비율']].map(([mode,label])=>`<button type="button" data-allocation-mode="${mode}" aria-pressed="false">${label}</button>`).join('')}</div><div id="${id}Rows"></div><div id="${id}Status" class="ex-split-status" role="status" aria-live="polite"></div><p id="${id}Error" class="ex-split-error" hidden></p><input id="${id}Draft" type="hidden">`;
    const $ = suffix => panel.querySelector(`#${id}${suffix}`);
    const canEdit = () => window.TripLog.features.redesign.workspace.canEditExpenseSplits();
    const members = () => getSettlementMembers().map(member => ({ key: member.key, name: member.name }));
    let scope = null, saving = false, feedback = '';
    function reset() {
      scope = null; saving = false; feedback = ''; panel.hidden = true;
      $('Rows').replaceChildren(); $('Draft').value = ''; $('Error').hidden = true;
      onUpdate(null);
    }
    function result() {
      const preview = math().preview(scope.mode, getTotal(), scope.members.map(member => scope.values[member.key] ?? '0'));
      if (scope.mode === 'percent' && scope.ratioBase?.total === getTotal() && preview.valid) return { ...preview, shares: [...scope.ratioBase.shares], allocated: scope.ratioBase.total, diff: 0 };
      return preview;
    }
    function issue(preview = scope && result()) {
      if (!scope) return null;
      if (scope.tripId !== state.id || scope.account !== account() || scope.editId !== getEditId()) return '여행이나 계정이 변경됐어요. 닫고 다시 열어 주세요.';
      if (!canEdit()) return '이 여행의 분담을 수정할 권한이 없어요.';
      if (JSON.stringify(members().map(member => member.key)) !== scope.memberKeys) return '동행 정보가 변경됐어요. 닫고 다시 열어 주세요.';
      if (!findEntry(scope.editId)) return '삭제된 지출이에요. 닫고 목록을 다시 확인해 주세요.';
      if (!scope.applying && (signature(state.settlement?.itemSplits?.[scope.key]) !== scope.signature || findEntry(scope.editId).amount !== scope.originalAmount)) return '분담 기준이 다른 곳에서 변경됐어요. 닫고 다시 열어 주세요.';
      if (scope.unknown) return '현재 동행과 기존 분담 정보가 달라요. 동행 정보를 확인해 주세요.';
      if (!preview.moneyOK) return '분담할 원화 금액을 확인해 주세요.';
      if (!preview.inputOK) return scope.mode === 'percent' ? '비율은 0~100 사이에서 소수 둘째 자리까지 입력해 주세요.' : '분담액은 0 이상의 원 단위 금액으로 입력해 주세요.';
      if (!preview.valid) return scope.mode === 'percent' ? '분담 비율의 합계를 100%로 맞춰 주세요.' : '분담 합계를 결제 금액과 맞춰 주세요.';
      return null;
    }
    function refresh() {
      if (!scope) return;
      const preview = result(), problem = issue(preview), total = getTotal(), people = members();
      const readonly = saving || !canEdit();
      panel.querySelectorAll('[data-allocation-mode]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.allocationMode === scope.mode)); button.disabled = readonly; });
      scope.members.forEach((member, index) => {
        const row = panel.querySelector(`[data-split-index="${index}"]`), input = row?.querySelector('input'); if (!row) return;
        const label = row.querySelector('[data-member-name]');
        if (label) label.textContent = people.find(value => value.key === member.key)?.name || member.name;
        if (input) { input.disabled = readonly; input.setAttribute('aria-invalid', String(!Number.isFinite(math().parse(input.value, scope.mode === 'percent')))); }
        row.querySelector('[data-split-derived]').textContent = scope.mode === 'percent' ? `${money(preview.shares[index])}원` : `${math().percentText(preview.units[index])}%`;
        if (scope.mode === 'equal') row.querySelector('[data-split-equal]').textContent = `${money(preview.shares[index])}원`;
      });
      const status = $('Status'); status.dataset.tone = problem ? 'warning' : total > 0 ? 'success' : 'neutral';
      status.innerHTML = `<i class="ph ph-${problem ? 'warning-circle' : total > 0 ? 'check-circle' : 'users'}" aria-hidden="true"></i><span>분담 합계</span><strong>${money(preview.allocated)} / ${money(total)}원</strong>`;
      const error = $('Error'); error.hidden = !problem && !feedback; error.textContent = problem || feedback;
      $('Draft').value = JSON.stringify({ mode: scope.mode, values: scope.values });
      onUpdate(problem);
    }
    function rows() {
      panel.dataset.mode = scope.mode;
      $('Rows').innerHTML = scope.members.map((member,index) => {
        const avatar = `<span class="ex-split-avatar" data-color="${index % 3}" aria-hidden="true">${esc(Array.from(member.name).slice(0,2).join(''))}</span>`;
        const input = `<label class="ex-split-input"><input id="${inputPrefix}-${index}" type="text" inputmode="${scope.mode === 'percent' ? 'decimal' : 'numeric'}" autocomplete="off" value="${esc(scope.values[member.key])}" data-split-key="${esc(member.key)}" aria-label="${esc(member.name)} ${scope.mode === 'percent' ? '분담 비율' : '분담 금액'}" aria-describedby="${id}Status ${id}Error"><span aria-hidden="true">${scope.mode === 'percent' ? '%' : '원'}</span></label>`;
        return `<div class="ex-split-row" data-split-index="${index}"><span class="ex-split-member" title="${esc(member.name)}" aria-label="${esc(member.name)}">${avatar}${showNames ? `<span data-member-name>${esc(member.name)}</span>` : ''}</span>${scope.mode === 'percent' ? '<output class="ex-split-money" data-split-derived></output>' : scope.mode === 'equal' ? '<output class="ex-split-money" data-split-equal></output>' : input}${scope.mode === 'percent' ? input : '<output class="ex-split-percent" data-split-derived></output>'}</div>`;
      }).join('');
      refresh();
    }
    function open(entry) {
      saving = false; feedback = ''; scope = null; panel.hidden = !entry || Number(entry.amount) < 0;
      if (panel.hidden) { reset(); return; }
      const people = members(), key = `current:${entry.id}`, stored = clone(state.settlement?.itemSplits?.[key]);
      const custom = stored?.mode === 'custom', shares = custom ? stored.shares || {} : getEqualMemberShares(Math.round(entry.amount), people);
      scope = { tripId: state.id, account: account(), editId: entry.id, originalAmount: entry.amount, key, signature: signature(stored), members: people, memberKeys: JSON.stringify(people.map(member => member.key)), mode: custom ? 'amount' : 'equal', values: Object.fromEntries(people.map(member => [member.key,money(shares[member.key] || 0)])), unknown: custom && Object.entries(shares).some(([key,value]) => value && !people.some(member => member.key === key)), applying: false };
      rows();
    }
    function sync() {
      if (!scope) return;
      if (scope.editId !== getEditId() || scope.tripId !== state.id || scope.account !== account()) { reset(); return; }
      refresh();
    }
    function validate() { const message = scope && issue(); return message ? { message, target: panel.querySelector('input:not([type=hidden])') || panel.querySelector('button') } : null; }
    function stage() {
      if (!scope) return null;
      const problem = issue(); if (problem) throw new Error(problem);
      const preview = result(), value = scope.mode === 'equal' ? { mode:'equal',shares:{} } : { mode:'custom',shares:Object.fromEntries(scope.members.map((member,index) => [member.key,preview.shares[index]])) };
      const before = clone(state.settlement?.itemSplits?.[scope.key]);
      const token = { tripId:state.id,account:account(),session:scope,key:scope.key,before,after:signature(value),changed:signature(value)!==scope.signature };
      if (token.changed) state.settlement = { ...state.settlement,itemSplits:{ ...state.settlement?.itemSplits,[scope.key]:value } };
      scope.applying = true; return token;
    }
    function finish(token, success) {
      if (token?.changed && token.tripId === state.id && token.account === account() && !success && signature(state.settlement?.itemSplits?.[token.key]) === token.after) {
        const splits = { ...state.settlement.itemSplits };
        if (token.before === undefined) delete splits[token.key]; else splits[token.key] = token.before;
        state.settlement = { ...state.settlement,itemSplits:splits };
      }
      if (!token || scope !== token.session || scope.tripId !== state.id || scope.account !== account()) return;
      scope.applying = false;
      if (success) { scope.signature = signature(state.settlement?.itemSplits?.[scope.key]); scope.originalAmount = findEntry(scope.editId)?.amount; }
      refresh();
    }
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-allocation-mode]'); if (!button || !scope || saving) return;
      const next = button.dataset.allocationMode, preview = result(); if (next === scope.mode) return;
      const values = next === 'percent' ? math().percentages(getTotal(),preview.shares).map(math().percentText) : preview.shares.map(value => money(Number.isFinite(value) ? value : 0));
      scope.ratioBase = next === 'percent' && preview.valid ? { total:getTotal(),shares:[...preview.shares] } : null;
      scope.mode = next; scope.values = Object.fromEntries(scope.members.map((member,index) => [member.key,values[index]])); feedback = ''; rows(); onChange();
    });
    panel.addEventListener('input', event => { const input = event.target.closest('[data-split-key]'); if (!input || !scope || saving) return; scope.ratioBase = null; scope.values[input.dataset.splitKey] = input.value; feedback = ''; refresh(); });
    panel.addEventListener('focusout', event => { const input = event.target.closest('[data-split-key]'); if (!input || !scope || scope.mode !== 'amount') return; const value = math().parse(input.value); if (Number.isFinite(value)) { input.value = money(value); scope.values[input.dataset.splitKey] = input.value; } });
    return { element:panel,open,sync,validate,stage,finish,reset,setSaving(value) { saving=value;refresh(); },report(message) { feedback=message;refresh(); } };
  }
  window.TripLog.register('ui.expenseAllocationEditor', { create, persist });
})();
