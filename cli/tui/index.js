'use strict';
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const { fail } = require('../lib/errors');
const { Controller } = require('./controller');
const { render, visibleFields } = require('./render');
const { InputDecoder } = require('./input');
async function start(options = {}, dependencies = {}) {
  const input = dependencies.input || process.stdin, output = dependencies.output || process.stdout;
  if (!input.isTTY || !output.isTTY) fail('USAGE', '대화형 화면은 실제 터미널에서 실행해 주세요: npm run terminal (자동화는 기존 --json 명령을 사용합니다.)');
  const controller = dependencies.controller || new Controller(options, dependencies);
  if (options.plain || process.env.TERM === 'dumb') return plain(controller, input, output);
  const keys = new PassThrough(); readline.emitKeypressEvents(keys);
  const decoder = new InputDecoder({ keyData: data => keys.write(data), paste: text => controller.paste(text) });
  const wasRaw = Boolean(input.isRaw); let previous = [], active = true, scheduled = false;
  const color = !options.noColor && process.env.NO_COLOR === undefined;
  function draw(force = false) {
    if (!active) return;
    const screen = render(controller.state, output.columns || 120, output.rows || 38), lines = screen.lines({ color }); let frame = '';
    controller.scrollRange = { view: controller.state.view, ...screen.scroll };
    if (force || previous.length !== lines.length) { frame += '\x1b[2J'; previous = []; }
    lines.forEach((line, index) => { if (previous[index] !== line) frame += `\x1b[${index + 1};1H${line}\x1b[0m`; });
    frame += screen.cursor ? `\x1b[${screen.cursor.y + 1};${screen.cursor.x + 1}H\x1b[?25h` : '\x1b[?25l';
    if (frame) output.write(frame); previous = lines;
  }
  const schedule = () => { if (!scheduled && active) { scheduled = true; queueMicrotask(() => { scheduled = false; draw(); }); } };
  const onData = chunk => decoder.write(chunk);
  const onKey = (character, key) => {
    // readline calls LF "enter"; CR is the ordinary Enter key in raw terminals.
    const normalized = key?.sequence === '\n' ? { ...key, name: 'j', ctrl: true } : key;
    Promise.resolve(controller.key(character, normalized)).catch(error => controller.error(error));
  };
  const resize = () => draw(true), signal = () => controller.close();
  const cleanup = result => {
    if (!active) return; active = false; decoder.close(); keys.removeAllListeners(); keys.destroy(); input.removeListener('data', onData); output.removeListener('resize', resize);
    process.removeListener('SIGTERM', signal); process.removeListener('SIGINT', signal); process.removeListener('exit', exit);
    controller.removeListener('change', schedule); input.setRawMode?.(wasRaw); if (!wasRaw) input.pause();
    output.write('\x1b[0m\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[?1049l');
    output.write(result?.pendingWrite ? 'TripLOG 종료: 전송 중인 변경은 요청 기록에서 결과를 확인해 주세요.\n' : 'TripLOG 터미널을 종료했습니다.\n');
  };
  const exit = () => cleanup();
  output.write('\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?2004h'); input.setRawMode?.(true); input.resume();
  input.on('data', onData); keys.on('keypress', onKey); output.on('resize', resize); controller.on('change', schedule); process.once('SIGTERM', signal); process.once('SIGINT', signal); process.once('exit', exit);
  const done = new Promise(resolve => controller.once('close', result => { cleanup(result); resolve(); }));
  try { draw(true); await controller.init(); await done; } finally { cleanup(); }
}
async function plain(controller, input, output) {
  const rl = readline.createInterface({ input, output, terminal: false }); let closed = false, pending;
  const question = prompt => new Promise(resolve => { if (closed) return resolve('q'); pending = resolve; rl.question(prompt, answer => { pending = null; resolve(answer); }); });
  const signal = () => { controller.close(); rl.close(); };
  rl.on('SIGINT', signal); process.once('SIGINT', signal); process.once('SIGTERM', signal);
  rl.on('close', () => { closed = true; pending?.('q'); pending = null; });
  controller.state.focus = 'content'; await controller.init();
  try {
    while (!controller.state.closed && !closed) {
      const state = controller.state, view = state.view;
      output.write(`\nTRIPLOG · ${view.title}\n${state.trip?.tripName || ''}\n`);
      if (view.type === 'form') {
        for (const field of visibleFields(view)) {
          if (field.type === 'password') { output.write('비밀번호 입력은 기본 TUI 화면에서 지원합니다. --plain 없이 다시 실행해 주세요.\n'); controller.back(); break; }
          const options = field.type === 'select' ? field.options.map(option => `${option.value}=${option.label}`).join(', ') : '';
          const value = await question(`${field.label} ${options} [${view.values[field.key] || ''}]: `);
          if (value === ':back') { controller.back(); break; }
          if (value !== '') view.values[field.key] = value;
        }
        if (controller.state.view === view) await controller.submitForm();
      } else if (view.type === 'result' || view.type === 'job') {
        output.write((view.lines || []).join('\n') + '\n');
        await question(view.running ? '중단하려면 Enter: ' : '돌아가려면 Enter: ');
        if (controller.job) await controller.job.cancel(); else if (view.onBack) await view.onBack(); else controller.back();
      } else {
        if (view.summary) output.write(view.summary + '\n');
        (view.choices || []).forEach((choice, index) => output.write(`${index + 1}. ${choice.label}\n`));
        const answer = await question('번호 / m 전체 메뉴 / b 뒤로 / q 종료 > ');
        if (answer === 'q') controller.close();
        else if (answer === 'b') controller.back();
        else if (answer === 'm') controller.menu('전체 메뉴', require('./render').sections.map((label, index) => ({ label, run: () => controller.activate(index) })));
        else { const choice = view.choices?.[Number(answer) - 1]; if (choice) await choice.run(); }
      }
    }
  } finally { controller.close(); rl.close(); process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); }
}
module.exports = { start, plain };
