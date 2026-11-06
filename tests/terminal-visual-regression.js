'use strict';
// Render the production ANSI output in xterm; this is a QA harness, not an app UI.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Controller } = require('../cli/tui/controller');
const { render, visibleFields } = require('../cli/tui/render');
const { launchBrowser } = require('./helpers/browser-fixture');
const { artifactDirectory } = require('../scripts/helpers/artifact-output');
const out = artifactDirectory('terminal-visual');
async function main() {
  process.env.TRIPLOG_CLI_HOME = path.join(out, 'home');
  const controller = new Controller({ demo: true }); await controller.init();
  const browser = await launchBrowser(), page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [], frames = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><html lang="ko"><meta charset="utf-8"><title>TripLOG ANSI verification</title><style>html,body{margin:0;background:#0a141d}#terminal{display:inline-block;padding:18px;background:#0a141d}.xterm-viewport{overflow:hidden!important}</style><div id="terminal"></div></html>');
  await page.addStyleTag({ path: require.resolve('@xterm/xterm/css/xterm.css') });
  await page.addScriptTag({ path: require.resolve('@xterm/xterm') });
  async function capture(name, columns, rows) {
    const screen = render(controller.state, columns, rows); controller.scrollRange = { view: controller.state.view, ...screen.scroll };
    await fs.writeFile(path.join(out, `${name}.ansi`), screen.ansi());
    await fs.writeFile(path.join(out, `${name}.txt`), screen.plain());
    const result = await page.evaluate(async ({ columns, rows, ansi }) => {
      window.triplogQaTerminal?.dispose(); document.querySelector('#terminal').replaceChildren();
      const terminal = window.triplogQaTerminal = new window.Terminal({ cols: columns, rows, fontSize: 16, lineHeight: 1.2, fontFamily: 'Consolas, "Malgun Gothic", monospace', cursorBlink: false, scrollback: 0, allowProposedApi: true, theme: { background: '#0a141d', foreground: '#e4edf5' } });
      terminal.open(document.querySelector('#terminal'));
      await document.fonts.ready;
      await new Promise(resolve => terminal.write('\x1b[?25l' + ansi, resolve));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { lines: Array.from({ length: rows }, (_, index) => terminal.buffer.active.getLine(index).translateToString()), buffer: terminal.buffer.active.length };
    }, { columns, rows, ansi: screen.ansi() });
    assert.equal(result.buffer, rows, `${name}: terminal scrolled`);
    const expected = screen.lines({ color: false }).map(line => line.trimEnd());
    assert.deepEqual(result.lines.map(line => line.trimEnd()), expected, `${name}: terminal cells differ from renderer`);
    await page.locator('#terminal').screenshot({ path: path.join(out, `${name}.png`) });
    frames.push({ name, columns, rows });
  }
  try {
    controller.state.focus = 'menu'; await capture('home-wide-120x38', 120, 38);
    controller.state.focus = 'content'; await capture('home-medium-100x30', 100, 30); await capture('home-compact-80x24', 80, 24); await capture('home-minimum-60x20', 60, 20);
    controller.state.focus = 'menu'; controller.state.navIndex = 9; await capture('menu-minimum-60x20', 60, 20);
    controller.state.focus = 'content'; controller.state.navIndex = 0;
    await controller.domainForm('itinerary', 'add'); controller.paste('순천만 국가정원 산책'); await capture('itinerary-form-120x38', 120, 38); await capture('itinerary-form-80x24', 80, 24);
    await controller.submitForm(); assert.equal(controller.state.view.type, 'confirm'); await capture('save-confirmation-120x38', 120, 38); await capture('save-confirmation-60x20', 60, 20);
    await controller.key('', { name: 'pagedown' }); await capture('save-confirmation-scrolled-60x20', 60, 20);
    controller.stack = []; controller.home(); await controller.activate(1); await capture('itinerary-list-120x38', 120, 38);
    controller.stack = []; controller.home(); await controller.activate(8); await capture('development-120x38', 120, 38);
    controller.stack = []; controller.home(); controller.loginForm();
    controller.state.view.values.email = 'example@example.invalid'; controller.state.view.values.password = 'not-a-real-secret'; controller.state.view.index = visibleFields(controller.state.view).findIndex(field => field.key === 'password');
    assert(!render(controller.state, 120, 38).plain().includes('not-a-real-secret')); await capture('login-masked-120x38', 120, 38);
    controller.service.login = async () => { const error = new Error('인증 서버 연결 시간이 초과됐습니다. 비밀번호 확인 단계까지 도달하지 못했습니다.'); error.code = 'NETWORK_ERROR'; error.details = { hint: '잠시 후 다시 로그인해 주세요. 계속되면 VPN·프록시·방화벽의 Node.js 연결 설정을 확인해 주세요.' }; throw error; };
    await controller.submitForm(); assert.equal(controller.state.view.type, 'result');
    await capture('login-network-error-80x24', 80, 24); await capture('login-network-error-60x20', 60, 20);
    await controller.key('', { name: 'return' }); assert.equal(controller.state.view.values.password, ''); assert.equal(controller.state.view.index, 2);
    await capture('login-retry-80x24', 80, 24);
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, renderer: 'Production ANSI in @xterm/xterm 6.0.0', browser: 'Playwright terminal-rendering harness; no browser application or external requests', frames, errors, at: new Date().toISOString() }, null, 2));
    console.log(`PASS terminal visual: ${frames.length} ANSI screens, exact cell comparisons, no page errors. ${out}`);
  } finally { controller.close(); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
