// Run with playwright-cli run-code --filename scripts/time-picker-regression.js
// against a fresh local Travel.html page (never a production session).
async (page) => {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//.test(page.url())) {
    throw new Error('This fixture only runs against a local server');
  }
  const results = await page.evaluate(() => {
    // Local-only UI fixture; no account or server data is modified.
    els.authGate.hidden = true;
    els.appShell.hidden = false;
    els.appShell.removeAttribute('inert');
    els.appShell.removeAttribute('aria-hidden');
    setActivePage('itinerary');
    const input = els.itineraryTimeInput;
    const end = els.itineraryEndTimeInput;
    const control = customTimePickers.get(input);
    const assert = (value, message) => { if (!value) throw new Error(message); };
    let changes = 0;
    input.addEventListener('change', () => changes++);
    const renderOriginal = renderTimePicker;
    let renders = 0;
    renderTimePicker = (target) => { renders++; return renderOriginal(target); };
    const started = performance.now();
    control.value.dispatchEvent(new PointerEvent('pointerdown', {button:0, bubbles:true, cancelable:true}));
    control.value.click();
    const openMs = performance.now() - started;
    assert(renders === 1, 'Pointer interaction must open only once');
    assert(document.activeElement !== control.value, 'Pointer interaction must not focus the text input');
    const firstChild = control.panel.firstChild;
    setTimePickerPart(input, 'hour', '13');
    setTimePickerPart(input, 'minute', '25');
    control.value.click();
    closeCustomTimePicker(input);
    assert(input.value === '13:25' && changes === 1, 'Commit once after repeated click');
    openCustomTimePicker(input);
    assert(control.panel.firstChild === firstChild, 'Reuse option DOM');
    openTimeDropdown(input, 'minute');
    closeCustomTimePicker(input);
    openCustomTimePicker(input);
    assert([...control.panel.querySelectorAll('.time-dropdown-menu')].every(menu => menu.hidden), 'Reopen with menus closed');
    control.value.value = '1840';
    control.value.dispatchEvent(new Event('input', {bubbles:true}));
    control.value.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    assert(input.value === '18:40' && control.panel.hidden, 'Enter commits without reopening');
    openCustomTimePicker(end);
    assert(control.panel.hidden, 'Only one picker open');
    closeCustomTimePicker(end);
    assert(end.value === '', 'Empty time stays empty');
    input.disabled = true;
    openCustomTimePicker(input);
    assert(control.panel.hidden, 'Disabled input stays closed');
    input.disabled = false;
    renderTimePicker = renderOriginal;
    return {openMs, assertions:9, options:control.panel.querySelectorAll('.time-dropdown-option').length};
  });
  console.log(JSON.stringify(results));
}
