(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${text(name)}" aria-hidden="true"></i>`;
  const money = value => formatWon(Math.round(Number(value) || 0));
  const button = (label, action, style = '', extra = '') => `<button type="button" class="rd-button ${style}" data-rd-action="${action}" ${extra}>${label}</button>`;
  const avatar = (name, index) => `<span class="rd-avatar rd-avatar-${index % 3}" aria-hidden="true">${text(String(name || '나').slice(0, 2))}</span>`;
  const expenseAction = (label, name, action, className = '') => `<button type="button" class="ex-button ex-secondary${className ? ` ${text(className)}` : ''}" data-rd-action="${text(action)}">${icon(name)} ${text(label)}</button>`;
  const row = (label, name, action, value = '') => `<button type="button" class="rd-setting-row" data-rd-action="${action}">${icon(name)}<span>${label}</span><small>${text(value)}</small>${icon('caret-right')}</button>`;
  window.TripLog.register('ui.markup', { text, icon, money, button, avatar, row, expenseAction });
})();
