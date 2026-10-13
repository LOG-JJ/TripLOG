function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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


window.TripLog.register("shared.factories", {
  createEntry,
  createId,
});
