function getSettlementSettings() {
  state.settlement = normalizeSettlementSettings(state.settlement);
  return state.settlement;
}

function getSettlementExpenseSources(totals = calculateTotals()) {
  historyRecords = loadHistoryRecords();
  const currentName = state.tripName || getDefaultTripName();
  const currentTotal = Number(totals?.total ?? sumEntries(state.entries));
  const currentSource = {
    id: "current",
    name: currentName,
    label: `${currentName} (현재 여행)`,
    state,
    total: currentTotal,
    entryCount: state.entries.length,
    dateRange: `${formatReadableDate(state.startDate)} - ${formatReadableDate(state.endDate)}`,
    isCurrent: true,
  };

  const savedSources = historyRecords.map((record) => {
    const snapshot = record.state || {};
    const name = snapshot.tripName || getSnapshotDefaultTripName(snapshot);
    const total = calculateSnapshotTotal(snapshot);
    const entryCount = Array.isArray(snapshot.entries) ? snapshot.entries.length : 0;
    return {
      id: record.id,
      name,
      label: `${name} · ${formatHistoryDateRange(snapshot)} · ${entryCount}건 · ${formatSettlementCurrency(total, snapshot)}`,
      state: snapshot,
      total,
      entryCount,
      dateRange: formatHistoryDateRange(snapshot),
      timestamp: record.timestamp,
      isCurrent: false,
    };
  });

  return [currentSource, ...savedSources];
}

function getSelectedSettlementExpenseSource(sources = getSettlementExpenseSources()) {
  const settings = getSettlementSettings();
  const selected = sources.find((source) => source.id === settings.sourceId) || sources[0];
  settings.sourceId = selected.id;
  return selected;
}

function getSettlementMembers() {
  const companions = state.companions || [];
  const roster = window.TripLog.features?.collaboration?.tripCollaboration?.getTripMembers?.() || [];
  const owner = roster.find(member => member.role === "owner");
  const sameMember = (companion, member) => Boolean(
    [companion.userId, companion.accountId, companion.id].filter(Boolean).includes(member.id)
    || (companion.email && member.email && companion.email.trim().toLowerCase() === member.email.trim().toLowerCase())
    || (!companion.id && !companion.userId && !companion.accountId && companion.name === member.name)
  );
  return [
    { key: "leader", name: state.settlement?.leaderName || "여행 대표", paid: 0, isLeader: true },
    ...companions.map((companion) => ({
      key: getCompanionSettlementKey(companion),
      name: companion.name,
      paid: Number(companion.individualSpent || 0),
      isLeader: false,
    })),
    ...roster.filter(member => member !== owner && member.status !== "pending"
      && !companions.some(companion => sameMember(companion, member))).map(member => ({
      key: getCompanionSettlementKey(member),
      name: member.name,
      paid: 0,
      isLeader: false,
    })),
  ];
}

function getCompanionSettlementKey(companion) {
  return `companion:${companion?.id || companion?.name || ""}`;
}

function getCompanionTotalSpent() {
  return (state.companions || []).reduce((sum, companion) => sum + Number(companion.individualSpent || 0), 0);
}

function setSettlementSource(sourceId) {
  const settings = getSettlementSettings();
  settings.sourceId = sourceId || "current";
  saveAndRender();
}

function buildSettlementEntryKey(sourceId, entry, index) {
  return `${sourceId}:${entry?.id || entry?.createdAt || index}`;
}

window.TripLog.register("features.settlement.sources", {
  getSettlementSettings,
  getSettlementExpenseSources,
  getSelectedSettlementExpenseSource,
  getSettlementMembers,
  getCompanionSettlementKey,
  getCompanionTotalSpent,
  setSettlementSource,
  buildSettlementEntryKey,
});
