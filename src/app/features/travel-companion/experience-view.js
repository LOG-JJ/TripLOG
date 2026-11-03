(() => {
  'use strict';
  const M = () => window.TripLog.features.travelCompanion.model;
  const t = value => M().esc(value);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const button = (label, action, cls = '', attrs = '') => `<button type="button" class="tt-button ${cls}" data-tt-action="${action}" ${attrs}>${label}</button>`;
  const art = item => window.TripLog.shared.itineraryArt.resolve(item).colorIcon;
  const image = (item, size = 28) => `<img src="${t(art(item))}" alt="" width="${size}" height="${size}">`;
  const date = value => M().validDate(value) ? `${Number(value.slice(5, 7))}.${Number(value.slice(8))} (${'일월화수목금토'[new Date(`${value}T12:00:00Z`).getUTCDay()]})` : '날짜 미정';
  const duration = minutes => minutes === null ? '미입력' : minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
  const money = value => `${Math.round(value || 0).toLocaleString('ko-KR')}원`;
  function context(trip, selected, caption = '') {
    return `<div class="cx-context"><span><b>${t(trip.tripName || '나의 여행')}</b>${caption ? `<small>${t(caption)}</small>` : ''}</span><select id="ttDay" aria-label="여행 일자">${M().days(trip).map((day, i) => `<option value="${day}"${day === selected ? ' selected' : ''}>Day ${i + 1} · ${date(day)}</option>`).join('')}</select></div>`;
  }
  function stopList(items, title, action = 'itinerary-edit', header = '') {
    if (!items.length) return '';
    return `<section class="cx-timeline cx-surface">${header}${title ? `<div class="cx-section-title"><h2>${title}</h2><span>${items.length}개</span></div>` : ''}${items.map(item => `<div class="cx-stop"><span class="cx-stop-mark" aria-hidden="true"></span><time>${t(item.time || '미정')}</time>${image(item)}${button(`<b>${t(item.place)}</b>${item.location ? `<small>${t(item.location)}</small>` : ''}`, action, 'cx-stop-title', `data-id="${t(item.id)}"`)}${action === 'complete' ? icon('caret-left') : ''}</div>`).join('')}</section>`;
  }
  function todayControls(trip, selected, hasUndo) {
    return `${button(`${icon('arrow-u-up-left')}<span>Undo</span>`, 'progress-undo', 'cx-history-back', `aria-label="방금 조작 되돌리기"${hasUndo ? '' : ' disabled'}`)}<select id="ttDay" aria-label="여행 일자">${M().days(trip).map((day, i) => `<option value="${day}"${day === selected ? ' selected' : ''}>Day ${i + 1} · ${date(day)}</option>`).join('')}</select>`;
  }
  function todayIdentity(trip, data) {
    const total = data.items.length, done = data.completed.length;
    const marks = Array.from({ length: 5 }, (_, i) => {
      const fill = total ? Math.max(0, Math.min(1, done / total * 5 - i)) * 100 : 0;
      return `<i style="--cx-progress-fill:${fill}%" aria-hidden="true"></i>`;
    }).join('');
    return `<div class="cx-today-context">${window.TripLog.ui.tripContext.render(trip)}<div class="cx-day-progress" role="progressbar" aria-label="일정 방문 완료" aria-valuemin="0" aria-valuemax="${total || 1}" aria-valuenow="${done}" aria-valuetext="전체 ${total}개 중 ${done}개 완료"><span>${marks}</span><small aria-hidden="true">${done}/${total}</small></div></div>`;
  }
  function today(trip, selected, personal) {
    const data = M().progress(trip, selected, personal), next = data.next, cost = M().dailySpending(trip, selected);
    const reservation = M().reservationForItem(trip, next), stays = M().activeStays(trip, selected);
    const index = next ? data.items.indexOf(next) : -1;
    const legs = index > 0 ? (next.transits?.length ? next.transits : [{ trans: next.trans, duration: next.duration }]) : [];
    const nextCard = next ? `<section class="cx-next cx-surface" aria-label="다음 장소"><div class="cx-next-place"><time>${t(next.time || '시각 미정')}</time>${image(next, 32)}<div class="cx-next-copy"><h2>${button(t(next.place), 'copy-text', 'cx-copy-title', `data-value="${t(next.place)}" aria-label="장소 이름 복사"`)}</h2>${button(`<span>${t(next.location || '등록된 주소가 없어요')}</span>${next.location ? icon('copy') : ''}`, 'copy-text', 'cx-address', `data-value="${t(next.location)}" aria-label="주소 복사"${next.location ? '' : ' disabled'}`)}</div>${button(icon('pencil-simple'), 'itinerary-edit', 'cx-icon cx-next-edit', `data-id="${t(next.id)}" aria-label="다음 장소 편집"`)}</div><div class="cx-next-actions">${button(`${icon('check')}<span>방문 완료</span>`, 'complete', 'cx-done', `data-id="${t(next.id)}" aria-label="${t(next.place)} 완료하기"`)}<a class="tt-button tt-primary" href="${t(M().directions(next, trip))}" target="_blank" rel="noopener noreferrer">${icon('navigation-arrow')} 길찾기</a>${button('건너뛰기', 'skip', 'cx-skip', `data-id="${t(next.id)}"`)}</div></section>` : `<section class="cx-surface cx-finished">${icon(data.allDone ? 'check-circle' : 'calendar-blank')}<h2>${data.allDone ? '오늘의 여행을 마쳤어요' : data.items.length ? '선택한 구간을 마쳤어요' : '이날 일정이 없어요'}</h2><p>${data.allDone ? `${data.completed.length}개 방문 완료` : data.items.length ? '남겨둔 일정을 확인하거나 다른 일정부터 시작하세요.' : '가고 싶은 장소를 일정에 추가해 보세요.'}</p>${button(data.items.length ? `${icon('play')} Start here` : '일정 추가', data.items.length ? 'start-picker' : 'itinerary-new', 'tt-primary')}</section>`;
    const quick = `<div class="cx-quick-actions">${reservation?.reference ? button(`${icon('ticket')}<span><b>예약번호</b><small>복사하기</small></span>`, 'copy', '', `data-id="${t(reservation.id)}"`) : ''}${button(`${icon('wallet')}<span><b>+ 지출</b><small>바로 기록</small></span>`, 'quick-expense', '', next ? `data-id="${t(next.id)}"` : '')}${stays.length ? button(`<img src="src/assets/noto-emoji/emoji_u1f3e0.svg" alt="" width="24" height="24"><span><b>숙소로</b><small>길찾기</small></span>`, 'stay-directions') : ''}</div>`;
    const linked = reservation ? button(`${icon('ticket')}<span><small>연결된 예약</small><b>${t(reservation.reference || reservation.title)}</b></span><span class="cx-reservation-caption">${t(reservation.title)}</span>${icon('caret-right')}`, 'reservation-detail', 'cx-linked-reservation', `data-id="${t(reservation.id)}"`) : '';
    const transit = legs.length ? `<section class="cx-transits"><h2>${icon('path')} 이동 정보</h2><div>${legs.map((leg, i) => {
      const mode = leg.trans === 'etc' ? 'flight' : leg.trans, info = (window.itineraryTransitModes || itineraryTransitModes)[mode] || { icon: 'path', label: '이동' };
      return `${i ? icon('arrow-right') : ''}${button(`${icon(info.icon)}<span>${t(leg.lineName || info.label)} <b>${Number(leg.duration) > 0 ? `${Math.round(leg.duration)}분` : '—분'}</b></span>`, 'transit-edit', '', `data-id="${t(next.id)}" data-segment="${i}" aria-label="${i + 1}번째 이동 정보 수정"`)}`;
    }).join('')}</div></section>` : '';
    const upcoming = `<div class="cx-section-title cx-upcoming-title"><h2>다음 일정</h2>${button(`${icon('play')}<span>Start here</span>`, 'start-picker', 'cx-start-here', 'aria-label="여기부터 시작할 일정 선택"')}</div>`;
    const remaining = data.remaining.filter(item => !data.earlier.some(earlier => earlier.id === item.id));
    const completed = data.completed.length ? `<details class="cx-completed"><summary>완료 일정 <b>${data.completed.length}개</b> ${icon('caret-down')}</summary>${stopList(data.completed, '완료 일정', 'complete')}</details>` : '';
    return `${todayIdentity(trip, data)}<div class="cx-today-grid"><div>${nextCard}${quick}${linked}${transit}</div><div>${remaining.length ? stopList(remaining, '', 'itinerary-edit', upcoming) : upcoming}${stopList(data.earlier, '앞에 남겨둔 일정')}${stopList(data.skipped, '취소 일정', 'resume')}</div></div>${button(`<img src="icons/cost-summary-wallet.png" width="28" height="28" alt=""><span>오늘 지출 <strong>${money(cost.dayTotal)}</strong><small>· ${cost.dayCount}건</small></span>${icon('caret-right')}`, 'cost-info', 'cx-cost-strip')}${completed}`;
  }
  function spendingRows(trip, selected) {
    return window.TripLog.shared.travelCosts.categoryShares(M().validDate(selected) ? (trip.entries || []).filter(entry => entry.date === selected) : []);
  }
  function expenseCategoryImage(row) {
    const paths = { '식비': '1f37d', '교통': '1f686', '숙소': '1f3e8', '숙박': '1f3e8', '쇼핑': '1f6cd' };
    return paths[row.name] ? `<img src="src/assets/noto-emoji/emoji_u${paths[row.name]}.svg" width="23" height="23" alt="">` : icon(row.icon);
  }
  function spendingDetail(trip, selected) {
    const cost = M().dailySpending(trip, selected), rows = spendingRows(trip, selected);
    const refund = (trip.entries || []).filter(entry => entry.date === selected).reduce((sum, entry) => sum + Math.min(0, window.TripLog.shared.travelCosts.amount(entry)), 0);
    const display = value => money(value).replaceAll(',', ',<wbr>');
    return `<p class="cx-spend-date trip-context-meta">${icon('calendar-blank')}<time${M().validDate(selected) ? ` datetime="${t(selected)}"` : ''}>${date(selected)}</time><span class="trip-context-duration">${cost.dayCount}건</span></p><div class="cx-spend-donut"><canvas id="ttDayDonut" role="img" aria-label="${t(rows.length ? `환불 전 결제 구성: ${rows.map(row => `${row.name} ${row.percent}%`).join(', ')}` : '이날 기록된 결제 없음')}"></canvas><div><strong class="${money(cost.dayTotal).length > 11 ? 'is-long' : ''}">${display(cost.dayTotal)}</strong><span>${cost.dayCount}건</span></div></div><div class="cx-spend-categories">${rows.length ? rows.map(row => `<div class="cx-spend-category"><i class="cx-spend-key" style="background:${row.color}" aria-hidden="true"></i>${expenseCategoryImage(row)}<span>${t(row.name)}</span><strong>${display(row.amount)}</strong><small>${row.percent}%</small></div>`).join('') : '<p class="cx-spend-empty">이날 기록한 결제는 없어요.</p>'}</div><section class="cx-spend-total"><button type="button" class="cx-spend-total-link" data-tt-action="expenses-open" aria-label="전체 누적 지출 내역 보기">${icon('chart-bar')}<span><small>전체 누적</small><strong>${display(cost.total)} <span>· ${cost.count}건</span></strong></span>${icon('caret-right')}</button><div class="cx-spend-pretrip">${icon('ticket')}<span>사전구매 포함</span><strong>${display(cost.pretrip)}</strong></div>${refund < 0 ? `<p class="cx-spend-refund">${icon('minus-circle')}<span>환불 ${money(Math.abs(refund))} 차감 반영 · 구성비는 환불 전 결제 기준</span></p>` : ''}</section>`;
  }
  function walletRow(row, featured = false) {
    const item = { place: row.title, theme: row.type === 'stay' ? 'lodging' : row.type === 'transport' ? 'transport' : 'sightseeing', transportReservation: { kind: row.transportKind } };
    const link = M().safeUrl(row.ticketUrl || row.url);
    return `<article class="cx-booking cx-surface${featured ? ' is-today' : ''}" data-reservation-id="${t(row.id)}"><div class="cx-booking-main">${image(item, 44)}<div><time>${t(row.time || (row.type === 'stay' ? `${date(row.date)}–${date(row.endDate)}` : '시간 미정'))}</time>${button(`<b>${t(row.title)}</b>`, 'reservation-detail', 'cx-booking-title', `data-id="${t(row.id)}" data-occurrence="${t(row.occurrenceId)}"`)}${row.reference ? button(`${icon('ticket')}<span>${t(row.reference)}</span>${icon('copy')}`, 'copy', 'cx-booking-reference', `data-id="${t(row.id)}" aria-label="${t(row.title)} 예약번호 복사"`) : '<small class="cx-muted">예약번호 미입력</small>'}</div>${button(icon('pencil-simple'), row.source === 'manual' ? 'reservation-edit' : 'reservation-source', 'cx-icon', `data-id="${t(row.id)}" aria-label="${t(row.title)} 수정"`)}</div><div class="cx-booking-actions">${link ? `<a class="tt-button tt-primary" href="${t(link)}" target="_blank" rel="noopener noreferrer">${icon('ticket')} ${row.ticketUrl ? '티켓 열기' : '예약 열기'}</a>` : button(`${icon('ticket')} 예약정보 보기`, 'reservation-detail', 'tt-primary', `data-id="${t(row.id)}" data-occurrence="${t(row.occurrenceId)}"`)}${button(`상세 보기 ${icon('caret-down')}`, 'reservation-detail', 'cx-text', `data-id="${t(row.id)}" data-occurrence="${t(row.occurrenceId)}"`)}</div></article>`;
  }
  function walletList(trip, rows, filtered = false) {
    if (!rows.length) return `<p class="cx-empty-line">${filtered ? '조건에 맞는 예약이 없어요.' : '아직 등록한 예약이 없어요.'}</p>`;
    const today = M().dateInZone(M().defaultZone(trip) || undefined);
    const current = rows.filter(row => row.date === today && row.type !== 'stay');
    const past = rows.filter(row => (row.type === 'stay' ? row.endDate || row.date : row.date) < today);
    const future = rows.filter(row => !current.includes(row) && !past.includes(row));
    const groups = new Map(); future.forEach(row => { const key = row.date || ''; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
    return `<section class="cx-needed"><h2>오늘 필요한 예약 <small>${date(today)}</small></h2>${current.length ? current.map(row => walletRow(row, true)).join('') : '<p class="cx-empty-line">오늘 이용할 예약이 없어요.</p>'}</section>${[...groups].map(([key, list]) => `<section class="cx-booking-day"><h2>${date(key)}${list.every(row => row.type === 'stay') ? ' · 숙소' : ''}</h2>${list.map(row => walletRow(row)).join('')}</section>`).join('')}${past.length ? `<details class="cx-past"><summary>${icon('clock-counter-clockwise')} 지난 예약 <b>${past.length}건</b>${icon('caret-down')}</summary>${past.map(row => `<div class="cx-past-date">${date(row.date)}</div>${walletRow(row)}`).join('')}</details>` : ''}`;
  }
  function tools(trip) { return window.TripLog.features.travelCompanion.toolsView.main(trip); }
  function offline(trip, options) {
    return `<div class="cx-export-options">${[['itinerary', 'calendar-blank', '일정', `${trip.itineraryItems.length}개 여행 일정과 장소`], ['references', 'ticket', '예약정보', '예약번호와 메모 포함'], ['costs', 'wallet', '기록된 경비', '실제로 기록한 지출 요약']].map(([key, glyph, title, description]) => `<label><input type="checkbox" data-tt-option="${key}"${options[key] ? ' checked' : ''}>${icon(glyph)}<span><b>${title}</b><small>${description}</small></span></label>`).join('')}</div><section class="cx-export-preview"><h2>저장될 내용</h2><b>${t(trip.tripName)}</b><p>${[options.itinerary ? '여행 일정' : '', options.references ? '예약정보·번호' : '', options.costs ? '기록된 경비' : ''].filter(Boolean).join(' · ') || '저장할 정보를 선택해 주세요.'}</p><small>저장한 시점의 정보 · 외부 지도/링크는 연결 필요</small></section>`;
  }
  window.TripLog.register('features.travelCompanion.view', { today, todayControls, spendingDetail, spendingRows, walletRow, walletList, tools, offline, context, image, icon, duration, date });
})();
