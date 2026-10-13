(() => {
  'use strict';
  const { text } = window.TripLog.ui.markup;
  const rendered = new WeakMap();
  const dayMs = 86400000;

  function dateInfo(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return { value, stamp: date.getTime(), year: value.slice(0, 4), weekday: '일월화수목금토'[date.getUTCDay()] };
  }

  function describe(trip = {}) {
    const start = dateInfo(trip.startDate), end = dateInfo(trip.endDate);
    const validRange = Boolean(start && end && end.stamp >= start.stamp);
    const days = validRange ? Math.round((end.stamp - start.stamp) / dayMs) + 1 : 0;
    const label = (date, withYear) => `${date.value.slice(withYear ? 0 : 5).replaceAll('-', '.')} ${date.weekday}`;
    return {
      name: String(trip.tripName || '').trim() || '새로운 여행',
      start: start && { value: start.value, label: label(start, true) },
      end: end && { value: end.value, label: label(end, !start || start.year !== end.year) },
      startMissing: trip.startDate ? '출발일 확인 필요' : '출발일 미정',
      endMissing: trip.endDate ? '종료일 확인 필요' : '종료일 미정',
      days,
      sameDay: validRange && days === 1,
      duration: days > 1 ? `${days - 1}박 ${days}일` : days === 1 ? '당일치기' : '',
      reversed: Boolean(start && end && !validRange),
      emptyLabel: trip.startDate || trip.endDate ? '여행 날짜 확인 필요' : '여행 기간 미정',
    };
  }

  function render(trip) {
    const info = describe(trip);
    const date = (value, fallback) => value ? `<time datetime="${value.value}">${text(value.label)}</time>` : `<span>${text(fallback)}</span>`;
    const badge = info.duration ? ` <span class="trip-context-duration">${text(info.duration)}</span>` : '';
    let period;
    if (!info.start && !info.end) period = `<span>${info.emptyLabel}</span>`;
    else if (info.sameDay) period = `<span class="trip-context-range-end">${date(info.start)}${badge}</span>`;
    else period = `${date(info.start, info.startMissing)} <span class="trip-context-range-end"><span class="trip-context-separator">–</span> ${date(info.end, info.endMissing)}${badge}</span>${info.reversed ? ' <span class="trip-context-date-note">기간 확인 필요</span>' : ''}`;
    return `<div class="trip-context" role="group" aria-label="여행 정보">
      <img class="trip-context-art" src="./src/assets/trip-context-landscape.png" width="56" height="44" alt="" aria-hidden="true" />
      <div class="trip-context-copy">
        <p class="trip-context-name" title="${text(info.name)}">${text(info.name)}</p>
        <p class="trip-context-meta">${period}</p>
      </div>
    </div>`;
  }

  function update(trip) {
    const markup = render(trip);
    document.querySelectorAll('[data-trip-context]').forEach(mount => {
      if (rendered.get(mount) === markup) return;
      mount.innerHTML = markup;
      rendered.set(mount, markup);
    });
  }

  window.TripLog.register('ui.tripContext', { describe, render, update });
})();
