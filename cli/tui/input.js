'use strict';
const { StringDecoder } = require('node:string_decoder');
class InputDecoder {
  constructor({ keyData, paste }) { this.keyData = keyData; this.paste = paste; this.decoder = new StringDecoder('utf8'); this.buffer = ''; this.pasted = ''; this.pasting = false; }
  write(chunk) {
    clearTimeout(this.timer); this.buffer += Buffer.isBuffer(chunk) ? this.decoder.write(chunk) : chunk;
    const start = '\x1b[200~', end = '\x1b[201~';
    while (this.buffer) {
      const marker = this.pasting ? end : start, index = this.buffer.indexOf(marker);
      if (index >= 0) {
        const data = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + marker.length);
        if (this.pasting) { this.pasted = (this.pasted + data).slice(0, 100000); this.paste(this.pasted); this.pasted = ''; this.pasting = false; }
        else { if (data) this.keyData(data); this.pasting = true; }
        continue;
      }
      let held = 0;
      for (let size = 1; size < marker.length; size++) if (this.buffer.endsWith(marker.slice(0, size))) held = size;
      const data = this.buffer.slice(0, this.buffer.length - held), remainder = held ? this.buffer.slice(-held) : '';
      if (this.pasting) this.pasted = (this.pasted + data).slice(0, 100000); else if (data) this.keyData(data);
      this.buffer = remainder; break;
    }
    if (this.buffer && !this.pasting) this.timer = setTimeout(() => { const pending = this.buffer; this.buffer = ''; if (pending) this.keyData(pending); }, 40);
  }
  close() { clearTimeout(this.timer); this.buffer = this.pasted = ''; }
}
module.exports = { InputDecoder };
