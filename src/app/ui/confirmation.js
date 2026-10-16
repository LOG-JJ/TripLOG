(() => {
  'use strict';

  // Keep destructive copy together so every entry point describes the same effect.
  const presets = {
    itinerary: { title: '일정을 삭제할까요?' },
    'itinerary-linked': { title: '일정을 삭제할까요?', message: '연결된 지출도 함께 삭제돼요.' },
    expense: { title: '지출을 삭제할까요?' },
    reservation: { title: '예약을 삭제할까요?', message: '연결된 일정과 지출은 유지돼요.' },
    trip: { title: '여행을 삭제할까요?', message: '이 기기의 목록에서만 삭제돼요.\n복구 기록에서 다시 열 수 있어요.' },
    'shared-trip': { title: '공유 여행을 보관할까요?', message: '모든 멤버가 읽기 전용으로 바뀌어요.\n복구 기록에서 다시 열 수 있어요.', confirmLabel: '보관' },
    history: { title: '저장 기록을 삭제할까요?', message: '현재 여행은 유지돼요.' },
    draft: { title: '초안을 삭제할까요?', message: '아직 저장하지 않은 내용이 지워져요.' },
    packing: { title: '준비물을 삭제할까요?' },
    'packing-reset': { title: '기본 목록으로 바꿀까요?', message: '추가한 준비물과 체크 상태가 사라져요.', confirmLabel: '초기화' },
    comment: { title: '댓글을 삭제할까요?', message: '동행에게도 삭제돼요.' },
    companion: { title: '정산 멤버를 삭제할까요?', message: '추가 지출과 분담 설정도 삭제돼요.' },
    member: { title: '멤버를 내보낼까요?', message: '여행 접근 권한을 해제해요.\n이미 받은 사본은 남아 있어요.', confirmLabel: '내보내기' },
    leave: { title: '공유 여행에서 나갈까요?', message: '미전송 내용과 복구 사본은 기기에 남아요.', confirmLabel: '나가기' },
    'map-key': { title: '지도 API 키를 삭제할까요?', subject: 'Google 지도', message: 'Google 좌표 검색이 꺼져요.' },
    reset: { title: '저장 기록을 초기화할까요?', message: '저장 기록은 모두 삭제돼요.\n기존 여행을 남기고 새 여행을 만들어요.', confirmLabel: '초기화' },
  };
  let dialog, pending;

  function setup() {
    if (dialog) return;
    dialog = window.TripLog.ui.dialog.create({
      id: 'rdConfirm', className: 'rd-dialog tl-confirm', dismissOutside: true,
      fallbackFocus: () => document.getElementById('rdMenuButton'),
      markup: `<div class="tl-confirm-content"><h2 id="rdConfirmTitle"></h2><div id="rdConfirmMessage"><p id="rdConfirmSubject" hidden></p><p id="rdConfirmDescription" hidden></p></div></div><div class="tl-confirm-actions"><button type="button" id="rdConfirmCancel">취소</button><button type="button" id="rdConfirmAccept" data-rd-action="confirm-accept">삭제</button></div>`,
      onClose: () => {
        const resolve = pending; pending = null;
        resolve?.(dialog.returnValue === 'confirm');
      },
    });
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.querySelector('#rdConfirmCancel').addEventListener('click', () => dialog.close('cancel'));
    dialog.querySelector('#rdConfirmAccept').addEventListener('click', () => dialog.close('confirm'));
    // Escape dismisses only this confirmation, including over older overlay editors.
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); dialog.close('cancel'); });
  }

  function ask(options = {}) {
    setup();
    if (pending || dialog.open) return Promise.resolve(false);
    if (typeof options === 'string') options = { message: options };
    const preset = presets[options.kind];
    const values = { title: '계속할까요?', subject: '', message: '', confirmLabel: preset ? '삭제' : '확인', tone: preset ? 'danger' : 'neutral', ...preset, ...options };
    dialog.querySelector('#rdConfirmTitle').textContent = values.title;
    for (const [id, value] of [['rdConfirmSubject', values.subject], ['rdConfirmDescription', values.message]]) {
      const node = dialog.querySelector(`#${id}`);
      node.textContent = String(value || ''); node.hidden = !value;
    }
    const subject = dialog.querySelector('#rdConfirmSubject');
    subject.removeAttribute('tabindex');
    const message = dialog.querySelector('#rdConfirmMessage');
    message.hidden = !values.subject && !values.message;
    if (message.hidden) dialog.removeAttribute('aria-describedby');
    else dialog.setAttribute('aria-describedby', 'rdConfirmMessage');
    dialog.dataset.tone = values.tone;
    dialog.dataset.kind = values.kind || 'confirmation';
    dialog.querySelector('#rdConfirmAccept').textContent = values.confirmLabel;
    dialog.returnValue = '';
    return new Promise(resolve => {
      pending = resolve;
      window.TripLog.ui.dialog.open(dialog, { focusTitle: false });
      if (subject.scrollHeight > subject.clientHeight + 1) subject.tabIndex = 0;
      dialog.querySelector('#rdConfirmCancel').focus({ preventScroll: true });
    });
  }

  window.TripLog.register('ui.confirmation', { setup, ask });
})();
