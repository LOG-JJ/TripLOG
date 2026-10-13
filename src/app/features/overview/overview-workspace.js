(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { icon, text, button } = window.TripLog.ui.markup;
  const dateShort = formatTripShortDate, period = formatTripPeriod, duration = formatTripDuration;
  const members = () => window.TripLog.features.collaboration.tripCollaboration.getTripMembers();
  const M = () => window.TripLog.shared.travelCosts;
  function renderOverview() {
    const bookings = window.TripLog.features.travelCompanion.model.reservations(state);
    const team = members(), cost = window.TripLog.shared.travelCosts.summarize(state, { members: team.length });
    const days = getTripDays(), validDates = new Set(days.map(day => day.date));
    const plans = sortItineraryItems(state.itineraryItems.filter(item => validDates.has(item.date)));
    const today = M().localDate();
    const scheduleDate = validDates.has(today) ? today : plans[0]?.date || state.startDate;
    const scheduleDay = days.find(day => day.date === scheduleDate);
    const scheduleTitle = scheduleDate === today ? '오늘 일정' : scheduleDate === state.startDate ? '첫날 일정' : `${scheduleDay?.label || ''} 일정`;
    const items = plans.filter(item => item.date === scheduleDate).slice(0, 5), packing = state.packingList || [];
    const overviewCard = window.TripLog.features.overview.card;
    $('#rdOverview').innerHTML = `
      ${window.TripLog.features.overview.tripHero.render({ trip: state, countdown: window.TripLog.features.home.tripLibrary.badge(state), period: period(state), duration: duration(state), memberCount: team.length, expanded: !!$('#rdTripChooser')?.open })}
      ${window.TripLog.features.overview.reservationPockets.render(bookings)}
      ${window.TripLog.features.overview.travelCostCard.render({ cost, categories: M().categoryShares(state.entries) })}
      ${overviewCard.render({ className: 'rd-key-schedule', labelledBy: 'rdOverviewScheduleTitle', header: overviewCard.header({ title: scheduleTitle, titleId: 'rdOverviewScheduleTitle', iconName: 'calendar-blank', meta: dateShort(scheduleDate), action: { action: 'all-itinerary', label: '전체 보기' } }), content: items.length ? items.map((item, index) => `<button type="button" class="rd-plan-row" data-rd-action="plan" data-id="${text(item.id)}" aria-label="${text(item.time || '시간 미정')} ${text(item.place || '장소 미정')} 일정 수정"><time>${text(item.time || '미정')}</time><span class="rd-plan-dot rd-plan-dot-${index}" aria-hidden="true"></span>${icon(itineraryThemes[item.theme]?.icon || 'map-pin')}<b>${text(item.place || '장소 미정')}</b></button>`).join('') : `<div class="rd-overview-empty"><p>아직 등록한 일정이 없어요.</p>${button(`${icon('plus')} 첫 일정 추가`, 'overview-add-plan', 'rd-empty-add', `data-date="${text(scheduleDate)}"`)}</div>` })}
      ${overviewCard.render({ variant: 'action', className: 'rd-button rd-packing-summary', attributes: { 'data-rd-action': 'packing' }, content: `${icon('clipboard-text')}<strong>준비물</strong><small>${packing.filter(item => item.checked).length} / ${packing.length}개 완료</small>${icon('caret-right')}` })}
      <div class="rd-page-footer">${button(`일정 보러 가기 ${icon('caret-right')}`, 'overview-itinerary', 'rd-primary', `data-date="${text(scheduleDate)}"`)}</div>`;
  }
  window.TripLog.register('features.overview.workspace', { render: renderOverview });
})();
