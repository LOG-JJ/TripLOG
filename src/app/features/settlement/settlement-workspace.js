(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { icon, text, money, avatar } = window.TripLog.ui.markup;
  const views = new Map();
  let inlineSession = null, migrationBusy = false;
  const account = () => window.TripLog.features.collaboration.tripCollaboration.getCurrentAccount()?.id || '';
  const scope = () => state.id + ':' + account();
  const canEdit = () => window.TripLog.features.redesign.workspace.canEditExpenseSplits();
  const canManage = () => window.TripLog.features.redesign.workspace.canEditTripSettings();
  const view = () => { const key = scope(); if (!views.has(key)) views.set(key, { tab: 'summary', message: '' }); return views.get(key); };
  const currentModel = () => buildSettlementModel({ id: 'current', state });
  const action = (label, value, extra = '') => '<button type="button" data-settle-action="' + value + '" ' + extra + '>' + label + '</button>';

  function notice(model) {
    return (view().message ? '<p class="st-message" role="alert">' + text(view().message) + '</p>' : '') +
      (model.needsLegacyMigration ? '<section class="st-notice"><div>' + icon('receipt') + '<div><h2>아직 지출 내역에 없는 금액</h2><p>' +
        model.legacyExpenses.map(person => text(person.name) + ' ' + text(money(person.individualSpent))).join(' · ') +
        '</p><small>내역으로 옮긴 후 송금 안내에 함께 반영해요.</small></div></div>' +
        action('확인 후 지출로 옮기기', 'migrate', (migrationBusy || !canManage() ? 'disabled' : '') + ' class="rd-button rd-secondary"') + '</section>' : '');
  }
  function name(member) {
    return member.isLeader ? '<button type="button" class="rd-settlement-name" data-rd-action="settlement-name" aria-label="' +
      text(member.name) + ' 정산 이름 수정"' + (canManage() ? '' : ' disabled') + '>' + icon('pencil-simple') + '</button>' : '';
  }
  function summary(model) {
    const transfers = model.blocked
      ? '<div class="st-empty">' + icon('warning-circle') + '<p>' +
        (model.needsLegacyMigration ? '추가 지출을 확인하면 송금 안내가 완성돼요.' : '결제자와 분담 합계를 확인해 주세요.') + '</p>' +
        (!model.needsLegacyMigration ? action('항목별 분담 확인', 'items', 'class="rd-button rd-secondary"') : '') + '</div>'
      : model.transactions.length ? model.transactions.map(t => '<div class="st-transfer" aria-label="' + text(t.from + ' → ' + t.to + ' ' + money(t.amount)) + '">' +
        '<div class="st-transfer-people"><span title="' + text(t.from) + '">' + avatar(t.from, model.members.findIndex(m => m.key === t.fromKey)) + '</span><span class="st-transfer-arrow" aria-hidden="true">→</span><span title="' + text(t.to) + '">' +
        avatar(t.to, model.members.findIndex(m => m.key === t.toKey)) + '</span></div><strong>' + text(money(t.amount)) + '</strong></div>').join('')
      : '<div class="st-empty">' + icon(model.entries.length ? 'check-circle' : 'receipt') + '<p>' + (model.entries.length ? '주고받을 금액이 없어요.' : '기록한 지출이 없어요.') + '</p>' + (!model.entries.length ? action('지출 기록하기', 'budget', 'class="rd-button rd-secondary"') : '') + '</div>';
    return '<div class="st-summary-grid"><section class="st-panel st-members"><div class="st-section-head"><h2>' + icon('users') + ' 멤버별 정산</h2><button type="button" class="st-manage" data-rd-action="companions">' + icon('user-plus') + '<span>멤버 관리</span></button></div>' +
      model.memberSummaries.map((m, i) => '<article class="st-member' + (m.name.length > 7 || [m.paid,m.owed,m.balance].some(value => money(Math.abs(value)).length > 9) ? ' is-wide' : '') + '"><div class="st-member-heading"><span class="st-member-identity" role="group" aria-label="' + text(m.name) + '" title="' + text(m.name) + '">' + avatar(m.name, i) + name(m) + '</span>' +
        '<span class="st-net ' + (m.balance > 0 ? 'is-receive' : m.balance < 0 ? 'is-send' : '') + '"><small>' +
        (model.blocked ? '확인 중' : m.balance > 0 ? '받을 돈' : m.balance < 0 ? '보낼 돈' : '정산 완료') + '</small><strong>' +
        (model.blocked ? '—' : text(money(Math.abs(m.balance)))) + '</strong></span></div><dl><div><dt>결제한 금액</dt><dd>' + text(money(m.paid)) +
        '</dd></div><div><dt>분담할 금액</dt><dd>' + text(money(m.owed)) + '</dd></div></dl></article>').join('') + '</section><section class="st-panel st-guide"><h2>' + icon('arrows-left-right') + ' 송금 안내</h2><div class="rd-transfers">' + transfers +
      '</div><p class="st-footnote">실제 송금은 사용하시는 은행 앱에서 진행해 주세요.</p></section></div>';
  }
  function items(model) {
    if (!model.entryRows.length) return '<section class="st-panel st-empty">' + icon('receipt') + '<p>기록한 지출이 없어요.</p>' + action('지출 기록하기', 'budget', 'class="rd-button rd-secondary"') + '</section>';
    const byId = new Map(model.entryRows.map(row => [row.raw.id,row]));
    const body = window.TripLog.shared.expenseOrder.sort(state.entries).map(entry => {
      const row = byId.get(entry.id), expanded = inlineSession?.id === entry.id;
      const mode = row.mode === 'custom' ? '직접 분담' : '균등';
      const payer = model.members.find(member => member.key === (entry.payerKey || 'leader'));
      const error = row.invalid ? row.unknownPayer ? '결제한 사람을 다시 지정해 주세요.' : row.unknownShares ? '삭제된 멤버의 분담액을 다시 배분해 주세요.' : '분담 합계와 지출 금액을 맞춰 주세요.' : '';
      const actions = row.amount < 0 ? '<span class="st-refund">환불</span>' : action('<span class="st-split-label">' + mode + '</span>' + icon(expanded ? 'caret-up' : 'caret-down'), 'edit',
        'class="ex-entry-edit st-split-toggle" data-id="' + text(entry.id) + '" aria-label="' + text(entry.description) + ' 분담 수정" aria-expanded="' + expanded + '"' + (expanded ? ' aria-controls="stAllocationForm"' : '') + (!canEdit() || inlineSession?.saving ? ' disabled' : ''));
      const regular = window.TripLog.ui.expenseLedger.row(entry, {
        actions, settlement:true, action:'edit', readOnly:row.amount < 0,
        attributes:'data-settlement-entry="' + text(entry.id) + '" class="st-ledger-row' + (row.invalid ? ' is-invalid' : '') + '"',
        extra:'<small class="st-ledger-payer">결제 ' + text(payer?.name || '확인 필요') + '</small>' + (error ? '<small class="st-item-error" role="alert">' + error + '</small>' : ''),
        amountExtra:'<small class="st-ledger-mode-mobile">' + mode + '</small>',
      });
      return regular + (expanded ? '<tr class="st-allocation-row"><td colspan="6"><form id="stAllocationForm" novalidate aria-label="' + text(entry.description) + ' 분담 수정"><div id="stAllocationMount"></div><footer class="st-allocation-actions">' +
        action('취소','inline-cancel','class="ex-button"'+(inlineSession.saving?' disabled':'')) +
        '<button type="submit" class="ex-button ex-primary" id="stAllocationSave"' + (inlineSession.saving?' disabled':'') + '>분담 저장</button></footer></form></td></tr>' : '');
    }).join('');
    return '<div class="ex-table-wrap st-ledger">' + window.TripLog.ui.expenseLedger.table({ body,manageHeader:'분담',className:'is-settlement has-inline-actions',caption:'지출 항목별 분담. 분담 버튼을 누르면 해당 행 아래에서 금액과 비율을 수정할 수 있습니다.' }) + '</div>';
  }

  function setTab(tab, focus = true) {
    if (!closeInline()) return;
    view().tab = tab === 'items' ? 'items' : 'summary'; renderSettlement();
    if (focus) $('#stTab-' + view().tab)?.focus({ preventScroll: true });
  }
  function renderSettlement() {
    const mount = $('#rdSettlement'); if (!mount) return;
    if (inlineSession && inlineSession.owner !== scope()) { inlineSession.editor.reset(); inlineSession = null; }
    if (inlineSession && !findEntry(inlineSession.id)) { inlineSession.editor.reset(); inlineSession = null; view().message = '삭제된 지출이에요. 목록을 다시 확인해 주세요.'; }
    const focused = inlineSession?.editor.element.contains(document.activeElement) ? document.activeElement : null;
    const selection = focused && 'selectionStart' in focused ? [focused.selectionStart,focused.selectionEnd] : null;
    inlineSession?.editor.element.remove();
    const model = currentModel(), selected = view().tab;
    $('#rdSettlementSummary').innerHTML = window.TripLog.ui.costSummary.render(window.TripLog.shared.travelCosts.summarize(state, { members: model.members.length }));
    mount.innerHTML = notice(model) + '<div class="st-tabs" role="tablist" aria-label="경비 정산 보기">' +
      [['summary','정산 요약'],['items','항목별 분담']].map(([tab, label]) => action(label, tab, 'id="stTab-' + tab + '" role="tab" aria-selected="' + (tab === selected) + '" aria-controls="stPanel" tabindex="' + (tab === selected ? 0 : -1) + '"')).join('') +
      '</div><div id="stPanel" role="tabpanel" aria-labelledby="stTab-' + selected + '">' + (selected === 'items' ? items(model) : summary(model)) + '</div>';
    mount.onclick = event => {
      const button = event.target.closest('[data-settle-action]'); if (!button || button.disabled) return;
      const value = button.dataset.settleAction;
      if (['summary','items'].includes(value)) setTab(value);
      else if (value === 'budget') window.TripLog.features.redesign.workspace.navigate('budget');
      else if (value === 'edit') edit(button.dataset.id);
      else if (value === 'inline-cancel') { const id=inlineSession?.id; closeInline(); renderSettlement(); focusToggle(id); }
      else if (value === 'migrate') migrateLegacy();
    };
    if (inlineSession && selected === 'items') {
      $('#stAllocationMount')?.appendChild(inlineSession.editor.element);
      $('#stAllocationForm').addEventListener('submit',saveInline);
      $('#stAllocationForm').setAttribute('aria-busy',String(inlineSession.saving));
      inlineSession.editor.sync();
      if (focused) requestAnimationFrame(()=>{
        if (focused.isConnected && activePage === 'settlement' && document.activeElement === document.body) {
          focused.focus({preventScroll:true});
          if (selection) focused.setSelectionRange(...selection);
        }
      });
    }
    mount.onkeydown = event => {
      if (!event.target.matches('[role="tab"]') || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); setTab(event.key === 'Home' ? 'summary' : event.key === 'End' ? 'items' : selected === 'items' ? 'summary' : 'items');
    };
  }
  function closeInline() {
    if (inlineSession?.saving) return false;
    inlineSession?.editor.reset(); inlineSession = null; return true;
  }
  function focusToggle(id) {
    [...document.querySelectorAll('#rdSettlement .st-split-toggle')].find(node=>node.dataset.id===id)?.focus({preventScroll:true});
  }
  function edit(id) {
    if (inlineSession?.saving || !canEdit()) return;
    const entry = findEntry(id); if (!entry || entry.amount < 0) return;
    if (inlineSession?.id === id) { closeInline(); renderSettlement(); focusToggle(id); return; }
    closeInline();
    const session = { id, owner:scope(), saving:false, problem:null };
    inlineSession = session;
    session.editor = window.TripLog.ui.expenseAllocationEditor.create({
      id:'stAllocation',inputPrefix:'stSplitInput',showNames:false,
      getEditId:()=>inlineSession === session ? session.id : null,
      getTotal:()=>Number(findEntry(session.id)?.amount || 0),
      onUpdate:problem=>{
        session.problem = problem;
        const save = session.editor?.element.closest('form')?.querySelector('[type="submit"]');
        if (save) save.disabled = session.saving || Boolean(problem) || !canEdit();
      },
    });
    session.editor.open(entry); renderSettlement(); focusToggle(id);
  }
  async function saveInline(event) {
    event.preventDefault();
    const session = inlineSession;
    if (!session || session.saving || session.owner !== scope() || !canEdit()) return;
    const issue = session.editor.validate(); if (issue) { issue.target?.focus(); return; }
    let token;
    try {
      token = session.editor.stage();
      session.saving = true; session.editor.setSaving(true);
      $('#stAllocationForm').setAttribute('aria-busy','true');
      $('#stAllocationForm [data-settle-action="inline-cancel"]').disabled = true;
      if (await window.TripLog.ui.expenseAllocationEditor.persist(token) !== true) throw new Error('저장하지 못했어요. 입력한 분담은 유지했어요. 다시 시도해 주세요.');
      session.editor.finish(token,true);
      session.saving = false;
      if (inlineSession === session && session.owner === scope()) {
        closeInline();
        if (activePage === 'settlement') {
          renderSettlement();
          focusToggle(session.id);
        }
        showToast('분담을 저장했어요.');
      }
    } catch (error) {
      session.editor.finish(token,false); session.saving=false; session.editor.setSaving(false);
      if (inlineSession === session && session.owner === scope()) {
        if (activePage === 'settlement') renderSettlement();
        session.editor.report(error.message || '분담을 저장하지 못했어요.');
      }
    }
  }
  const migrationSignature = () => JSON.stringify([state.startDate, state.entries, state.companions, state.settlement]);
  async function migrateLegacy() {
    if (migrationBusy || !canManage()) return false;
    const people = currentModel().legacyExpenses; if (!people.length) return false;
    if (people.some(person => !person.id || !Number.isSafeInteger(Number(person.individualSpent)) || Number(person.individualSpent) <= 0)) {
      view().message = '추가 지출 금액과 멤버를 먼저 확인해 주세요.'; renderSettlement(); return false;
    }
    migrationBusy = true; view().message = ''; renderSettlement();
    const origin = scope(), signature = migrationSignature(), date = state.startDate;
    let previous = null, draft = null;
    try {
      const confirmed = await window.TripLog.ui.confirmation.ask({ title: '지출 내역으로 옮길까요?',
        subject: people.map(person => person.name + ' ' + money(person.individualSpent)).join(' · '),
        message: '각 멤버가 결제한 기타 지출로 추가해요. 여행 일정·결제일은 ' + date + ', 분담은 균등으로 시작해요. 실제 날짜와 분담은 지출 수정에서 바꿀 수 있어요. 옮긴 금액은 예전 추가 지출에서 지워 중복 집계하지 않아요.',
        confirmLabel: '지출로 옮기기' });
      if (!confirmed) return false;
      if (scope() !== origin) return false;
      if (!canManage() || signature !== migrationSignature()) { view().message = '내용이 바뀌었어요. 금액을 다시 확인해 주세요.'; return false; }
      const commands = window.TripLog.domain.commands;
      draft = state;
      for (const person of people) {
        draft = commands.mutate(draft, 'expense', 'add', { id: createId(), data: { date, paymentDate: date, category: '기타',
          description: person.name + ' 별도 지출', amount: Number(person.individualSpent), mode: 'domestic', payerKey: getCompanionSettlementKey(person),
          note: '예전 동행 추가 지출에서 옮긴 내역입니다. 실제 결제일과 분담을 확인해 주세요.' } });
        draft = commands.mutate(draft, 'companion', 'update', { id: person.id, data: { individualSpent: 0 } });
      }
      previous = { entries: state.entries, companions: state.companions };
      state.entries = draft.entries; state.companions = draft.companions;
      if (await saveAndRender() !== true) throw new Error('저장하지 못했어요. 기존 금액을 유지했어요.');
      if (scope() === origin) { view().message = ''; showToast('지출 내역에 옮겼어요. 날짜와 분담을 확인해 주세요.'); }
      return true;
    } catch (error) {
      if (scope() === origin) {
        if (previous && state.entries === draft.entries && state.companions === draft.companions) Object.assign(state, previous);
        view().message = error.message || '저장하지 못했어요. 다시 확인해 주세요.';
      }
      return false;
    } finally { migrationBusy = false; if (scope() === origin && activePage === 'settlement') renderSettlement(); }
  }
  window.TripLog.register('features.settlement.workspace', { render: renderSettlement, setTab, migrateLegacy });
})();
