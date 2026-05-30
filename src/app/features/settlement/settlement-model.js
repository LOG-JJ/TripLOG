function getSettlementEntriesForSource(source) {
  const entries = Array.isArray(source?.state?.entries) ? source.state.entries : [];
  return entries.map((entry, index) => ({
    key: buildSettlementEntryKey(source.id, entry, index),
    index,
    date: entry.date || "",
    category: entry.category || "기타",
    description: entry.description || "지출 항목",
    note: entry.note || "",
    amount: Math.max(0, Math.round(Number(entry.amount || 0))),
    raw: entry,
  }));
}

function addSettlementAmount(target, key, amount) {
  target[key] = (target[key] || 0) + Number(amount || 0);
}

function getEqualMemberShares(amount, members) {
  const parts = splitWholeAmount(Math.round(amount), Math.max(1, members.length));
  return Object.fromEntries(members.map((member, index) => [member.key, parts[index] || 0]));
}

function getEntrySplitSettings(entryKey) {
  const settings = getSettlementSettings();
  settings.itemSplits = settings.itemSplits || {};
  const split = settings.itemSplits[entryKey] || { mode: "equal", shares: {} };
  split.mode = split.mode === "custom" ? "custom" : "equal";
  split.shares = split.shares && typeof split.shares === "object" ? split.shares : {};
  settings.itemSplits[entryKey] = split;
  return split;
}

function seedEntryCustomShares(entry, members, split, { force = false } = {}) {
  if (!split) return;
  const currentTotal = Object.values(split.shares || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
  if (!force && currentTotal > 0) return;
  split.shares = getEqualMemberShares(entry.amount, members);
}

function getSettlementEntryAllocation(entry, members, settings = getSettlementSettings()) {
  const split = getEntrySplitSettings(entry.key);
  if (split.mode === "custom") {
    seedEntryCustomShares(entry, members, split);
  }

  const shares = split.mode === "custom"
    ? Object.fromEntries(members.map((member) => [member.key, Math.max(0, Math.round(Number(split.shares?.[member.key] || 0)))]))
    : getEqualMemberShares(entry.amount, members);

  const allocatedTotal = Object.values(shares).reduce((sum, amount) => sum + amount, 0);
  const diff = Math.round(entry.amount - allocatedTotal);
  return {
    ...entry,
    mode: split.mode,
    shares,
    allocatedTotal,
    diff,
    invalid: split.mode === "custom" && diff !== 0,
  };
}

function buildSettlementModel(selectedSource) {
  const settings = getSettlementSettings();
  const members = getSettlementMembers();
  const entries = getSettlementEntriesForSource(selectedSource);
  const entryRows = entries.map((entry) => getSettlementEntryAllocation(entry, members, settings));
  const sourceTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const outsideSpent = getCompanionTotalSpent();
  const totalTripSpent = sourceTotal + outsideSpent;
  const owedTotals = Object.fromEntries(members.map((member) => [member.key, 0]));
  const paidTotals = Object.fromEntries(members.map((member) => [member.key, member.isLeader ? sourceTotal : member.paid]));

  entryRows.forEach((row) => {
    members.forEach((member) => addSettlementAmount(owedTotals, member.key, row.shares[member.key] || 0));
  });

  (state.companions || []).forEach((companion) => {
    const spent = Math.max(0, Math.round(Number(companion.individualSpent || 0)));
    if (spent <= 0) return;
    const shares = getEqualMemberShares(spent, members);
    members.forEach((member) => addSettlementAmount(owedTotals, member.key, shares[member.key] || 0));
  });

  const memberSummaries = members.map((member) => ({
    ...member,
    paid: paidTotals[member.key] || 0,
    owed: owedTotals[member.key] || 0,
    balance: (paidTotals[member.key] || 0) - (owedTotals[member.key] || 0),
  }));
  const invalidEntries = entryRows.filter((row) => row.invalid);
  const transactions = invalidEntries.length > 0 ? [] : buildSettlementTransactions(memberSummaries);

  return {
    members,
    entries,
    entryRows,
    sourceTotal,
    outsideSpent,
    totalTripSpent,
    memberSummaries,
    invalidEntries,
    transactions,
  };
}

function buildSettlementTransactions(memberSummaries) {
  const debtors = memberSummaries
    .filter((member) => member.balance < -0.01)
    .map((member) => ({ name: member.name, balance: Math.abs(member.balance) }));
  const creditors = memberSummaries
    .filter((member) => member.balance > 0.01)
    .map((member) => ({ name: member.name, balance: member.balance }));
  const transactions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amount = Math.min(debtor.balance, creditor.balance);
    transactions.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(amount),
    });
    debtor.balance -= amount;
    creditor.balance -= amount;
    if (debtor.balance < 0.01) dIdx++;
    if (creditor.balance < 0.01) cIdx++;
  }

  return transactions;
}

function setSettlementEntrySplitMode(entryKey, mode) {
  const settings = getSettlementSettings();
  const sources = getSettlementExpenseSources(calculateTotals());
  const selectedSource = getSelectedSettlementExpenseSource(sources);
  const entry = getSettlementEntriesForSource(selectedSource).find((item) => item.key === entryKey);
  const members = getSettlementMembers();
  const split = getEntrySplitSettings(entryKey);
  split.mode = mode === "custom" ? "custom" : "equal";
  if (entry && split.mode === "custom") {
    seedEntryCustomShares(entry, members, split, { force: true });
  }
  settings.itemSplits[entryKey] = split;
  saveAndRender();
}

function updateSettlementEntryShare(entryKey, memberKey, amount) {
  const split = getEntrySplitSettings(entryKey);
  split.mode = "custom";
  split.shares[memberKey] = Math.max(0, Math.round(Number(amount || 0)));
  saveAndRender();
}

function toggleSettlementEntrySplit(entryKey) {
  const settings = getSettlementSettings();
  settings.expandedEntryKey = settings.expandedEntryKey === entryKey ? "" : entryKey;
  saveAndRender();
}


window.TripLog.register("features.settlement.model", {
  getSettlementEntriesForSource,
  addSettlementAmount,
  getEqualMemberShares,
  getEntrySplitSettings,
  seedEntryCustomShares,
  getSettlementEntryAllocation,
  buildSettlementModel,
  buildSettlementTransactions,
  setSettlementEntrySplitMode,
  updateSettlementEntryShare,
  toggleSettlementEntrySplit,
});
