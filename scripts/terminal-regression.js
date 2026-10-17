'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PassThrough, Writable } = require('node:stream');
const { spawn } = require('node:child_process');
const { Terminal } = require('@xterm/headless');
const { Controller } = require('../cli/tui/controller');
const { TerminalService } = require('../cli/tui/service');
const { render, visibleFields } = require('../cli/tui/render');
const { width } = require('../cli/tui/screen');
const { InputDecoder } = require('../cli/tui/input');
const { start } = require('../cli/tui');
const { Job } = require('../cli/tui/job');
const { dispatch } = require('../cli');
const { artifactDirectory } = require('./helpers/artifact-output');
const { startCliFixture } = require('./helpers/cli-fixture');
const { CloudAdapter } = require('../cli/adapters/cloud');
const { Journal } = require('../cli/lib/operation-journal');
const Domain = require('../src/app/domain/commands');
const out = artifactDirectory('terminal');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, message, timeout = 15000) { const start = Date.now(); while (!predicate()) { if (Date.now() - start > timeout) throw new Error(typeof message === 'function' ? message() : message); await sleep(10); } }
async function fill(controller, key, value) {
  controller.state.view.index = visibleFields(controller.state.view).findIndex(field => field.key === key); assert(controller.state.view.index >= 0, `Missing ${key}`);
  await controller.key('', { name: 'u', ctrl: true }); controller.paste(String(value));
}
async function confirm(controller) { assert.equal(controller.state.view.type, 'confirm'); assert.equal(controller.state.view.index, 0); await controller.key('', { name: 'right' }); await controller.key('', { name: 'return' }); }
async function main() {
  process.env.TRIPLOG_CLI_HOME = path.join(out, 'home');
  const service = new TerminalService(), controller = new Controller({ demo: true }, { service });
  await controller.init(); assert(controller.state.demo); assert.equal(controller.state.busy, false); assert.equal(controller.state.trip.entries.reduce((sum, row) => sum + row.amount, 0), 428000);
  const frames = [];
  assert(render({ ...controller.state, trip: { id: 'legacy', tripName: '이전 여행' } }, 60, 20).plain().includes('일정 0개'), 'legacy minimal backups remain readable');
  for (const [columns, rows] of [[120, 38], [100, 30], [80, 24], [60, 20]]) {
    for (const focus of ['menu', 'content']) {
      controller.state.focus = focus;
      const screen = render(controller.state, columns, rows); assert(screen.lines({ color: false }).every(line => width(line) === columns), `${columns}x${rows}: character-cell overflow`);
      const terminal = new Terminal({ cols: columns, rows, allowProposedApi: true }); await new Promise(resolve => terminal.write(screen.ansi(), resolve));
      assert.equal(terminal.buffer.active.length, rows, 'screen must not scroll');
      assert(terminal.buffer.active.getLine(1).translateToString().includes(columns >= 96 && rows >= 30 ? '▀█▀' : 'TRIPLOG'));
      terminal.dispose(); frames.push({ columns, rows, focus });
    }
  }
  controller.state.focus = 'menu'; controller.state.navIndex = 9; assert(render(controller.state, 60, 20).plain().includes('연결 설정'));
  controller.state.focus = 'content'; controller.state.navIndex = 0;
  const before = await fs.readFile(controller.state.context.store, 'utf8');
  await controller.domainForm('expense', 'add');
  await fill(controller, 'description', '한글 점심'); await fill(controller, 'amount', '12000');
  await controller.key('', { name: 's', ctrl: true }); assert.equal(controller.state.view.type, 'confirm');
  assert.equal(await fs.readFile(controller.state.context.store, 'utf8'), before, 'preview must not save');
  await controller.key('', { name: 'escape' }); assert.equal(controller.state.view.values.description, '한글 점심');
  await controller.key('', { name: 's', ctrl: true }); await confirm(controller);
  assert.equal(controller.state.trip.entries.reduce((sum, row) => sum + row.amount, 0), 440000);
  assert.equal(controller.state.trip.entries.filter(row => row.description === '한글 점심').length, 1);
  controller.stack = []; controller.home(); await controller.domainForm('packing', 'add');
  await fill(controller, 'name', '한글😄'); await controller.key('', { name: 'backspace' }); assert.equal(controller.state.view.values.name, '한글');
  await controller.key('', { name: 'left' }); await controller.key('가', {}); assert.equal(controller.state.view.values.name, '한가글');
  await controller.key('', { name: 'delete' }); assert.equal(controller.state.view.values.name, '한가');
  controller.paste('\n붙여넣기\x1b[31m'); assert.equal(controller.state.view.type, 'form'); assert(!controller.state.view.values.name.includes('\x1b'));
  const decoded = [], pasted = []; const decoder = new InputDecoder({ keyData: data => decoded.push(data), paste: text => pasted.push(text) });
  for (const chunk of ['a\x1b[20', '0~가나다\nq\r', '\x1b[20', '1~b']) decoder.write(Buffer.from(chunk)); decoder.close();
  assert.deepEqual(decoded, ['a', 'b']); assert.deepEqual(pasted, ['가나다\nq\r']);
  controller.stack = []; controller.home(); controller.loginForm(); await fill(controller, 'password', 'tui-secret-test');
  assert(!render(controller.state, 120, 38).plain().includes('tui-secret-test')); await controller.key('', { name: 'escape' });
  controller.loginForm(); await fill(controller, 'password', 'e\u0301-password'); assert.equal(controller.state.view.values.password, 'e\u0301-password', 'password bytes must not be normalized'); await controller.key('', { name: 'escape' });
  const item = controller.state.trip.itineraryItems[0]; await controller.domainForm('itinerary', 'update', { id: item.id });
  await fill(controller, 'place', 'TUI 변경'); await controller.key('', { name: 's', ctrl: true });
  await dispatch(['itinerary', 'update'], { source: 'file', store: controller.state.context.store, trip: controller.state.context.trip, id: item.id, place: '다른 작업의 변경', inPlace: true });
  await confirm(controller); assert.equal(controller.state.view.error, true);
  assert.equal((await service.call(controller.state.context, 'itinerary', 'show', { id: item.id })).place, '다른 작업의 변경');
  const pending = {}; const slowService = new TerminalService({ dispatch: () => new Promise(resolve => { pending.resolve = resolve; }) });
  const stale = new Controller({}, { service: slowService }); const reading = stale.readResult('오래된 결과', 'auth', 'status');
  await stale.key('', { name: 'escape' }); await stale.activate(8); pending.resolve({ email: 'old@example.invalid' }); await reading;
  assert.equal(stale.state.view.title, '개발 도구', 'cancelled read must not replace the new screen');
  await testWorkflows(); await testConnectionCancellation(); await testCloud(service); await testRuntime(); await testPlain(); await testJobs(); await testNoTty();
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ passed: true, frames, cases: ['preview/cancel/one save', 'Korean/grapheme editing', 'bracketed paste isolation', 'password masking and exact bytes', 'file CAS conflict', 'cloud version and privacy baseline conflicts', 'stale read and connection cancellation', 'reservation stay nights', 'foreign expense create/update conversion', 'packing and companion forms', 'notes and comments', 'backup roundtrip and settlement finalization', 'new file create and archive/restore', 'TTY cleanup and Ctrl+J', 'plain numbered menu', 'job cancellation', 'non-TTY guard'], at: new Date().toISOString() }, null, 2));
  controller.close(); stale.close(); console.log('PASS terminal: native cell layouts, Korean editing, safe paste, masked secrets, preview/cancel/save, file/cloud conflicts, stale reads, TTY restore and child-process cancellation.');
}
async function testWorkflows() {
  const controller = new Controller({ demo: true }); await controller.init();
  async function saveForm() { await controller.submitForm(); assert.equal(controller.state.view.type, 'confirm', controller.state.view.error || JSON.stringify(controller.state.view.lines)); await confirm(controller); assert(!controller.state.view.error, JSON.stringify(controller.state.view.lines)); controller.stack = []; controller.home(); }
  await controller.domainForm('reservation', 'add'); await fill(controller, 'title', 'TUI 숙소 예약'); await saveForm();
  assert(controller.state.trip.travelCompanion.reservations.some(row => row.title === 'TUI 숙소 예약'));
  assert.equal(controller.state.trip.itineraryItems.filter(row => row.place === 'TUI 숙소 예약').length, 2, 'stay creates both nights');
  await controller.domainForm('expense', 'add'); await fill(controller, 'description', '외화 검증');
  controller.state.view.values.mode = 'overseas'; await fill(controller, 'currency', 'JPY'); await fill(controller, 'foreignAmount', '1000'); await fill(controller, 'exchangeRate', '930'); await fill(controller, 'exchangeBase', '100'); await saveForm();
  let expense = controller.state.trip.entries.find(row => row.description === '외화 검증'); assert.equal(expense.amount, 9300);
  await controller.domainForm('expense', 'update', { id: expense.id }); await fill(controller, 'foreignAmount', '2000'); await saveForm();
  expense = controller.state.trip.entries.find(row => row.id === expense.id); assert.equal(expense.amount, 18600); assert.equal(expense.currency, 'JPY');
  await controller.domainForm('companion', 'add'); await fill(controller, 'name', 'TUI 동행'); await saveForm(); assert(controller.state.trip.companions.some(row => row.name === 'TUI 동행'));
  await controller.domainForm('packing', 'add'); await fill(controller, 'name', 'TUI 준비물'); await saveForm();
  const packing = controller.state.trip.packingList.find(row => row.name === 'TUI 준비물');
  await controller.prepare({ kind: 'domain', group: 'packing', action: 'check', options: { id: packing.id, checked: true }, label: '준비 완료' }); await confirm(controller); assert(controller.state.trip.packingList.find(row => row.id === packing.id).checked);
  controller.stack = []; controller.home();
  await controller.prepare({ kind: 'document', group: 'note', action: 'append', text: '첫 줄\n두 번째 줄', label: '공동 메모' }); await confirm(controller);
  assert.equal((await controller.service.call(controller.state.context, 'note', 'show')).text, '첫 줄\n두 번째 줄');
  await controller.prepare({ kind: 'document', group: 'comment', action: 'add', text: 'TUI 댓글', options: {}, label: '댓글 추가' }); await confirm(controller);
  assert((await controller.service.call(controller.state.context, 'comment', 'list')).some(row => row.body === 'TUI 댓글'));
  const exported = path.join(out, 'terminal-roundtrip.json');
  await controller.prepare({ kind: 'command', group: 'backup', action: 'export', options: { out: exported, overwrite: true }, label: '백업' }); await confirm(controller);
  const backup = JSON.parse(await fs.readFile(exported, 'utf8')); assert.equal(backup.trips[0].id, controller.state.trip.id);
  await controller.prepare({ kind: 'finalize', label: '정산 확정' }); await confirm(controller); assert(!controller.state.view.error);
  const file = path.join(out, `new-trip-${Date.now()}.json`); controller.fileForm(true); await fill(controller, 'store', file); await controller.submitForm();
  assert.equal(controller.state.view.title, '여행 추가'); await fill(controller, 'tripName', '처음 만든 여행'); await saveForm(); assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).trips[0].tripName, '처음 만든 여행');
  await controller.prepare({ kind: 'control', control: 'archive', data: {}, label: '여행 보관' }); await confirm(controller); assert(controller.state.record.archivedAt);
  await controller.prepare({ kind: 'control', control: 'restore', data: {}, label: '여행 복원' }); await confirm(controller); assert.equal(controller.state.record.archivedAt, null);
  controller.close();
}
async function testConnectionCancellation() {
  const controller = new Controller({ demo: true }); await controller.init(); const original = structuredClone(controller.state.context), trip = controller.state.trip;
  let release; controller.service.call = () => new Promise(resolve => { release = resolve; });
  const switching = controller.task(() => controller.connect({ source: 'cloud', profile: 'other' }));
  await controller.key('', { name: 'escape' }); await controller.activate(8); release([]); await switching;
  assert.deepEqual(controller.state.context, original, 'cancelled connection must keep original context'); assert.equal(controller.state.trip, trip); assert.equal(controller.state.view.title, '개발 도구'); controller.close();
  const missingLogin = new Controller({}, { service: { preferences: async () => ({ source: 'cloud', profile: 'remembered-profile' }), call: async () => { const error = new Error('로그인 필요'); error.code = 'AUTH_REQUIRED'; throw error; } } });
  await missingLogin.init(); assert.equal(missingLogin.state.context.profile, 'remembered-profile'); assert.equal(missingLogin.state.view.type, 'home'); missingLogin.close();
}
async function testCloud() {
  const fixture = await startCliFixture();
  try {
    const config = { url: fixture.origin, publishableKey: 'sb_publishable_fixture', profile: 'fixture' }, identity = { token: fixture.actors[0], user: { id: fixture.actors[0] } };
    const adapter = new CloudAdapter(config, identity, { journal: new Journal(config, identity, path.join(out, 'cloud')) });
    let trip = Domain.createTrip({ tripName: 'TUI 서버 검증', startDate: '2026-11-07', endDate: '2026-11-09' }); trip = Domain.mutate(trip, 'itinerary', 'add', { data: { date: '2026-11-07', place: '원래 장소' } });
    const created = await adapter.create(trip), context = { source: 'cloud', profile: 'fixture', trip: created.tripId };
    const service = new TerminalService({ adapterFor: async () => adapter }), captured = await service.capture(context);
    const prepared = await service.prepare(context, { kind: 'domain', group: 'itinerary', action: 'update', options: { id: trip.itineraryItems[0].id }, data: { place: 'TUI 입력' }, captured, label: '일정 수정' });
    const fresh = await adapter.read(context.trip); await adapter.apply(fresh, Domain.mutate(fresh.snapshot, 'itinerary', 'update', { id: trip.itineraryItems[0].id, data: { place: '다른 동행의 변경' } }));
    await assert.rejects(prepared.execute(), error => error.code === 'CONFLICT');
    assert.equal((await adapter.read(context.trip)).snapshot.itineraryItems[0].place, '다른 동행의 변경');
    const privacyCapture = await service.capture(context);
    const privacy = await service.prepare(context, { kind: 'control', control: 'privacy', captured: privacyCapture, data: { showMemberEmail: true }, label: '공유 설정' });
    await adapter.control(await adapter.read(context.trip), 'privacy', { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: false, _expected: { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true } });
    await privacy.execute();
    const afterPrivacy = (await adapter.read(context.trip)).privacy;
    assert.equal(afterPrivacy.allowInviteRequests, false, 'unchanged form fields must preserve another edit'); assert.equal(afterPrivacy.showMemberEmail, true);
    const stalePrivacy = await service.prepare(context, { kind: 'control', control: 'privacy', captured: privacyCapture, data: { showMemberEmail: true }, label: '이전 공유 설정' });
    await assert.rejects(stalePrivacy.execute(), error => error.code === 'CONFLICT');
  } finally { await fixture.close(); }
}
async function testRuntime() {
  const previousTerm = process.env.TERM; process.env.TERM = 'xterm-256color';
  const controller = new Controller({ demo: true }); const input = new PassThrough(); input.isTTY = true; input.isRaw = false; input.setRawMode = value => { input.isRaw = value; };
  const chunks = []; const output = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk.toString()); done(); } }); output.isTTY = true; output.columns = 120; output.rows = 38;
  const running = start({ demo: true }, { controller, input, output }); await until(() => controller.state.trip && !controller.state.busy, 'runtime did not initialize');
  input.write('s'); await until(() => controller.state.view.type === 'form' || controller.state.view.error, () => 'shortcut did not open form: ' + JSON.stringify({ title: controller.state.view.title, busy: controller.state.busy, focus: controller.state.focus, listeners: input.listenerCount('data'), raw: input.isRaw, closed: controller.state.closed, active: Boolean(controller.activeTask), context: controller.state.context })); assert.equal(controller.state.view.type, 'form', JSON.stringify({ title: controller.state.view.title, lines: controller.state.view.lines, busy: controller.state.busy }));
  input.write('\x1b[200~붙여넣기\nQ\x1b[201~'); await until(() => controller.state.view.values.place.includes('붙여넣기'), 'paste missing'); assert.equal(controller.state.closed, false);
  input.write('\n'); await until(() => controller.state.view.values.place.endsWith('\n'), 'Ctrl+J must insert a newline');
  output.columns = 80; output.rows = 24; output.emit('resize'); input.write('\x03'); await running;
  assert.equal(input.isRaw, false); const text = chunks.join(''); assert(text.includes('\x1b[?1049h')); assert(text.includes('\x1b[?1049l')); assert(text.includes('\x1b[?25h')); assert(text.includes('\x1b[?2004l')); assert.equal(input.listenerCount('data'), 0);
  if (previousTerm === undefined) delete process.env.TERM; else process.env.TERM = previousTerm;
}
async function testJobs() {
  const job = new Job({ direct: true, args: ['-e', 'console.log("running"); setInterval(()=>{},1000)'] });
  const lines = []; job.on('line', line => lines.push(line)); const done = new Promise(resolve => job.once('done', resolve)); job.start();
  await until(() => lines.includes('running'), 'child process did not start'); await job.cancel(); const result = await done;
  assert(result.cancelled); assert(job.finished);
}
async function testPlain() {
  const input = new PassThrough(); input.isTTY = true;
  const chunks = [], output = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk.toString()); done(); } }); output.isTTY = true;
  const running = start({ demo: true, plain: true }, { input, output });
  await until(() => chunks.join('').includes('번호 /'), 'plain menu missing'); input.write('m\n');
  await until(() => chunks.join('').includes('전체 메뉴'), 'plain navigation failed'); input.write('q\n'); await running;
  assert(!chunks.join('').includes('\x1b['), 'plain mode must not use ANSI');
}
async function testNoTty() {
  const result = await new Promise((resolve, reject) => { const child = spawn(process.execPath, [path.resolve(__dirname, '../bin/triplog.js'), 'ui'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); const chunks = []; child.stderr.on('data', bytes => chunks.push(bytes)); child.once('error', reject); child.once('close', code => resolve({ code, text: Buffer.concat(chunks).toString() })); });
  assert.equal(result.code, 2); assert(!result.text.includes('\x1b['));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
