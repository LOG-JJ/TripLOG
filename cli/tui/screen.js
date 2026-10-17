'use strict';
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const palette = { bg: '#0a141d', panel: '#101f2c', fg: '#e4edf5', muted: '#91a8b9', line: '#3f7696', cyan: '#78d8f5', pink: '#f599be', yellow: '#ffe684', green: '#9ee3bc', danger: '#ffa6a6', dark: '#0a141d' };
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').normalize('NFC');
const graphemes = value => [...segmenter.segment(String(value ?? ''))].map(part => part.segment);
function charWidth(character) {
  if (/^\p{Mark}+$/u.test(character)) return 0;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20e3\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u.test(character) ? 2 : 1;
}
const width = value => graphemes(clean(value)).reduce((sum, part) => sum + charWidth(part), 0);
function clip(value, limit, ellipsis = true) {
  const text = clean(value); if (width(text) <= limit) return text;
  if (limit < 1) return '';
  let result = '', count = 0;
  for (const character of graphemes(text)) { const size = charWidth(character); if (count + size > limit - (ellipsis ? 1 : 0)) break; result += character; count += size; }
  return result + (ellipsis ? '…' : '');
}
function wrap(value, limit) {
  if (limit < 1) return [];
  const result = [];
  for (const paragraph of String(value ?? '').split(/\r?\n/)) {
    let line = '', count = 0;
    for (const character of graphemes(clean(paragraph))) {
      const size = charWidth(character); if (count + size > limit) { result.push(line); line = ''; count = 0; }
      line += character; count += size;
    }
    result.push(line);
  }
  return result;
}
function styleCode(fg = 'fg', bg = 'bg', bold = false) {
  const rgb = color => (palette[color] || color).replace('#', '').match(/../g).map(value => parseInt(value, 16)).join(';');
  return `\x1b[0;38;2;${rgb(fg)};48;2;${rgb(bg)}${bold ? ';1' : ''}m`;
}
class Screen {
  constructor(columns, rows) {
    this.columns = Math.max(1, Math.min(300, Math.floor(columns))); this.rows = Math.max(1, Math.min(120, Math.floor(rows)));
    this.cells = Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, () => ({ character: ' ', fg: 'fg', bg: 'bg', bold: false })));
    this.cursor = null;
  }
  put(x, y, value, { fg = 'fg', bg = 'bg', bold = false, max = this.columns - x } = {}) {
    if (y < 0 || y >= this.rows || x < 0 || x >= this.columns) return;
    let column = x;
    for (const character of graphemes(clip(value, Math.max(0, Math.min(max, this.columns - x)), false))) {
      const size = charWidth(character); if (!size) continue;
      if (column + size > this.columns) break;
      if (this.cells[y][column]?.continuation && column > 0) this.cells[y][column - 1] = { character: ' ', fg, bg, bold };
      if (this.cells[y][column + size]?.continuation) this.cells[y][column + size] = { character: ' ', fg, bg, bold };
      this.cells[y][column] = { character, fg, bg, bold };
      if (size === 2) this.cells[y][column + 1] = { character: '', continuation: true, fg, bg, bold };
      column += size;
    }
  }
  fill(x, y, w, h, bg = 'panel') { for (let row = y; row < y + h; row++) this.put(x, row, ' '.repeat(Math.max(0, w)), { bg }); }
  box(x, y, w, h, title = '', color = 'line') {
    if (w < 3 || h < 2) return;
    this.put(x, y, '┌' + '─'.repeat(w - 2) + '┐', { fg: color });
    this.put(x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘', { fg: color });
    for (let row = y + 1; row < y + h - 1; row++) { this.put(x, row, '│', { fg: color }); this.put(x + w - 1, row, '│', { fg: color }); }
    if (title) this.put(x + 2, y, ` ${clip(title, w - 7)} `, { fg: color, bold: true });
  }
  textLines(x, y, text, maxWidth, maxHeight, style = {}) { wrap(text, maxWidth).slice(0, maxHeight).forEach((line, index) => this.put(x, y + index, line, { ...style, max: maxWidth })); }
  lines({ color = true } = {}) {
    return this.cells.map(row => {
      let result = '', style = '';
      for (const cell of row) {
        if (cell.continuation) continue;
        const next = `${cell.fg}/${cell.bg}/${cell.bold}`;
        if (color && next !== style) { result += styleCode(cell.fg, cell.bg, cell.bold); style = next; }
        result += cell.character;
      }
      return result + (color ? '\x1b[0m' : '');
    });
  }
  plain() { return this.lines({ color: false }).join('\n'); }
  ansi() { return '\x1b[?7l\x1b[H' + this.lines().map((line, index) => `\x1b[${index + 1};1H${line}`).join('') + '\x1b[0m'; }
}
module.exports = { Screen, palette, width, clip, wrap, clean, graphemes, charWidth };
