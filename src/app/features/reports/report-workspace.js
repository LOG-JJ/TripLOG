(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { text, money } = window.TripLog.ui.markup;
  const dateShort = formatTripShortDate;
  const members = () => window.TripLog.features.collaboration.tripCollaboration.getTripMembers();
  const M = () => window.TripLog.shared.travelCosts;
  const trendColors = [['#fff05a', '#806900'], ['#bce6fb', '#28698c'], ['#f7afc7', '#a43b65'], ['#e4e5e9', '#555b69']];
  let reportTab = 'expenses', reportDay = 'all', staySort = 'schedule';
  function drawDonut(rows) {
    const canvas=$('#rdDonut');if(!canvas)return;
    const ctx=canvas.getContext('2d'),size=400;canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);let start=-Math.PI/2;
    if(!rows.length){ctx.strokeStyle='#e4e5e9';ctx.lineWidth=80;ctx.beginPath();ctx.arc(200,200,148,0,Math.PI*2);ctx.stroke();return;}
    // Percentages live in the HTML legend at the shared metadata size.
    // Text painted into a 400px canvas became unreadable as the chart shrank.
    rows.forEach(row=>{const end=start+row.ratio*Math.PI*2;ctx.beginPath();ctx.arc(200,200,198,start,end);ctx.arc(200,200,105,end,start,true);ctx.closePath();ctx.fillStyle=row.color;ctx.fill();ctx.strokeStyle='#0b1020';ctx.lineWidth=3;ctx.stroke();start=end;});
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
    return `<section class="rd-trend"><h2>결제일별 지출</h2>
      ${bars ? `<div class="rd-chart-scroll"><div class="rd-bars${signed ? ' rd-bars-signed' : ''}" role="list" aria-label="결제일별 지출 금액과 비중" style="--bars:${trend.length}">${bars}</div></div>` : '<p class="rd-empty">지출을 기록하면 날짜별 비중을 볼 수 있어요.</p>'}
      ${bars && cost.total <= 0 ? '<p class="rd-trend-note">총 지출이 0원 이하이면 비중을 계산하지 않아요.</p>' : ''}
      <p>${cost.count}건의 지출 기록 · 결제일 기준${trend.some(row => row.date === '__pretrip__') ? ' · 사전구매 별도 집계' : ''}${signed ? ' · 0선 아래는 환불' : ''}</p>
    </section>`;
  }
  function renderReports() {
    const cost=M().summarize(state,{members:members().length}),rows=M().categoryShares(state.entries);
    $('#rdReportSummary').innerHTML=window.TripLog.ui.costSummary.render(cost);
    $('#rdReportExpenses').hidden=reportTab!=='expenses';$('#rdReportItinerary').hidden=reportTab==='expenses';if(reportTab==='itinerary')renderPlanAnalytics();
    $('#rdReportExpenseTab').classList.toggle('active',reportTab==='expenses');$('#rdReportItineraryTab').classList.toggle('active',reportTab!=='expenses');
    $('#rdReportExpenses').innerHTML=`<section class="rd-category-section"><h2>어디에 가장 많이 썼나요?</h2><div class="rd-donut-layout"><div class="rd-donut-wrap"><canvas id="rdDonut" role="img" aria-label="${text(rows.map(r=>`${r.name} ${r.percent}%`).join(', ')||'아직 지출 없음')}"></canvas><div><b>${money(cost.total)}</b><span>총 지출</span></div></div><ul class="rd-legend">${rows.map(r=>`<li><button type="button" data-rd-action="report-category" data-category="${text(r.name)}"><span style="background:${r.color}"></span><b>${text(r.name)}</b><strong>${money(r.amount)}</strong><small>${r.percent}%</small></button></li>`).join('')}</ul></div>${cost.refunds<0?`<p class="rd-muted">환불 ${money(Math.abs(cost.refunds))} 반영 · 지출 구성은 환불 전 금액 기준</p>`:''}${rows.length?'':'<p class="rd-empty">지출을 입력하면 분석을 시작해요.</p>'}</section>${renderPaymentTrend(cost)}`;drawDonut(rows);
  }
  function renderPlanAnalytics() {
    const days=getTripDays(),all=state.itineraryItems||[];
    if(reportDay!=='all'&&!days.some(day=>day.date===reportDay))reportDay='all';
    const items=sortItineraryItems(all.filter(item=>reportDay==='all'||item.date===reportDay));
    const stays=items.filter(item=>item.theme!=='lodging').map(item=>({...item,minutes:Math.max(0,getMinutesBetweenTimes(item.time,item.endTime)||0)}));
    const stayTotal=stays.reduce((n,item)=>n+item.minutes,0),transitTotal=items.reduce((n,item)=>n+getItineraryTransits(item).reduce((sum,segment)=>sum+(Number(segment.duration)||0),0),0),max=Math.max(1,...stays.map(item=>item.minutes));
    if (staySort !== 'schedule') {
      const direction = staySort === 'shortest' ? 1 : -1;
      stays.sort((a, b) => Number(b.minutes > 0) - Number(a.minutes > 0) || direction * (a.minutes - b.minutes));
    }
    const sortOptions = [['schedule', '일정순'], ['longest', '체류 시간 긴 순'], ['shortest', '체류 시간 짧은 순']];
    $('#rdPlanAnalytics').innerHTML=`<label class="rd-analysis-filter"><span>분석할 일자</span><select id="rdReportDay"><option value="all">전체 여행</option>${days.map((day,i)=>`<option value="${text(day.date)}" ${day.date===reportDay?'selected':''}>Day ${i+1} · ${dateShort(day.date)}</option>`).join('')}</select></label><div class="rd-analysis-metrics"><div><small>계획한 일정</small><strong>${items.length}개</strong></div><div><small>체류 시간</small><strong>${stayTotal}분</strong></div><div><small>이동 시간</small><strong>${transitTotal}분</strong></div></div><div class="rd-analysis-heading"><h2>장소별 체류 시간</h2><select id="rdReportStaySort" aria-label="장소별 체류 시간 정렬">${sortOptions.map(([value, label])=>`<option value="${value}"${staySort===value?' selected':''}>${label}</option>`).join('')}</select></div>${stays.length?stays.map(item=>`<button type="button" class="rd-analysis-place" data-rd-action="plan" data-id="${text(item.id)}"><span><b>${text(item.place)}</b><small>${dateShort(item.date)} · ${text(item.time||'시간 미정')}${item.endTime?' – '+text(item.endTime):''}</small></span><strong>${item.minutes?item.minutes+'분':'시간 미입력'}</strong><span class="rd-analysis-track"><i style="width:${item.minutes/max*100}%"></i></span></button>`).join(''):'<p class="rd-empty">체류 시간을 기록할 일정이 없어요.</p>'}<p class="rd-muted">숙소는 체류 시간에서 제외합니다. 입력한 시간 기준이며, 같은 시간의 일정은 중복 합산됩니다.</p>`;
  }
  function setTab(tab) { reportTab = tab; renderReports(); }
  function setDay(day) { reportDay = day; renderPlanAnalytics(); }
  function setStaySort(value) {
    staySort = ['schedule', 'longest', 'shortest'].includes(value) ? value : 'schedule';
    renderPlanAnalytics();
    setupCustomSelect($('#rdReportStaySort'));
    $('#rdReportStaySortButton')?.focus({ preventScroll: true });
  }
  window.TripLog.register('features.reports.workspace', { render: renderReports, setTab, setDay, setStaySort });
})();
