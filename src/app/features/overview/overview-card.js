(() => {
  'use strict';
  const text = value => escapeHtml(String(value ?? ''));
  const icon = name => `<i class="ph ph-${text(name)}" aria-hidden="true"></i>`;

  // Callers provide already-escaped content markup; this component owns the
  // frame and heading. Variants change layout/density, never the visual theme.
  function render({ className = '', variant = 'content', label = '', labelledBy = '', attributes = {}, header = '', content = '' }) {
    const kind = ['content', 'hero', 'reservations', 'action'].includes(variant) ? variant : 'content';
    const tag = kind === 'action' ? 'button' : 'section';
    const extras = Object.entries(attributes).filter(([name]) => /^(?:id|title|aria-[\w-]+|data-[\w-]+)$/.test(name)).map(([name, value]) => `${name}="${text(value)}"`).join(' ');
    return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="rd-outline ov-card ov-card--${kind} ${text(className)}" data-overview-card="${kind}"${label ? ` aria-label="${text(label)}"` : ''}${labelledBy ? ` aria-labelledby="${text(labelledBy)}"` : ''} ${extras}>${header}${content}</${tag}>`;
  }
  function header({ title, titleId = '', iconName = '', className = '', meta = '', badge = '', action = null }) {
    const control = action ? `<button type="button" class="ov-card-link" ${action.nav ? `data-rd-nav="${text(action.nav)}"` : `data-rd-action="${text(action.action)}"`}${action.label ? ` aria-label="${text(action.label)}"` : ''}>${text(action.label)}${icon('caret-right')}</button>` : '';
    return `<header class="rd-section-head ov-card-header ${text(className)}"><h2${titleId ? ` id="${text(titleId)}"` : ''}>${iconName ? icon(iconName) : ''}${text(title)}</h2>${badge}${meta ? `<span class="ov-card-meta">${text(meta)}</span>` : ''}${control}</header>`;
  }
  window.TripLog.register('features.overview.card', { render, header });
})();
