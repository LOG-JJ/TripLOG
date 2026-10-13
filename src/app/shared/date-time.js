function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseTimeValue(value) {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value || "")) return null;
  const [hour, minute] = value.split(":");
  return { hour, minute };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date) {
  if (!date) return "-";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatReadableDate(value) {
  const date = parseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatHistoryTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장 시간 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatHistoryDateRange(snapshot) {
  return `${formatReadableDate(snapshot?.startDate)} - ${formatReadableDate(snapshot?.endDate)}`;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
}

function formatTripShortDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) ? `${date.getMonth() + 1}.${date.getDate()} ${'일월화수목금토'[date.getDay()]}` : '날짜 미정';
}

function formatTripPeriod(trip) { return `${formatTripShortDate(trip.startDate)} – ${formatTripShortDate(trip.endDate)}`; }

function formatTripDuration(trip) {
  const days = getTripDaysForRange(trip.startDate, trip.endDate).length;
  return days > 1 ? `${days - 1}박 ${days}일` : days ? '당일치기' : '기간 미정';
}

window.TripLog.register("shared.dateTime", {
  parseDate,
  parseTimeValue,
  padNumber,
  addDays,
  toInputDate,
  formatShortDate,
  formatReadableDate,
  formatHistoryTimestamp,
  formatHistoryDateRange,
  formatWeekday,
  formatTripShortDate,
  formatTripPeriod,
  formatTripDuration,
});
