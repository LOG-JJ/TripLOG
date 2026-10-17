'use strict';
const { Screen, clip, width, wrap, graphemes } = require('./screen');
const Costs = require('../../src/app/shared/travel-costs');
const Order = require('../../src/app/shared/itinerary-order');
const Companion = require('../../src/app/features/travel-companion/model');
const sections = ['여행 개요', '일정', '지출', '예약', '준비물', '동행인·정산', '메모·댓글', '백업·리포트', '개발 도구', '연결 설정'];
function sourceLabel(state) { return state.demo ? '체험 모드 · 별도 예시 파일' : state.context.source === 'file' ? '파일 모드 · JSON' : `클라우드 · ${state.context.profile || 'default'}`; }
function visibleFields(view) { return (view.fields || []).filter(field => !field.when || field.when(view.values)); }
function ensureVisible(index, count, maximum) { return Math.max(0, Math.min(index - maximum + 1, count - maximum)); }
function render(state, columns = 120, rows = 38) {
  const screen = new Screen(columns, rows), w = screen.columns, h = screen.rows;
  if (w < 60 || h < 20) {
    screen.textLines(1, 1, 'TRIPLOG\n창을 60열 × 20행 이상으로 넓혀 주세요.\n현재 입력은 유지됩니다.\nCtrl+C: 종료', w - 2, h - 2, { fg: 'yellow' }); return screen;
  }
  const wide = w >= 96 && h >= 30, single = w < 80;
  const headerH = wide ? 5 : 3;
  screen.box(0, 0, w, headerH, '', 'cyan');
  if (wide) {
    screen.put(2, 1, '▀█▀ █▀█ █ █▀█ █   █▀█ █▀▀', { fg: 'pink', bold: true });
    screen.put(2, 2, ' █  █▀▄ █ █▀▀ █   █ █ █ █', { fg: 'pink', bold: true });
    screen.put(2, 3, ' ▀  ▀ ▀ ▀ ▀   ▀▀▀ ▀▀▀ ▀▀▀', { fg: 'pink', bold: true });
    screen.put(31, 2, '여행을 기록하는 터미널', { fg: 'fg' });
    screen.put(w - 43, 1, clip(sourceLabel(state), 39), { fg: 'cyan' });
    screen.put(w - 43, 3, clip(state.trip?.tripName || '여행을 선택해 주세요', 39), { fg: 'yellow' });
  } else {
    screen.put(2, 1, 'TRIPLOG', { fg: 'pink', bold: true });
    screen.put(12, 1, clip(sourceLabel(state), w - 15), { fg: 'cyan' });
  }
  const contentY = headerH + 1, contentH = h - contentY - 4;
  const menuW = single ? w : wide ? 25 : 22;
  const menuVisible = !single || state.focus === 'menu';
  if (menuVisible) {
    screen.box(0, contentY, menuW, contentH, 'MENU', state.focus === 'menu' ? 'cyan' : 'line');
    const spacing = contentH >= 25 ? 2 : 1;
    const menuMaximum = Math.max(1, Math.floor((contentH - 4) / spacing)), menuOffset = ensureVisible(state.navIndex, sections.length, menuMaximum);
    sections.slice(menuOffset, menuOffset + menuMaximum).forEach((label, row) => {
      const index = menuOffset + row, y = contentY + 2 + row * spacing;
      const selected = state.navIndex === index;
      if (selected) screen.fill(1, y, menuW - 2, 1, state.focus === 'menu' ? 'pink' : 'panel');
      screen.put(2, y, `${selected ? '›' : ' '} ${index === 9 ? '0' : index + 1} ${label}`, { fg: selected && state.focus === 'menu' ? 'dark' : selected ? 'pink' : 'fg', bg: selected ? state.focus === 'menu' ? 'pink' : 'panel' : 'bg', bold: selected, max: menuW - 4 });
    });
    screen.put(2, contentY + contentH - 2, clip(single ? 'Enter 선택 · Tab 본문' : 'A 여행 선택  ? 도움말', menuW - 4), { fg: 'muted' });
  }
  if (!single || state.focus !== 'menu') {
    const x = single ? 0 : menuW + 1, panelW = w - x;
    screen.box(x, contentY, panelW, contentH, state.view.title || sections[state.section], state.focus === 'content' ? 'cyan' : 'line');
    const rect = { x: x + 2, y: contentY + 2, w: panelW - 4, h: contentH - 4 };
    if (state.view.type === 'home') home(screen, state, rect, wide);
    else if (state.view.type === 'form') form(screen, state, rect);
    else if (state.view.type === 'result' || state.view.type === 'job') result(screen, state, rect);
    else if (state.view.type === 'confirm') confirmation(screen, state, rect);
    else choices(screen, state, rect);
  }
  screen.box(0, h - 3, w, 3, '', state.noticeTone === 'error' ? 'danger' : 'line');
  screen.put(2, h - 2, clip((state.busy ? '처리 중 · ' : '') + (state.notice || '방향키로 메뉴를 고르고 Enter를 누르세요.'), w - 4), { fg: state.noticeTone === 'error' ? 'danger' : 'cyan' });
  const hint = state.view.type === 'form' && state.focus === 'content' ? '↑↓ 필드  Enter 다음  ←→ 선택/커서  Ctrl+S 확인  Esc 취소' : state.view.type === 'confirm' ? '←→ 선택  PgUp/PgDn 내용 스크롤  Enter 실행  Esc 수정' : state.view.type === 'job' ? '↑↓ 로그  Esc/Ctrl+C 작업 중단  Enter 메뉴 복귀' : '↑↓ 이동  Enter 선택  Tab 패널  Esc 뒤로  A 여행선택  Q 종료';
  screen.put(2, h - 4, clip(hint, w - 4), { fg: 'muted' });
  return screen;
}
function home(screen, state, r, wide) {
  if (!state.trip) { choices(screen, state, r); return; }
  const trip = state.trip, cost = Costs.summarize(trip), reservations = Companion.reservations(trip);
  if (r.h < 14) {
    screen.put(r.x, r.y, clip(trip.tripName, r.w), { bold: true });
    screen.put(r.x, r.y + 1, clip(`${trip.startDate} ~ ${trip.endDate}`, r.w), { fg: 'cyan' });
    screen.put(r.x, r.y + 3, clip(`일정 ${(trip.itineraryItems || []).length}개   지출 ${cost.total.toLocaleString('ko-KR')}원`, r.w), { fg: 'yellow' });
    screen.put(r.x, r.y + 4, clip(`동행인 ${(trip.companions || []).length + 1}명   예약 ${reservations.length}건`, r.w), { fg: 'cyan' });
    if (r.h >= 11) {
      const first = Order.sort(trip.itineraryItems || [])[0];
      screen.put(r.x, r.y + 6, clip(first ? `${first.time || '미정'}  ${first.place}` : '아직 일정이 없습니다.', r.w), { fg: 'muted' });
    }
    const actions = state.view.choices || [], offset = ensureVisible(state.view.index || 0, actions.length, 2);
    actions.slice(offset, offset + 2).forEach((choice, row) => {
      const active = offset + row === state.view.index && state.focus === 'content', y = r.y + r.h - 2 + row;
      if (active) screen.fill(r.x, y, r.w, 1, 'yellow');
      screen.put(r.x, y, clip(`${active ? '›' : ' '} ${choice.label}`, r.w), { fg: active ? 'dark' : 'cyan', bg: active ? 'yellow' : 'bg', bold: active });
    });
    return;
  }
  screen.put(r.x, r.y, clip(trip.tripName, r.w - (wide ? 30 : 0)), { bold: true, fg: 'fg' });
  screen.put(r.x, r.y + 2, clip(`${trip.startDate || '날짜 미정'} ~ ${trip.endDate || ''}  ·  ${trip.city || trip.country || '목적지 미정'}`, r.w), { fg: 'cyan' });
  if (wide && r.w > 65) {
    const art = [String.raw`    _/\_    ___/\__     _/\_ `, String.raw` __/    \__/       \___/   \_`, ' ───  ╧╧  ────   ╧╧╧  ──────'];
    art.forEach((line, index) => screen.put(r.x + r.w - 29, r.y + index, line, { fg: index === 1 ? 'cyan' : 'line', max: 29 }));
  }
  const stats = [['일정', `${(trip.itineraryItems || []).length}개`, 'cyan'], ['누적 지출', `${cost.total.toLocaleString('ko-KR')}원`, 'yellow'], ['동행인', `${(trip.companions || []).length + 1}명`, 'pink'], ['예약', `${reservations.length}건`, 'cyan']];
  const statY = r.y + 4;
  if (wide && r.w >= 70) {
    const cw = Math.floor((r.w - 3) / 4);
    stats.forEach(([label, value, color], index) => { const x = r.x + index * (cw + 1); screen.box(x, statY, cw, 5, '', color); screen.put(x + 2, statY + 1, label, { fg: color }); screen.put(x + 2, statY + 3, clip(value, cw - 4), { fg: color, bold: true }); });
  } else {
    screen.put(r.x, statY, clip(`일정 ${stats[0][1]}   지출 ${stats[1][1]}`, r.w), { fg: 'yellow' });
    screen.put(r.x, statY + 1, clip(`동행인 ${stats[2][1]}   예약 ${stats[3][1]}`, r.w), { fg: 'cyan' });
  }
  const sectionY = statY + (wide ? 7 : 3), actions = state.view.choices || [];
  const split = wide && r.h >= 23;
  const itemsW = split ? Math.floor(r.w * 0.57) : r.w;
  if (split) {
    screen.box(r.x, sectionY - 1, itemsW, Math.max(7, r.y + r.h - sectionY + 1), '여행 일정', 'line');
    screen.box(r.x + itemsW + 1, sectionY - 1, r.w - itemsW - 1, Math.max(7, r.y + r.h - sectionY + 1), '빠른 실행', 'line');
  } else screen.put(r.x, sectionY - 1, '여행 일정', { fg: 'cyan', bold: true });
  const upcoming = Order.sort(trip.itineraryItems || []).slice(0, split ? 3 : 2);
  const left = r.x + (split ? 2 : 0);
  if (!upcoming.length) screen.put(left, sectionY + 1, '아직 일정이 없습니다.', { fg: 'muted' });
  upcoming.forEach((item, index) => {
    const y = sectionY + 1 + index * (split ? 3 : 1);
    if (y < r.y + r.h - (split ? 1 : 3)) screen.put(left, y, clip(`${(item.date || '').slice(5)} ${item.time || '미정'}  ${item.place}`, itemsW - 4), { fg: 'fg' });
  });
  const actionX = split ? r.x + itemsW + 3 : r.x, actionY = split ? sectionY + 1 : r.y + r.h - 3, actionW = split ? r.w - itemsW - 5 : r.w;
  const visible = split ? Math.min(actions.length, Math.floor((r.y + r.h - actionY) / 2)) : Math.min(actions.length, 2);
  const offset = ensureVisible(state.view.index || 0, actions.length, visible);
  for (let row = 0; row < visible; row++) {
    const index = offset + row, choice = actions[index]; if (!choice) break;
    const y = actionY + row * (split ? 2 : 1), selected = index === state.view.index && state.focus === 'content';
    if (selected) screen.fill(actionX, y, actionW, 1, 'yellow');
    screen.put(actionX, y, clip(`${selected ? '›' : ' '} ${choice.label}`, actionW), { fg: selected ? 'dark' : row === 0 ? 'pink' : 'cyan', bg: selected ? 'yellow' : 'bg', bold: selected });
  }
}
function choices(screen, state, r) {
  const view = state.view, rows = view.choices || [];
  if (view.subtitle) screen.textLines(r.x, r.y, view.subtitle, r.w, 2, { fg: 'muted' });
  const top = r.y + (view.subtitle ? 3 : 0), maximum = Math.max(1, Math.floor((r.y + r.h - top - 1) / 2));
  const filtered = rows.filter(row => !view.query || `${row.label} ${row.detail || ''}`.toLocaleLowerCase().includes(view.query.toLocaleLowerCase()));
  const index = Math.min(view.index || 0, Math.max(0, filtered.length - 1));
  const offset = ensureVisible(index, filtered.length, maximum);
  filtered.slice(offset, offset + maximum).forEach((choice, row) => {
    const selected = index === offset + row && state.focus === 'content';
    const y = top + row * 2;
    if (selected) screen.fill(r.x, y, r.w, 1, 'pink');
    screen.put(r.x, y, clip(`${selected ? '›' : ' '} ${choice.label}`, r.w), { fg: selected ? 'dark' : choice.danger ? 'danger' : 'fg', bg: selected ? 'pink' : 'bg', bold: selected });
    if (choice.detail) screen.put(r.x + 2, y + 1, clip(choice.detail, r.w - 2), { fg: 'muted' });
  });
  if (!filtered.length) screen.put(r.x, top + 1, '표시할 항목이 없습니다.', { fg: 'muted' });
  const footer = view.searching ? `검색: ${view.query || ''}▏  Enter 완료` : `${filtered.length ? index + 1 : 0} / ${filtered.length}  ${view.searchable ? '/ 검색  ' : ''}Esc 뒤로`;
  screen.put(r.x, r.y + r.h - 1, clip(footer, r.w), { fg: 'cyan' });
}
function form(screen, state, r) {
  const view = state.view, fields = visibleFields(view), selected = Math.min(view.index || 0, fields.length);
  screen.put(r.x, r.y, clip(view.subtitle || '입력 후 Ctrl+S로 변경 내용을 확인하세요.', r.w), { fg: 'muted' });
  const maximum = Math.max(1, Math.floor((r.h - 3) / 3)), offset = ensureVisible(selected, fields.length + 1, maximum);
  [...fields, { key: '__submit', label: view.submitLabel || '변경 내용 확인', type: 'submit' }].slice(offset, offset + maximum).forEach((field, row) => {
    const index = offset + row, active = selected === index && state.focus === 'content', y = r.y + 2 + row * 3;
    if (field.type === 'submit') { screen.fill(r.x, y, r.w, 1, active ? 'yellow' : 'panel'); screen.put(r.x + 1, y, `[ ${field.label} ]`, { fg: active ? 'dark' : 'yellow', bg: active ? 'yellow' : 'panel', bold: true }); return; }
    screen.put(r.x, y, clip(`${active ? '› ' : '  '}${field.label}${field.required ? ' *' : ''}`, r.w), { fg: active ? 'pink' : 'muted' });
    screen.fill(r.x, y + 1, r.w, 1, 'panel');
    const value = String(view.values[field.key] ?? '');
    let display = field.type === 'password' ? '•'.repeat(graphemes(value).length) : field.type === 'select' ? field.options.find(option => String(option.value) === value)?.label || value : value.replaceAll('\n', '↵');
    if (field.type === 'select') display = `‹ ${display} ›`;
    if (active && field.type !== 'select') {
      const parts = graphemes(display), cursor = Math.min(view.cursors?.[field.key] ?? parts.length, parts.length);
      let before = parts.slice(0, cursor).join(''), after = parts.slice(cursor).join('');
      if (width(before) > r.w - 5) { const prefix = graphemes(before); while (prefix.length && width(prefix.join('')) > r.w - 6) prefix.shift(); before = '…' + prefix.join(''); }
      display = before + '▏' + clip(after, Math.max(0, r.w - 4 - width(before)), false);
      screen.cursor = { x: r.x + 1 + width(before), y: y + 1 };
    } else display = clip(display, r.w - 3);
    screen.put(r.x + 1, y + 1, display || field.placeholder || '', { fg: value || field.type === 'select' ? 'fg' : 'muted', bg: 'panel', max: r.w - 2 });
  });
  screen.put(r.x, r.y + r.h - 1, clip(view.error || 'Tab/↑↓ 이동 · 선택 항목은 ←→ · Ctrl+J 줄바꿈', r.w), { fg: view.error ? 'danger' : 'cyan' });
}
function confirmation(screen, state, r) {
  const view = state.view;
  screen.put(r.x, r.y, clip(view.subtitle || '아래 변경을 실행합니다.', r.w), { fg: 'yellow', bold: true });
  const lines = wrap(view.summary || '', r.w), maximum = Math.max(1, r.h - 6), maxOffset = Math.max(0, lines.length - maximum), offset = Math.min(view.scroll || 0, maxOffset);
  screen.scroll = { max: maxOffset, page: maximum };
  lines.slice(offset, offset + maximum).forEach((line, index) => screen.put(r.x, r.y + 2 + index, line, { max: r.w }));
  screen.put(r.x, r.y + r.h - 4, clip(`${Math.min(lines.length, offset + maximum)} / ${lines.length} 줄 · PgUp/PgDn 스크롤`, r.w), { fg: 'muted' });
  const y = r.y + r.h - 3;
  (view.choices || []).forEach((choice, index) => {
    const active = index === view.index, x = r.x + index * Math.floor(r.w / 2), cw = Math.floor(r.w / 2) - 1;
    screen.fill(x, y, cw, 2, active ? 'yellow' : 'panel');
    screen.put(x + 1, y, clip(choice.label, cw - 2), { fg: active ? 'dark' : 'fg', bg: active ? 'yellow' : 'panel', bold: true });
  });
}
function result(screen, state, r) {
  const view = state.view;
  screen.put(r.x, r.y, clip(view.subtitle || (view.type === 'job' ? '작업 출력 · 완료 후 Enter로 돌아갑니다.' : 'Enter 또는 Esc로 돌아갑니다.'), r.w), { fg: view.error ? 'danger' : 'cyan' });
  const lines = (view.lines || []).flatMap(line => wrap(line, r.w));
  const maximum = r.h - 3, maxOffset = Math.max(0, lines.length - maximum), offset = Math.min(view.scroll ?? (view.type === 'job' ? maxOffset : 0), maxOffset);
  screen.scroll = { max: maxOffset, page: maximum };
  lines.slice(offset, offset + maximum).forEach((line, index) => screen.put(r.x, r.y + 2 + index, line, { fg: view.error ? 'danger' : 'fg', max: r.w }));
  screen.put(r.x, r.y + r.h - 1, `${Math.min(lines.length, offset + maximum)} / ${lines.length} 줄  ↑↓ 스크롤`, { fg: 'muted', max: r.w });
}
module.exports = { render, sections, sourceLabel, visibleFields };
