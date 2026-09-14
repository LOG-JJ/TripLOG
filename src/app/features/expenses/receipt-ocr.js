(function createReceiptOcr() {
  const assets = new URL('../../../../vendor/receipt-ocr/', document.currentScript.src);
  const loaders = new Map();
  let idleWorker = null;
  let idleLanguage = '';
  let idleProgressSink = null;
  let idleTimer;
  function release() {
    clearTimeout(idleTimer);
    if (idleWorker) idleWorker.terminate();
    idleWorker = null; idleLanguage = ''; idleProgressSink = null;
  }
  const abortError = () => new DOMException('인식을 취소했습니다.', 'AbortError');
  function loadScript(name) {
    if (loaders.has(name)) return loaders.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(), 25000);
      function fail() {
        clearTimeout(timer); script.remove(); loaders.delete(name);
        reject(new Error('인식 파일을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'));
      }
      script.src = new URL(name, assets).href;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = fail;
      document.head.appendChild(script);
    });
    loaders.set(name, promise);
    return promise;
  }

  function readImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 열지 못했습니다. JPG 또는 PNG 사진으로 다시 선택해 주세요.')); };
      img.src = url;
    });
  }

  async function prepareImage(file) {
    if (!file || file.size > 25 * 1024 * 1024) throw new Error('사진은 한 장당 25MB 이하로 선택해 주세요.');
    const heic = /hei[cf]/i.test(file.type + file.name);
    if (!/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      throw new Error('JPG, PNG, WebP 또는 HEIC 사진을 선택해 주세요.');
    }
    let image;
    try { image = await readImage(file); }
    catch (error) {
      if (!heic) throw error;
      await loadScript('heic2any-0.0.4.min.js');
      try {
        const converted = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        image = await readImage(Array.isArray(converted) ? converted[0] : converted);
      } catch {
        throw new Error('HEIC 사진을 변환하지 못했습니다. JPG 또는 PNG로 저장한 사진을 선택해 주세요.');
      }
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('사진 크기를 읽지 못했습니다.');
    const scale = Math.min(1, 1800 / image.naturalWidth, 10000 / image.naturalHeight,
      Math.sqrt(6000000 / (image.naturalWidth * image.naturalHeight)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = '';
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return { canvas, fingerprint: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('') };
  }

  async function recognize(canvas, language, onProgress, signal) {
    if (!['kor+eng', 'jpn+eng', 'eng'].includes(language)) throw new Error('인식 언어를 선택해 주세요.');
    let worker;
    let finished = false;
    let succeeded = false;
    let progressSink;
    let timer;
    let rejectStop;
    const stopped = new Promise((_, reject) => { rejectStop = reject; });
    const stop = () => rejectStop(abortError());
    signal.addEventListener('abort', stop, { once: true });
    timer = setTimeout(() => rejectStop(new Error('인식 시간이 초과됐습니다. 영수증 부분을 잘라 다시 시도해 주세요.')), 120000);
    const job = (async () => {
      if (signal.aborted) throw abortError();
      await loadScript('tesseract-6.0.1.min.js');
      if (finished || signal.aborted) throw abortError();
      clearTimeout(idleTimer);
      if (idleWorker && idleLanguage === language) {
        worker = idleWorker; progressSink = idleProgressSink; progressSink.current = onProgress;
        idleWorker = null; idleLanguage = ''; idleProgressSink = null;
      } else {
        release();
        progressSink = { current: onProgress };
        worker = await window.Tesseract.createWorker(language, 1, {
        workerPath: new URL('worker-6.0.1.min.js', assets).href,
        workerBlobURL: false,
        corePath: new URL('core-6.1.2/', assets).href,
        langPath: new URL('lang/', assets).href.replace(/\/$/, ''),
        cachePath: 'triplog-receipts-fast-4.1.0',
        logger: (event) => progressSink.current?.(event),
        });
      }
      if (finished || signal.aborted) { await worker.terminate(); throw abortError(); }
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1', user_defined_dpi: '300' });
      const lines = [];
      const stripHeight = 2800;
      const stride = stripHeight - 160;
      for (let top = 0; top < canvas.height; top += stride) {
        if (finished || signal.aborted) throw abortError();
        const strip = document.createElement('canvas');
        strip.width = canvas.width; strip.height = Math.min(stripHeight, canvas.height - top);
        strip.getContext('2d').drawImage(canvas, 0, top, strip.width, strip.height, 0, 0, strip.width, strip.height);
        let result;
        try { result = await worker.recognize(strip, {}, { text: true, blocks: true }); }
        finally { strip.width = strip.height = 1; }
        const recognized = (result.data.blocks || []).flatMap((block) => (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []));
        if (!recognized.length) recognized.push(...result.data.text.split('\n').map((text) => ({ text })));
        for (const line of recognized) {
          const item = { text: line.text.trim(), confidence: line.confidence,
            y: line.bbox ? (line.bbox.y0 + line.bbox.y1) / 2 + top : top + lines.length };
          if (item.text && !lines.some((other) => Math.abs(other.y - item.y) < 24 && other.text === item.text)) lines.push(item);
        }
        if (top + stripHeight >= canvas.height) break;
      }
      return lines.sort((a, b) => a.y - b.y);
    })();
    try {
      const result = await Promise.race([job, stopped]);
      succeeded = true;
      return result;
    }
    finally {
      finished = true; clearTimeout(timer); signal.removeEventListener('abort', stop);
      if (progressSink) progressSink.current = null;
      if (worker && succeeded && !signal.aborted) {
        idleWorker = worker; idleLanguage = language; idleProgressSink = progressSink;
        idleTimer = setTimeout(release, 30000);
      } else if (worker) await worker.terminate();
    }
  }
  window.TripLog.register('features.expenses.receiptOcr', { prepareImage, recognize, release });
})();
