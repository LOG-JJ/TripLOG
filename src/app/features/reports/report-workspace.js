(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { text, money, icon } = window.TripLog.ui.markup;
  const dateShort = formatTripShortDate;
  const members = () => window.TripLog.features.collaboration.tripCollaboration.getTripMembers();
  const M = () => window.TripLog.shared.travelCosts;
  const trendColors = [['#fff05a', '#806900'], ['#bce6fb', '#28698c'], ['#f7afc7', '#a43b65'], ['#e4e5e9', '#555b69']];
  let reportTab = 'expenses', reportDay = 'all', staySort = 'schedule';
  const timeColors = { stay:'#bce6fb',transit:'#f7afc7' };
  function donutPanel({ id, title, rows, total, caption, format, action, note = '', showTotal = false }) {
    const summary = rows.map(row => `${row.name} ${format(row.amount)}, ${row.percent}%`).join(', ');
    return `<section class="rd-category-section rp-panel"><h2>${text(title)}</h2><div class="rd-donut-layout"><div class="rd-donut-wrap${showTotal?' rp-donut-total':''}"><canvas id="${id}" role="img" aria-label="${text(summary || '아직 입력된 기록 없음')}"></canvas><div><b>${text(total)}</b><span>${text(caption)}</span></div></div><ul class="rd-legend">${rows.map(row => {
      const content = `<span style="background:${row.color}"></span><b>${text(row.name)}</b><strong>${text(format(row.amount))}</strong><small>${row.ratio > 0 && !row.percent ? '1% 미만' : row.percent+'%'}</small>`;
      return `<li>${action ? `<button type="button" class="rp-legend-item" data-rd-action="${action}" data-category="${text(row.name)}">${content}</button>` : `<div class="rp-legend-item">${content}</div>`}</li>`;
    }).join('')}</ul></div>${note?`<p class="rd-muted">${text(note)}</p>`:''}</section>`;
  }
  function drawDonut(rows, canvas = $('#rdDonut'), options = {}) {
    if(!canvas)return;
    const ctx=canvas.getContext('2d'),size=400;canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);let start=-Math.PI/2;
    if(!rows.length){ctx.strokeStyle='#e4e5e9';ctx.lineWidth=80;ctx.beginPath();ctx.arc(200,200,148,0,Math.PI*2);ctx.stroke();return;}
    // Percentages live in the HTML legend at the shared metadata size.
    // Text painted into a 400px canvas became unreadable as the chart shrank.
    rows.forEach(row=>{const end=start+row.ratio*Math.PI*2;ctx.beginPath();ctx.arc(200,200,198,start,end);ctx.arc(200,200,options.innerRadius || 105,end,start,true);ctx.closePath();ctx.fillStyle=row.color;ctx.fill();ctx.strokeStyle=options.stroke || '#0b1020';ctx.lineWidth=options.lineWidth || 3;ctx.stroke();start=end;});
  }
  function renderPaymentTrend(cost) {
    const trend = M().paymentTrend(state.entries);
    const max = Math.max(1, ...trend.map(row => Math.abs(row.amount)));
    const signed = trend.some(row => row.amount < 0);
    const bars = trend.map((row, index) => {
      const percent = M().percentOfTotal(row.amount, cost.total);
      const share = M().formatShare(percent);
      const [color, ink] = trendColors[index % trendColors.length];
      const size = Math.abs(row.amount) / max * (signed ? 36 : 100);
      return `<div class="rd-bar-item${row.amount < 0 ? ' is-refund' : row.amount === 0 ? ' is-zero' : ''}" role="listitem" style="--bar-size:${size}%;--bar-color:${color};--bar-ink:${ink}">
        <div class="rd-bar-label"><strong class="rd-bar-percent"${percent === null ? ' aria-label="비중 계산 불가"' : ''}>${text(share)}</strong><span class="rd-bar-amount">${money(row.amount)}</span></div>
        <div class="rd-bar" style="height:${size}%" aria-hidden="true"></div>
        <span class="rd-bar-date">${row.date === '__pretrip__' ? '사전구매' : row.date === '날짜 미지정' ? row.date : dateShort(row.date)}</span>
      </div>`;
    }).join('');
    return `<section class="rd-trend rp-panel"><h2>결제일별 지출</h2>
      ${bars ? `<div class="rd-chart-scroll"><div class="rd-bars${signed ? ' rd-bars-signed' : ''}" role="list" aria-label="결제일별 지출 금액과 비중" style="--bars:${trend.length}">${bars}</div></div>` : '<p class="rd-empty">지출을 기록하면 날짜별 비중을 볼 수 있어요.</p>'}
      ${bars && cost.total <= 0 ? '<p class="rd-trend-note">총 지출이 0원 이하이면 비중을 계산하지 않아요.</p>' : ''}
      ${signed ? '<p>0선 아래는 환불</p>' : ''}
    </section>`;
  }
  function renderReports() {
    const itinerary=reportTab==='itinerary',cost=M().summarize(state,{members:members().length});
    $('#rdReportSummary').hidden=false;
    $('#rdReportSummary').setAttribute('aria-label',itinerary?'일정 분석 요약':'여행 경비 요약');
    $('#rdReportExpenses').hidden=itinerary;$('#rdReportItinerary').hidden=!itinerary;
    for(const [id,active] of [['rdReportExpenseTab',!itinerary],['rdReportItineraryTab',itinerary]]) {
      $('#'+id).classList.toggle('active',active);$('#'+id).setAttribute('aria-pressed',String(active));
    }
    if(itinerary) { renderPlanAnalytics();return; }
    renderReportSummary(analysisData().data,cost);
    const rows=M().categoryShares(state.entries);
    $('#rdReportExpenses').innerHTML='<div class="rp-analysis-grid">'+donutPanel({id:'rdDonut',title:'어디에 가장 많이 썼나요?',rows,total:money(cost.total),caption:'총 지출',format:money,action:'report-category',note:cost.refunds<0?'환불 '+money(Math.abs(cost.refunds))+' 반영 · 지출 구성은 환불 전 금액 기준':''})+renderPaymentTrend(cost)+'</div>';
    drawDonut(rows);
  }
  let analysisTrip = '', analysisReturn = null, missingDialog;
  const planModel = () => window.TripLog.features.travelCompanion.model;
  const planView = () => window.TripLog.features.travelCompanion.view;
  function analysisData() {
    const days=getTripDays();
    if(analysisTrip!==state.id) {reportDay='all';staySort='schedule';analysisTrip=state.id;analysisReturn=null;}
    if(reportDay!=='all'&&!days.some(day=>day.date===reportDay))reportDay='all';
    return {days,data:planModel().analysis(state,reportDay,staySort)};
  }
  function renderReportSummary(data,cost=M().summarize(state,{members:members().length})) {
    const summary=window.TripLog.ui.costSummary,label=planView().duration;
    const plan=summary.renderMetrics({primary:{label:'계획 일정',value:data.count.toLocaleString('ko-KR')+'개',icon:'calendar-blank'},facts:[
      {label:'체류',value:label(data.stayMinutes),icon:'clock',tone:'yellow'},
      {label:'이동',value:label(data.transitMinutes),icon:'car',tone:'pink'},
    ]});
    // Both variants share one intrinsic grid row. Its height accommodates the
    // larger content, so long amounts/durations cannot move the tab rail.
    $('#rdReportSummary').innerHTML=[['expenses',summary.render(cost)],['itinerary',plan]].map(([tab,content])=>`<div class="rp-summary-slot" aria-hidden="${tab!==reportTab}"${tab===reportTab?'':' inert'}>${content}</div>`).join('');
  }
  function openAnalysisItem(row) {
    const item = findItineraryItem(row.itemId); if (!item) return;
    analysisReturn = { trip: state.id, date: reportDay, sort: staySort, scroll: scrollY };
    missingDialog?.close();
    window.TripLog.features.redesign.workspace.navigate('itinerary', { date: item.date });
    if (row.kind === 'transit') {
      const current = planModel().dayItems(state, item.date), index = current.findIndex(value => value.id === item.id);
      if (index < 1 || current[index - 1].id !== row.previousId) { showToast('이동 구간이 변경됐어요. 현재 일정을 다시 확인해 주세요.'); return; }
      window.TripLog.features.itinerary.transitEditor.open(item.id, row.previousId, undefined, { initialView: 'manual', segmentIndex: row.segmentIndex });
    } else startItineraryEdit(item);
  }
  function showMissing() {
    if (!missingDialog) {
      missingDialog = window.TripLog.ui.dialog.create({ id: 'rdAnalysisMissing', className: 'rd-dialog tt-dialog cx-sheet', labelledBy: 'rdAnalysisMissingTitle', markup: '<header class="tt-header"><h1 id="rdAnalysisMissingTitle" tabindex="-1">미입력 항목</h1><button type="button" class="tt-button tt-icon" data-analysis-close aria-label="닫기"><i class="ph ph-x" aria-hidden="true"></i></button></header><div class="tt-scroll" id="rdAnalysisMissingBody"></div>' });
      missingDialog.addEventListener('click', event => {
        if (event.target.closest('[data-analysis-close]')) missingDialog.close();
        const target = event.target.closest('[data-missing-index]');
        if (target) { const row = planModel().analysis(state, reportDay).missing[Number(target.dataset.missingIndex)]; if (row) openAnalysisItem(row); }
      });
    }
    const missing = planModel().analysis(state, reportDay).missing;
    $('#rdAnalysisMissingBody').innerHTML = ['stay', 'transit'].map(kind => {
      const rows = missing.map((row, index) => ({ row, index })).filter(value => value.row.kind === kind);
      return rows.length ? `<section class="cx-missing-section"><h2>${kind === 'stay' ? '체류 시간' : '이동 시간'} 미입력 · ${rows.length}${kind === 'stay' ? '곳' : '구간'}</h2>${rows.map(({ row, index }) => `<div class="cx-missing-row"><span>${text(row.kind === 'transit' ? row.from + ' → ' + row.title : row.title)}<small>${row.kind === 'transit' ? (row.segmentIndex + 1) + '번째 이동 구간' : '시작·종료 시간을 입력해 주세요.'}</small></span><button type="button" data-missing-index="${index}">시간 입력</button></div>`).join('')}</section>` : '';
    }).join('') || '<p class="cx-empty-line">모든 시간이 입력되어 있어요.</p>';
    window.TripLog.ui.dialog.open(missingDialog);
  }
  function renderPlanAnalytics() {
    const {days,data}=analysisData(),label=planView().duration;
    $('#rdPlanAnalytics').style.setProperty('--rp-stay',timeColors.stay);
    $('#rdPlanAnalytics').style.setProperty('--rp-transit',timeColors.transit);
    const total=data.stayMinutes+data.transitMinutes;
    const rows=[{name:'체류',amount:data.stayMinutes,color:timeColors.stay},{name:'이동',amount:data.transitMinutes,color:timeColors.transit}].map(row=>({...row,ratio:total?row.amount/total:0,percent:total?Math.round(row.amount/total*100):0}));
    renderReportSummary(data);
    const maxMinutes=Math.max(60,...data.groups.map(day=>day.stayMinutes+day.transitMinutes));
    const step=Math.max(1,Math.ceil(maxMinutes/60/4)),maximum=step*4*60;
    const maxStay=Math.max(1,...data.stays.map(row=>row.minutes||0));
    const note='입력한 계획 시간의 합계입니다. 체류는 숙소·교통 테마를 제외하고, 이동은 인접 장소 사이 구간을 합산합니다. 겹치는 일정 시간도 합산하며 미입력 시간은 포함하지 않습니다.';
    const bars=data.groups.map((day,index)=>{
      const minutes=day.stayMinutes+day.transitMinutes,size=minutes/maximum*100;
      return `<button type="button" class="rd-bar-item rp-day-bar${minutes ? '' : ' is-zero'}" data-analysis-day="${day.date}" aria-pressed="${day.date===reportDay}" aria-label="Day ${index+1}, 체류 ${label(day.stayMinutes)}, 이동 ${label(day.transitMinutes)}${day.missing.length?', 미입력 '+day.missing.length+'개':''}" style="--bar-size:${size}%">
        <span class="rd-bar-label"><strong>${minutes?label(minutes):day.missing.length?'미입력':'0분'}</strong></span>
        <span class="rd-bar rp-day-stack" style="height:${size}%" aria-hidden="true"><span class="rp-bar-stay" style="height:${minutes?day.stayMinutes/minutes*100:0}%"></span><span class="rp-bar-transit" style="height:${minutes?day.transitMinutes/minutes*100:0}%"></span></span>
        <span class="rd-bar-date"><b>Day ${index+1}</b><small>${dateShort(day.date)}${day.missing.length?' '+icon('question'):''}</small></span></button>`;
    }).join('');
    const places=data.stays.map(item=>`<button type="button" class="rp-time-place" data-analysis-item="${text(item.id)}" aria-label="${text(item.place+' · '+dateShort(item.date)+' · '+label(item.minutes))}">
      ${planView().image(item,32)}<span class="rp-place-copy"><b>${text(item.place)}</b><small>${dateShort(item.date)} · ${text(item.time||'시각 미정')}${item.endTime?' – '+text(item.endTime):''}</small></span>
      <span class="rp-place-track" aria-hidden="true"><i style="width:${(item.minutes||0)/maxStay*100}%"></i></span><strong>${label(item.minutes)}</strong></button>`).join('');
    $('#rdPlanAnalytics').innerHTML=`<div class="rp-analysis-toolbar"><label class="rp-period"><select id="rdReportDay" aria-label="분석할 일자"><option value="all">전체 여행</option>${days.map((day,index)=>`<option value="${text(day.date)}"${day.date===reportDay?' selected':''}>Day ${index+1} · ${dateShort(day.date)}</option>`).join('')}</select></label><span class="rp-basis" title="${text(note)}">계획 기준 ${icon('question')}</span>${data.missing.length?`<button type="button" class="ex-button rp-missing" data-analysis-missing aria-label="미입력 ${data.missing.length}개 확인">미입력 ${data.missing.length}</button>`:''}</div>
      <div class="rp-analysis-grid">${donutPanel({id:'rdTimeDonut',title:'시간을 어떻게 쓰나요?',rows,total:label(total),caption:'입력된 시간',format:label,showTotal:true})}
      <section class="rd-trend rp-panel rp-time-trend"><div class="rp-panel-heading"><h2>날짜별 체류·이동</h2><small>입력한 시간 기준</small></div><div class="rp-time-chart"><div class="rp-time-axis" aria-hidden="true">${[4,3,2,1,0].map(tick=>`<span>${tick?tick*step+'시간':'0'}</span>`).join('')}</div><div class="rd-chart-scroll"><div class="rd-bars" style="--bars:${days.length}">${bars}</div></div></div></section></div>
      <section class="rp-panel rp-place-panel"><div class="rp-panel-heading"><h2>장소별 체류 시간</h2><select id="rdReportStaySort" aria-label="장소별 체류 시간 정렬">${[['schedule','일정순'],['longest','긴 순'],['shortest','짧은 순']].map(([value,name])=>`<option value="${value}"${staySort===value?' selected':''}>${name}</option>`).join('')}</select></div>${places||'<p class="rd-empty">분석할 장소 일정이 없어요.</p>'}</section><p class="rp-analysis-note">${text(note)}</p>`;
    setupCustomSelect($('#rdReportDay'));setupCustomSelect($('#rdReportStaySort'));
    drawDonut(total?rows.filter(row=>row.amount>0):[],$('#rdTimeDonut'));
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-analysis-missing]')) showMissing();
    const day = event.target.closest('[data-analysis-day]'); if (day) setDay(day.dataset.analysisDay);
    const place = event.target.closest('[data-analysis-item]'); if (place) openAnalysisItem({ itemId: place.dataset.analysisItem, kind: 'stay' });
  });
  document.addEventListener('close', event => {
    if (!analysisReturn || !['itineraryEditor', 'itineraryTransitDialog'].includes(event.target.id)) return;
    const saved = analysisReturn; analysisReturn = null;
    if (saved.trip !== state.id) return;
    setTimeout(() => { if (saved.trip !== state.id) return; window.TripLog.features.redesign.workspace.navigate('report'); reportTab = 'itinerary'; reportDay = saved.date; staySort = saved.sort; renderReports(); scrollTo({ top: saved.scroll }); }, 0);
  }, true);
  function setTab(tab) { reportTab = tab === 'itinerary' ? 'itinerary' : 'expenses'; renderReports(); }
  function setDay(day) { reportDay = day; renderPlanAnalytics(); }
  function setStaySort(value) {
    staySort = ['schedule', 'longest', 'shortest'].includes(value) ? value : 'schedule';
    renderPlanAnalytics();
    setupCustomSelect($('#rdReportStaySort'));
    $('#rdReportStaySortButton')?.focus({ preventScroll: true });
  }
  window.TripLog.register('features.reports.workspace', { render: renderReports, setTab, setDay, setStaySort, drawDonut });
})();
