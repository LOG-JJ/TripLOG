function createEntry(date, category, description, amount, note) {
  return {
    id: createId(),
    date,
    category,
    description,
    amount,
    note,
    mode: "domestic",
    createdAt: Date.now() + Math.floor(Math.random() * 1000),
  };
}

function createItineraryItem(date, time, place, location, memo) {
  return {
    id: createId(),
    date,
    time,
    place,
    location,
    memo,
    createdAt: Date.now() + Math.floor(Math.random() * 1000),
  };
}

window.TripLog.register("shared.factories", {
  createEntry,
  createItineraryItem,
});
