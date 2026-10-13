(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { icon, text, button } = window.TripLog.ui.markup;
  const duration = formatTripDuration;
  function renderPacking() {
    const list=state.packingList||[],done=list.filter(i=>i.checked).length;$('#itineraryToolsDialog [data-rd-trip]').textContent=`${state.tripName} · ${duration(state)}`;
    $('#rdPacking').innerHTML=`<div class="rd-pack-metric">${icon('suitcase-rolling')}<span><strong>${done} / ${list.length}개</strong><b>준비 완료</b></span></div><progress max="${list.length||1}" value="${done}" aria-label="준비물 완료"></progress><p class="rd-muted">${list.length-done?`${list.length-done}가지만 더 챙기면 준비 끝!`:'여행 준비를 마쳤어요!'}</p><div class="rd-pack-list">${list.map((item,i)=>`<div class="rd-pack-row"><label><input type="checkbox" data-rd-pack="${text(item.id)}" ${item.checked?'checked':''}><span>${text(item.name)}</span></label><div class="rd-pack-controls">${button(icon('arrow-up'),'packing-up','rd-icon-button',`data-id="${text(item.id)}" aria-label="${text(item.name)} 위로 이동" ${i?'':'disabled'}`)}${button(icon('trash'),'packing-delete','rd-icon-button',`data-id="${text(item.id)}" aria-label="${text(item.name)} 삭제"`)}</div></div>`).join('')}</div>`;
  }
  window.TripLog.register('features.packing.workspace', { render: renderPacking });
})();
