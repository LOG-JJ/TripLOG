function parseTypedTime(val) {
  val = val.replace(/[^0-9:]/g, "").trim();
  if (!val) return "";
  
  if (val.includes(":")) {
    let [h, m] = val.split(":");
    let hour = parseInt(h, 10);
    let minute = parseInt(m, 10);
    if (isNaN(hour)) hour = 0;
    if (isNaN(minute)) minute = 0;
    hour = Math.max(0, Math.min(23, hour));
    minute = Math.max(0, Math.min(59, minute));
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  } else {
    if (val.length >= 3) {
      let hour = parseInt(val.substring(0, val.length - 2), 10);
      let minute = parseInt(val.substring(val.length - 2), 10);
      hour = Math.max(0, Math.min(23, hour));
      minute = Math.max(0, Math.min(59, minute));
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    } else {
      let hour = parseInt(val, 10);
      if (!isNaN(hour)) {
        hour = Math.max(0, Math.min(23, hour));
        return `${String(hour).padStart(2, "0")}:00`;
      }
    }
  }
  return "";
}

function getPrecedingItineraryItem() {
  const dayItems = getFilteredItineraryItems();
  if (dayItems.length === 0) return null;
  
  if (editingItineraryId) {
    const index = dayItems.findIndex(item => item.id === editingItineraryId);
    if (index > 0) {
      return dayItems[index - 1];
    }
  } else {
    return dayItems[dayItems.length - 1];
  }
  return null;
}

function addMinutesToTime(timeStr, mins) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  let totalMins = h * 60 + m + mins;
  totalMins = (totalMins + 1440) % 1440;
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function getMinutesBetweenTimes(startTimeStr, endTimeStr) {
  if (!startTimeStr || !endTimeStr) return 0;
  const [h1, m1] = startTimeStr.split(":").map(Number);
  const [h2, m2] = endTimeStr.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) {
    diff += 1440;
  }
  return diff;
}

window.TripLog.register("shared.timeUtils", {
  parseTypedTime,
  getPrecedingItineraryItem,
  addMinutesToTime,
  getMinutesBetweenTimes,
});
