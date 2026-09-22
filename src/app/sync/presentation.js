(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./model") : root.TripLogSyncModel,
    typeof module === "object" && module.exports ? require("../shared/itinerary-order") : root.TripLogItineraryOrder);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TripLog?.register("sync.presentation", api);
})(typeof window === "undefined" ? globalThis : window, function (M, Order) {
  "use strict";
  const names = { itinerary: "일정", expense: "지출", packing: "준비물", participant: "참여자", reservation: "예약", trip: "여행 정보", settings: "설정", split: "분담", share: "분담", progress: "진행 상태", note_update: "공동 메모", comment: "댓글" };
  const labels = { date: "날짜", time: "시작 시간", endTime: "종료 시간", startDate: "시작일", endDate: "종료일", place: "장소", location: "주소", memo: "메모", description: "내용", amount: "금액", foreignAmount: "외화 금액", currency: "통화", currencyCode: "통화", exchangeRate: "환율", exchangeBase: "환율 기준", cost: "경비", duration: "소요 시간", trans: "이동 수단", transits: "이동 구간", syncExpense: "지출 연결", expenseId: "연결된 지출", paymentDate: "결제일", payerKey: "결제자", paymentMethod: "결제 방법", category: "분류", name: "이름", tripName: "여행 이름", totalBudget: "예산", individualSpent: "개인 지출", checked: "준비 완료", completed: "완료", locked: "잠금", title: "제목", body: "내용", voucherName: "예약 이름", voucherCode: "예약 번호", voucherFile: "첨부파일", voucherFileName: "파일 이름", country: "국가", city: "도시", travelMode: "여행 유형", timeZone: "시간대", splitMode: "분담 방식", leaderName: "기본 결제자", assigneeId: "담당자", value: "분담 내용", lat: "위도", lon: "경도" };
  const groupNames = { schedule: "시간 변경", place: "장소 변경", transit: "이동·경비 변경", voucher: "예약·첨부 변경", money: "금액 변경", payment: "결제 정보 변경", dates: "여행 기간 변경", destination: "여행지 변경", currency: "통화·환율 변경" };
  function count(record) { return (record?.conflicts || []).reduce((n, c) => n + Math.max(1, c.patches?.length || 0), 0); }
  function badge(status, record) {
    const total = count(record);
    if (status.tone === "error") return { label: "저장 확인", icon: "warning-circle" };
    if (total && status.tone === "warning") return { label: `확인 ${total}건`, icon: "warning-circle" };
    if (status.tone === "offline") return { label: "오프라인", icon: "wifi-slash" };
    if (status.tone === "saving") return { label: "저장 중", icon: "arrow-clockwise" };
    if (status.tone === "saved") return { label: status.label, icon: "check-circle" };
    return { label: status.label, icon: status.tone === "warning" ? "warning-circle" : "device-mobile" };
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value === "__pretrip__" ? "여행 전" : value || "날짜 미정";
    const [y, m, d] = value.split("-").map(Number);
    return `${m}월 ${d}일 (${["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
  }
  function text(value, key) {
    if (value == null || value === "") return "미입력";
    if (key === "voucherFile") return "첨부파일 있음";
    if (key === "update") return "공동 메모 변경 내용 보관됨";
    if (key === "expenseId") return "지출 연결됨";
    if (key === "assigneeId") return "담당자 지정됨";
    if (typeof value === "boolean") return value ? "예" : "아니요";
    if (typeof value === "number") return value.toLocaleString("ko-KR");
    if (Array.isArray(value)) return value.map(v => text(v, key)).join(" · ") || "없음";
    if (typeof value === "object") return Object.entries(value).map(([k, v]) => `${labels[k] || "항목"}: ${text(v, k)}`).join(" · ") || "없음";
    return String(value);
  }
  function flatten(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields || {})) {
      if (key.startsWith("g:") && value && typeof value === "object") Object.assign(result, value);
      else if (key.startsWith("p:")) result[key.slice(2)] = value;
    }
    return result;
  }
  function title(patch) {
    const noun = names[patch.kind] || "항목";
    if (patch.action !== "patch") return `${noun} ${patch.action === "delete" ? "삭제" : "추가"}`;
    const keys = Object.keys(patch.fields || {});
    if (keys.length === 1 && keys[0] === 'p:itineraryOrder') return '일정 순서 변경';
    if (keys.length === 1) return groupNames[keys[0].slice(2)] || `${labels[keys[0].slice(2)] || noun} 변경`;
    return `${noun} 변경`;
  }
  function comparison(record, conflict, patch) {
    const key = M.key(patch.kind, patch.id);
    const snapshotFields = conflict.snapshot ? M.encode(conflict.snapshot)[key]?.fields : null;
    const original = conflict.originalEntities?.[key] || conflict.originalEntity;
    let local = patch.action === "delete" ? null : M.clone(snapshotFields || original?.fields || patch.before || {});
    if (local) for (const [field, value] of Object.entries(patch.fields || {})) { if (value === null) delete local[field]; else local[field] = M.clone(value); }
    const current = conflict.source === "tab" ? M.encode(record.snapshot)[key] : record.base?.[key];
    const detail = conflict.details?.find(d => d.kind === patch.kind && d.id === patch.id);
    // Missing entities in a known current base mean deletion, never the old before image.
    const shared = current ? current.deleted ? null : current.fields : record.base ? null : detail?.current?.data || patch.current || null;
    const changed = patch.action === "patch" ? Object.keys(patch.fields || {}) : [...new Set([...Object.keys(local || {}), ...Object.keys(shared || {})])];
    const localItem = flatten(local), sharedItem = flatten(shared);
    const hasSchedule = changed.includes("g:schedule"), hasMoney = changed.includes("g:money");
    function orderLabel(item, isLocal) {
      const source = isLocal ? conflict.snapshot || record.snapshot : conflict.source === 'tab' ? record.snapshot : M.decode(record.base || {}, record.snapshot);
      const others = (source?.itineraryItems || []).filter(row => row.id !== patch.id && row.date === item.date);
      const ordered = Order.sort([...others, { ...item, id: patch.id }]);
      const index = ordered.findIndex(row => row.id === patch.id);
      const previous = ordered[index - 1]?.place, next = ordered[index + 1]?.place;
      return [previous ? `${previous} 다음` : '맨 처음', next ? `${next} 이전` : '맨 마지막'].join(' · ');
    }
    function side(fields, item, isLocal) {
      const absent = !fields;
      const headline = absent ? isLocal ? "삭제할 일정" : patch.action === "create" ? "아직 추가되지 않음" : "삭제된 항목" : hasSchedule ? item.time || "시간 미정" : hasMoney ? `${Number(item.amount || 0).toLocaleString("ko-KR")}원` : item.place || item.description || item.name || item.tripName || item.title || (patch.kind === "note_update" ? "공동 메모 변경" : names[patch.kind] || "항목");
      const rows = [];
      for (const field of changed) {
        const value = fields?.[field];
        if (field === "@position") { rows.push({ label: "배치 순서", value: absent ? "없음" : "변경된 위치" }); continue; }
        if (field === 'p:itineraryOrder') { rows.push({ label: '배치 순서', value: absent ? '없음' : orderLabel(item, isLocal) }); continue; }
        if (field === "p:update") { rows.push({ label: "공동 메모", value: absent ? "없음" : text(value, "update") }); continue; }
        const key = field.slice(2);
        if (field.startsWith("g:")) {
          const keys = new Set([...Object.keys(local?.[field] || {}), ...Object.keys(shared?.[field] || {})]);
          for (const child of keys) if (labels[child]) rows.push({ label: labels[child], value: text(value?.[child], child) });
        } else if (labels[key]) rows.push({ label: labels[key], value: text(value, key) });
        else rows.push({ label: "기타 변경 내용", value: field === "p:document" ? "공동 메모" : text(value, key) });
      }
      return { headline: absent && isLocal ? `${names[patch.kind] || "항목"} 삭제` : headline, caption: hasSchedule ? item.place || localItem.place || sharedItem.place || "장소 미정" : item.memo || "", date: item.date || item.startDate, schedule: hasSchedule, endTime: hasSchedule ? item.endTime : null, rows: absent ? [] : rows, absent };
    }
    return { title: title(patch), kind: names[patch.kind] || "항목", date: date(localItem.date || sharedItem.date || localItem.startDate || sharedItem.startDate), local: side(local, localItem, true), shared: side(shared, sharedItem, false), sharedLabel: conflict.source === "tab" ? "다른 탭의 내용" : "공유된 내용" };
  }
  return { count, badge, comparison, date };
});
