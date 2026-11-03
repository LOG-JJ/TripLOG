(() => {
  'use strict';
  let editor = null, saving = false, problem = null;
  const locked = new Map();
  function unlock() { for (const [control,disabled] of locked) control.disabled=disabled; locked.clear(); }
  const updateSave = (issue = problem) => {
    problem = issue;
    const save = document.querySelector('#rdExpenseSubmit');
    if (save) save.disabled = saving || Boolean(problem) || !(editor?.element.hidden === false
      ? window.TripLog.features.redesign.workspace.canEditExpenseSplits()
      : window.TripLog.features.redesign.workspace.canEditTripSettings());
  };
  function setup(form) {
    if (editor) return;
    editor = window.TripLog.ui.expenseAllocationEditor.create({
      getEditId: () => editingId,
      getTotal: () => parseFormattedNumber(els.amountInput.value),
      onUpdate: updateSave,
      onChange: () => form.dispatchEvent(new Event('change', { bubbles:true })),
    });
    document.querySelector('#rdPayer').closest('label').after(editor.element);
    document.querySelector('#rdExpenseEditor').addEventListener('close', () => { saving=false;editor.reset();unlock(); });
  }
  function open(entry) {
    unlock();
    saving=false;
    document.querySelector('#rdExpenseMemo summary span').textContent=entry?'메모 · 결제자 · 분담':'메모 · 결제자';
    if(entry && state.settlement?.itemSplits?.[`current:${entry.id}`]?.mode==='custom') document.querySelector('#rdExpenseMemo').open=true;
    editor.open(entry);
    // A viewer can allocate an existing expense without changing its money/payer.
    if (entry && !window.TripLog.features.redesign.workspace.canEditTripSettings()) {
      document.querySelectorAll('#rdExpenseEditor input,#rdExpenseEditor select,#rdExpenseEditor textarea,#rdExpenseEditor button').forEach(control => {
        if (editor.element.contains(control) || control.id==='rdExpenseSubmit' || control.dataset.rdAction==='close') return;
        locked.set(control,control.disabled);control.disabled=true;
      });
    }
  }
  window.TripLog.register('features.expenses.allocation', {
    setup,open,sync:()=>editor?.sync(),validate:()=>editor?.validate(),stage:()=>editor?.stage(),
    finish:(token,success)=>editor?.finish(token,success),
    setSaving(value) { saving=value;editor?.setSaving(value);updateSave(); },
  });
})();

