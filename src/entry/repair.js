const status = document.getElementById('status'), retry = document.getElementById('retry');
async function repair() {
  retry.hidden = true;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await registration.update();
      const worker = registration.installing || registration.waiting;
      if (worker && worker.state !== 'activated') await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('복구 연결이 지연되고 있습니다. 다시 시도해 주세요.')), 45000);
        const check = () => {
          if (worker.state === 'installed') worker.postMessage({ type: 'TRIPLOG_REPAIR_NAVIGATION' });
          if (worker.state === 'activated') { clearTimeout(timeout); worker.removeEventListener('statechange',check); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timeout); worker.removeEventListener('statechange',check); reject(new Error('최신 화면을 다시 준비해 주세요.')); }
        };
        worker.addEventListener('statechange',check);check();
      });
      await navigator.serviceWorker.ready;
    }
    status.textContent = '복구했습니다. 여행 화면으로 이동합니다.';
    location.replace('/Travel?page=start');
  } catch (error) { status.textContent = error.message || '연결을 확인한 뒤 다시 시도해 주세요.'; retry.hidden = false; }
}
retry.addEventListener('click',repair);repair();
