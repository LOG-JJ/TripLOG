(() => {
  'use strict';
  const { text:t,icon }=window.TripLog.ui.markup;
  const model=()=>window.TripLog.features.travelCompanion.toolsModel;
  const companion=()=>window.TripLog.features.travelCompanion.model;
  const action=(label,value,style='',extra='')=>`<button type="button" class="ex-button ${style}" data-tool-action="${value}" ${extra}>${label}</button>`;
  const option=(value,label,selected)=>`<option value="${t(value)}"${value===selected?' selected':''}>${t(label)}</option>`;
  const dateLabel=value=>companion().validDate(value) ? `${Number(value.slice(5,7))}.${Number(value.slice(8))} (${'일월화수목금토'[new Date(value+'T12:00:00Z').getUTCDay()]})` : '날짜 선택';
  function zoneOptions(selected) {
    let zones=[]; try { zones=Intl.supportedValuesOf('timeZone'); } catch (_) { /* Offline popular choices remain. */ }
    const labels=new Map(model().cities.map(city=>[city.zone,city.name]));
    labels.set('Asia/Seoul','서울'); labels.set('Asia/Tokyo','도쿄');
    return option('','시간대 선택',selected)+[...new Set([selected,...labels.keys(),...zones].filter(Boolean))].map(zone=>option(zone,`${labels.get(zone)||zone.split('/').at(-1).replaceAll('_',' ')} · ${zone}`,selected)).join('');
  }
  function main(trip) {
    const list=trip.packingList||[],done=list.filter(row=>row.checked).length,city=model().destination(trip),zone=companion().defaultZone(trip);
    const cards=[['timezone','globe','여행지 시간대',zone?`${city?.zone===zone?city.name+' · ':''}${zone}`:'시간대를 선택하세요','blue'],['calendar','calendar-check','캘린더 파일','.ics 파일로 저장','pink'],
      ['sun','sun-horizon','일출·일몰',city?.name||'도시·날짜로 확인','yellow'],['time','clock','한국 ↔ 현지 시간','날짜와 시간 변환','blue'],
      ['wifi','wifi-high','Wi-Fi 공유 QR','연결 정보를 간편하게','pink'],['units','ruler','단위 변환','온도 · 거리 · 무게','mint']];
    return `<div class="ct-context">${window.TripLog.ui.tripContext.render(trip)}</div><div class="ct-tools-grid">
      <button type="button" class="ct-tool ct-packing-launch" data-tool-action="packing"><i class="ph ph-backpack ct-glyph" data-tone="pink" aria-hidden="true"></i><span class="ct-tool-copy"><strong>준비물</strong><span class="ct-progress-line"><progress max="${list.length||1}" value="${done}" aria-label="준비물 완료 ${done}/${list.length}"></progress><small>${done}/${list.length}</small></span></span>${icon('caret-right')}</button>
      ${cards.map(([key,glyph,title,summary,tone])=>`<button type="button" class="ct-tool" data-tool-action="${key}"><i class="ph ph-${glyph} ct-glyph" data-tone="${tone}" aria-hidden="true"></i><span class="ct-tool-copy"><strong>${title}</strong><small>${t(summary)}</small></span>${icon('caret-right')}</button>`).join('')}</div>`;
  }
  function packing(trip,filter) {
    const list=trip.packingList||[],done=list.filter(item=>item.checked).length,rows=filter==='remaining'?list.filter(item=>!item.checked):list;
    return `<div class="ct-packing-progress"><progress max="${list.length||1}" value="${done}" aria-label="준비물 완료"></progress><b>${done}/${list.length}</b></div><form id="ttPackingAdd" class="ct-inline-add"><input name="name" aria-label="새 준비물" placeholder="새 준비물 추가" maxlength="200" required autocomplete="off"><button type="submit" class="ex-button ex-secondary" aria-label="준비물 추가">${icon('plus')}</button></form>
      <div class="ct-segments" role="group" aria-label="준비물 필터">${action('전체','packing-filter','','data-filter="all" aria-pressed="'+(filter==='all')+'"')}${action('남은 항목','packing-filter','','data-filter="remaining" aria-pressed="'+(filter==='remaining')+'"')}</div>
      <div class="ct-packing-list">${rows.map(item=>`<div class="cx-packing-row"><label><input type="checkbox" data-tt-packing="${t(item.id)}"${item.checked?' checked':''}><span>${t(item.name)}</span></label><button type="button" class="ct-icon" data-tt-action="packing-rename" data-id="${t(item.id)}" aria-label="${t(item.name)} 이름 수정">${icon('pencil-simple')}</button><button type="button" class="ct-icon" data-tt-action="packing-delete" data-id="${t(item.id)}" aria-label="${t(item.name)} 삭제">${icon('trash')}</button></div>`).join('')||'<p class="ct-muted">'+(list.length?'모두 챙겼어요!':'필요한 준비물을 추가해 보세요.')+'</p>'}</div>`;
  }
  function timezone(trip) {
    return `<form id="ctZoneForm" class="ct-form"><label>도시 / 시간대<select id="ctZone" required>${zoneOptions(companion().defaultZone(trip))}</select></label><div class="ct-result ct-blue"><span>현재 현지 시간</span><output id="ctZonePreview"></output></div><p class="ct-muted">오늘의 여행과 캘린더에 적용돼요.</p></form>`;
  }
  function calendar(trip) {
    return `${window.TripLog.ui.tripContext.render(trip)}<div class="ct-result ct-blue"><span>일정 시간대</span><b>${t(companion().defaultZone(trip)||'시간대를 먼저 선택해 주세요')}</b></div><fieldset class="ct-segments"><legend class="ct-muted">내보낼 일정</legend><label><input type="radio" name="ctCalendarRange" value="all" checked> 전체 일정</label><label><input type="radio" name="ctCalendarRange" value="day"> 날짜 선택</label></fieldset><label id="ctCalendarDateField" class="ct-field" hidden>날짜<input id="ctCalendarDate" type="date" data-compact-date="true" value="${t(companion().defaultItineraryDate(trip))}"></label><div id="ctCalendarPreview"></div><div class="ct-file">${icon('file-text')}<span>${t(trip.tripName||'여행일정')}.ics</span></div><p class="ct-muted">저장한 파일을 캘린더 앱으로 가져오세요.</p>`;
  }
  function sun(trip) {
    const cities=model().cityList(trip),city=model().destination(trip)||cities.find(row=>row.id==='destination');
    return `<div class="ct-form"><label>도시<select id="ctSunCity">${option('','도시 선택',city?.id)}${cities.map(row=>option(row.id,row.name,city?.id)).join('')}</select></label><label>날짜<input type="date" id="ctSunDate" data-compact-date="true" value="${t(companion().defaultItineraryDate(trip))}"></label></div><div id="ctSunResult" aria-live="polite"></div>`;
  }
  function time(trip) {
    const zone=companion().defaultZone(trip)||'Asia/Tokyo',now=model().parts(new Date(),'Asia/Seoul');
    return `<div class="ct-zone-pair"><label>기준 시간대<select id="ctTimeFrom">${zoneOptions('Asia/Seoul')}</select></label>${action(icon('arrows-left-right'),'time-swap','ex-secondary ct-swap','aria-label="시간대 서로 바꾸기"')}<label>변환할 시간대<select id="ctTimeTo">${zoneOptions(zone)}</select></label></div><div class="ct-form ct-input-pair"><label>날짜<input id="ctTimeDate" type="date" data-compact-date="true" value="${now.date}"></label><label>시간<input id="ctTimeClock" type="time" value="${now.time}"></label></div><div id="ctTimeResult" aria-live="polite"></div>`;
  }
  function wifi() {
    return `<form id="ctWifiForm" class="ct-form" autocomplete="off"><label>네트워크 이름 (SSID)<input name="ssid" id="ctWifiSsid" required maxlength="32" autocomplete="off" spellcheck="false" placeholder="Wi-Fi 이름"></label><label>비밀번호<span class="ct-password"><input name="password" id="ctWifiPassword" type="password" maxlength="64" autocomplete="off" spellcheck="false">${action(icon('eye'),'wifi-reveal','','aria-label="비밀번호 표시" aria-pressed="false"')}</span></label><label>보안 방식<select name="security" id="ctWifiSecurity"><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">비밀번호 없음</option></select></label><div id="ctWifiQr" class="ct-qr" aria-live="polite">${icon('qr-code')}<span>연결 정보를 입력해 주세요</span></div><small class="ct-muted">이 기기에서만 생성 · 닫으면 입력 정보가 지워져요</small></form>`;
  }
  function units(trip) {
    return `<label class="ct-field">여행지<select id="ctUnitCountry">${[['US','미국'],['GB','영국'],['SI',trip.countryCode&&!['US','GB'].includes(trip.countryCode)?`${trip.country||'여행지'} · 미터법`:'그 외 · 미터법']].map(([code,name])=>option(code,name,['US','GB'].includes(trip.countryCode)?trip.countryCode:'SI')).join('')}</select></label><div class="ct-segments" role="group" aria-label="변환 종류">${[['temperature','thermometer','온도'],['distance','ruler','거리'],['weight','scales','무게']].map(([key,glyph,label])=>action(icon(glyph)+' '+label,'unit-category','','data-category="'+key+'" aria-pressed="'+(key==='temperature')+'"')).join('')}</div><div class="ct-form"><label>변환할 값<input id="ctUnitValue" type="text" inputmode="decimal" autocomplete="off" value="20" maxlength="20"></label><label>단위<select id="ctUnitFrom"></select></label></div><div class="ct-unit-swap">${action(icon('arrows-down-up'),'unit-swap','ex-secondary','aria-label="단위 변환 방향 바꾸기"')}</div><div id="ctUnitResult" class="ct-result ct-blue" aria-live="polite"></div>`;
  }
  window.TripLog.register('features.travelCompanion.toolsView',{main,packing,timezone,calendar,sun,time,wifi,units,action,zoneOptions,dateLabel});
})();
