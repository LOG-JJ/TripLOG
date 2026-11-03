(() => {
  'use strict';
  const { text:t,icon }=window.TripLog.ui.markup;
  const M=()=>window.TripLog.features.travelCompanion.toolsModel;
  const C=()=>window.TripLog.features.travelCompanion.model;
  const V=()=>window.TripLog.features.travelCompanion.toolsView;
  const $=selector=>document.querySelector(selector);
  const titles={packing:'준비물',timezone:'여행지 시간대',calendar:'캘린더 파일',sun:'일출·일몰',time:'한국 ↔ 현지 시간',wifi:'Wi-Fi 공유 QR',units:'단위 변환'};
  const source=new URL(document.currentScript.src);
  const vendorUrl=new URL('../../../../vendor/travel-tools.min.js',source); vendorUrl.search=source.search;
  let dialog,context,options,vendors,packingFilter='all',category='temperature',zoneSaving=false;
  const account=()=>window.TripLog.sync.controller.getAccount()?.id||'device';
  const sameScope=()=>context && context.trip===state.id && context.account===account();
  const editable=()=>window.TripLog.features.redesign.workspace.canEditTripSettings();
  function libraries() {
    if (window.TripLogToolsVendor) return Promise.resolve(window.TripLogToolsVendor);
    if (!vendors) vendors=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=vendorUrl.href;
      script.onload=()=>{if(window.TripLogToolsVendor)resolve(window.TripLogToolsVendor);else{script.remove();vendors=null;reject(new Error('도구를 초기화하지 못했어요. 다시 열어 주세요.'));}};
      script.onerror=()=>{script.remove();vendors=null;reject(new Error('도구를 불러오지 못했어요. 연결 후 다시 열어 주세요.'));};
      document.head.appendChild(script);
    });
    return vendors;
  }
  function controls(root=dialog) {
    root.querySelectorAll('select').forEach(select=>{ setupCustomSelect(select);syncCustomSelect(select,{rebuild:true}); });
    root.querySelectorAll('input[type=date]').forEach(input=>{setupCustomDatePicker(input);syncCustomDatePicker(input);});
    root.querySelectorAll('input[type=time]').forEach(input=>{setupCustomTimePicker(input);syncCustomTimePicker(input);});
  }
  function error(message='') { $('#ctToolError').textContent=message; }
  function footer(tool) {
    const close=V().action('닫기','close','ex-secondary');
    if(tool==='timezone') return close+`<button type="submit" form="ctZoneForm" class="ex-button ex-primary" id="ctZoneSave"${editable()?'':' disabled'}>적용</button>`;
    if(tool==='wifi') return close+'<button type="submit" form="ctWifiForm" class="ex-button ex-primary">QR 만들기</button>';
    if(tool==='calendar') return close+V().action(icon('download-simple')+' 캘린더 파일 저장','calendar-save','ex-primary');
    return close;
  }
  function refresh() {
    if (!dialog?.open) return;
    if (!sameScope()) {dialog.close();return;}
    if(context.tool==='packing') {
      $('#ctToolBody').innerHTML=V().packing(state,packingFilter);
      if(!editable()) $('#ctToolBody').querySelectorAll('input,button').forEach(control=>{control.disabled=true;});
    }
  }
  function open(tool) {
    if(!titles[tool]) return;
    if(dialog.open) dialog.close();
    context={tool,trip:state.id,account:account()};dialog.tripId=state.id;category='temperature';packingFilter='all';
    $('#ctToolTitle').textContent=titles[tool];$('#ctToolBody').innerHTML=V()[tool](state,packingFilter);$('#ctToolFooter').innerHTML=footer(tool);error();controls();
    window.TripLog.ui.dialog.open(dialog);
    if(tool==='packing') refresh();
    if(tool==='timezone') updateZone();
    if(tool==='calendar') updateCalendar();
    if(tool==='sun') updateSun();
    if(tool==='time') updateTime();
    if(tool==='units') updateUnitOptions();
  }
  function updateZone() {
    try { $('#ctZonePreview').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:$('#ctZone').value,dateStyle:'medium',timeStyle:'short'}).format(new Date());error(); }
    catch (_) {$('#ctZonePreview').textContent='시간대를 선택해 주세요';}
  }
  function calendarItems() {return state.itineraryItems.filter(item=>$('[name=ctCalendarRange]:checked').value==='all'||item.date===$('#ctCalendarDate').value);}
  function updateCalendar() {
    const rows=calendarItems(),all=$('[name=ctCalendarRange]:checked').value==='all';
    $('#ctCalendarDateField').hidden=all;
    $('#ctCalendarPreview').innerHTML=`<h2>일정 미리보기 <small>${rows.length}개</small></h2><ul class="ct-calendar-list">${rows.slice(0,5).map(row=>`<li><time>${t(V().dateLabel(row.date))}<small>${t(row.time||'종일')}${row.endTime?' – '+t(row.endTime):''}</small></time><span>${t(row.place)}</span></li>`).join('')||'<li>내보낼 일정이 없어요</li>'}</ul>${rows.length>5?'<p class="ct-muted">외 '+(rows.length-5)+'개 일정</p>':''}`;
    $('[data-tool-action=calendar-save]').disabled=!rows.length||!C().defaultZone(state);
  }
  async function updateSun() {
    const current=context,city=M().cityList(state).find(row=>row.id===$('#ctSunCity').value),date=$('#ctSunDate').value;
    if(!city) {$('#ctSunResult').innerHTML='<p class="ct-muted">도시를 선택해 주세요.</p>';return;}
    try {
      const library=await libraries();if(context!==current||!dialog.open||city.id!==$('#ctSunCity')?.value||date!==$('#ctSunDate')?.value)return;
      const sun=M().solar(city,date,library.sunCalc),duration=minutes=>`${Math.floor(minutes/60)}시간 ${minutes%60}분`;
      if(sun.polar) {$('#ctSunResult').innerHTML=`<div class="ct-result ct-blue">${icon('sun')}<strong>${sun.polar}</strong><span>이 날짜에는 해가 ${sun.polar==='백야'?'지지':'뜨지'} 않아요.</span></div>`;return;}
      const x=24+sun.progress*252,y=126-Math.sin(sun.progress*Math.PI)*88;
      $('#ctSunResult').innerHTML=`<div class="ct-sun-arc" aria-hidden="true"><svg viewBox="0 0 300 150"><path d="M24 126 Q150 -48 276 126" fill="none" stroke="#f3c231" stroke-width="2" stroke-dasharray="5 5"/><path d="M24 126 Q150 -48 276 126Z" fill="#fff5c3"/><path d="M14 128H286" stroke="#91b9d8" stroke-width="2"/>${sun.today?`<circle cx="${x}" cy="${y}" r="11" fill="#ffcf32" stroke="#d89c1a"/>`:''}</svg></div><div class="ct-sun-times"><div>${icon('sun-horizon')}<span>일출</span><strong>${sun.sunrise}</strong></div><div>${icon('sun-horizon')}<span>일몰</span><strong>${sun.sunset}</strong></div></div><div class="ct-sun-stats"><div class="ct-result ct-blue"><span>${icon('sun')} 낮 길이</span><strong>${duration(sun.minutes)}</strong></div>${sun.today?`<div class="ct-result ct-pink"><span>${icon('clock')} ${sun.untilSunset>0?'일몰까지':'오늘의 일몰'}</span><strong>${sun.untilSunset>0?duration(sun.untilSunset):'해가 졌어요'}</strong></div>`:''}</div><p class="ct-muted">${t(city.name)} · ${t(city.zone)} · 도시 중심 기준</p>`;error();
    }catch(problem){if(context===current&&dialog.open)error(problem.message);}
  }
  function updateTime() {
    try {
      const result=M().convertTime($('#ctTimeDate').value,$('#ctTimeClock').value,$('#ctTimeFrom').value,$('#ctTimeTo').value);
      $('#ctTimeResult').innerHTML=`<div class="ct-result ct-pink"><span>${result.dayDiff<0?'전날':result.dayDiff>0?'다음 날':'같은 날'} · ${t($('#ctTimeTo').selectedOptions[0].textContent)}</span><output class="ct-time-output"><time datetime="${result.date}">${V().dateLabel(result.date)}</time><b>${result.time}</b></output><small>기준 시각과 ${result.delta>0?'+':''}${result.delta}시간</small></div>`;error();
    }catch(problem){$('#ctTimeResult').replaceChildren();error(problem.message);}
  }
  function updateUnitOptions(from) {
    const values=M().units[category],selected=from||M().defaults($('#ctUnitCountry').value,category);
    $('#ctUnitFrom').innerHTML=values.map(([unit,label])=>`<option value="${t(unit)}"${unit===selected?' selected':''}>${t(unit)} · ${label}</option>`).join('');
    syncCustomSelect($('#ctUnitFrom'),{rebuild:true});updateUnit();
  }
  function updateUnit() {
    const from=$('#ctUnitFrom').value,to=M().units[category].find(([unit])=>unit!==from)[0],result=M().convertUnit($('#ctUnitValue').value,category,from);
    $('#ctUnitResult').innerHTML=`<span>변환 결과</span><output>${result===null?'—':new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4}).format(result)} <small>${t(to)}</small></output>`;
    error(result===null?'변환할 숫자를 확인해 주세요.':'');
  }
  async function submit(event) {
    if(!event.target.matches('#ctZoneForm,#ctWifiForm'))return;event.preventDefault();if(!sameScope())return;
    const current=context;
    try {
      if(event.target.id==='ctZoneForm') {
        if(zoneSaving||!editable())return;
        const zone=$('#ctZone').value;if(!zone)throw new Error('시간대를 선택해 주세요.');
        zoneSaving=true;$('#ctZoneSave').disabled=true;
        const next=normalizeTravelCompanion(state.travelCompanion,state.itineraryItems);next.timeZone=zone;
        await options.commit({travelCompanion:next});if(context===current&&sameScope())dialog.close();showToast('여행지 시간대를 적용했어요.');
      }else{
        const form=event.target,payload=M().wifiPayload(form.elements.ssid.value,form.elements.password.value,form.elements.security.value);
        const library=await libraries();if(context!==current||!sameScope()||!dialog.open)return;
        // A newer input invalidates the pending render and clears a stale QR.
        if(payload!==M().wifiPayload(form.elements.ssid.value,form.elements.password.value,form.elements.security.value))return;
        const qr=library.qrcode(0,'M');qr.addData(payload,'Byte');qr.make();
        $('#ctWifiQr').innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});
        $('#ctWifiQr svg').setAttribute('role','img');$('#ctWifiQr svg').setAttribute('aria-label','Wi-Fi 연결 QR 코드');error();
      }
    }catch(problem){if(context===current)error(problem.message||'QR을 만들지 못했어요. 입력 길이를 확인해 주세요.');}
    finally{zoneSaving=false;if($('#ctZoneSave'))$('#ctZoneSave').disabled=!editable();}
  }
  function setup(callbacks) {
    if(dialog)return;options=callbacks;
    dialog=window.TripLog.ui.dialog.create({id:'ctToolDialog',labelledBy:'ctToolTitle',className:'rd-dialog tt-dialog ct-dialog',
      markup:`<header class="tt-header"><img class="tt-logo" src="src/assets/triplog-wordmark.png" alt="TripLOG">${V().action(icon('x'),'close','ct-close','aria-label="닫기"')}</header><div class="tt-scroll ct-body"><h1 id="ctToolTitle" tabindex="-1"></h1><div id="ctToolBody"></div><p id="ctToolError" role="alert"></p></div><footer id="ctToolFooter" class="ct-footer"></footer>`,
      onClose:()=>{if(!dialog.open){context=null;$('#ctToolBody').replaceChildren();error();}}});
    document.addEventListener('click',event=>{
      const target=event.target.closest('[data-tool-action]');if(!target)return;
      const action=target.dataset.toolAction;if(titles[action]){open(action);return;}if(!sameScope())return;
      if(action==='close')dialog.close();
      if(action==='packing-filter'){packingFilter=target.dataset.filter;refresh();}
      if(action==='wifi-reveal'){const field=$('#ctWifiPassword'),show=field.type==='password';field.type=show?'text':'password';target.setAttribute('aria-pressed',String(show));target.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 표시');}
      if(action==='time-swap'){const from=$('#ctTimeFrom').value;$('#ctTimeFrom').value=$('#ctTimeTo').value;$('#ctTimeTo').value=from;controls();updateTime();}
      if(action==='unit-category'){category=target.dataset.category;dialog.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button===target)));updateUnitOptions();}
      if(action==='unit-swap')updateUnitOptions(M().units[category].find(([unit])=>unit!==$('#ctUnitFrom').value)[0]);
      if(action==='calendar-save') {
        try{const trip={...state,itineraryItems:calendarItems()},content=C().createCalendar(trip,C().defaultZone(state));
          const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=(state.tripName||'여행일정').replace(/[\\/:*?"<>|]/g,'_')+'.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);error();showToast('캘린더 파일을 저장했어요.');
        }catch(problem){error(problem.message);}
      }
    });
    dialog.addEventListener('submit',submit);
    dialog.addEventListener('change',event=>{
      if(!sameScope())return;const id=event.target.id;
      if(id==='ctZone')updateZone();
      if(id.startsWith('ctSun'))updateSun();
      if(id.startsWith('ctTime'))updateTime();
      if(id==='ctUnitCountry')updateUnitOptions();
      if(id==='ctUnitFrom')updateUnit();
      if(event.target.name==='ctCalendarRange'||id==='ctCalendarDate')updateCalendar();
      if(id==='ctWifiSecurity'){$('#ctWifiQr').innerHTML=icon('qr-code')+'<span>QR 만들기를 눌러 주세요</span>';$('#ctWifiPassword').disabled=event.target.value==='nopass';error();}
    });
    dialog.addEventListener('input',event=>{
      if(event.target.id==='ctUnitValue')updateUnit();
      if(event.target.closest('#ctWifiForm')){$('#ctWifiQr').innerHTML=icon('qr-code')+'<span>QR 만들기를 눌러 주세요</span>';error();$('#ctWifiPassword').disabled=$('#ctWifiSecurity').value==='nopass';}
    });
    const refreshClock=()=>{if(document.hidden||!dialog.open||!sameScope())return;if(context.tool==='sun')updateSun();if(context.tool==='timezone')updateZone();};
    setInterval(refreshClock,60000);
    document.addEventListener('visibilitychange',refreshClock);
  }
  window.TripLog.register('features.travelCompanion.tools',{setup,refresh,open,libraries});
})();
