function getSettlementEntriesForSource(source) {
  const entries = Array.isArray(source?.state?.entries) ? source.state.entries : [];
  return entries.map((entry, index) => ({
    key: buildSettlementEntryKey(source.id, entry, index), index,
    date: entry.date || '', category: entry.category || '기타',
    description: entry.description || '지출 항목', note: entry.note || '',
    amount: Number(entry.amount || 0), raw: entry,
  })).sort((a, b) => compareExpenseEntryDates(a, b)
    || Number(a.raw?.createdAt || 0) - Number(b.raw?.createdAt || 0) || a.index - b.index);
}

function addSettlementAmount(target, key, amount) {
  target[key] = (target[key] || 0) + Number(amount || 0);
}

function getEqualMemberShares(amount, members) {
  if (!Number.isSafeInteger(amount)) return Object.fromEntries(members.map(member => [member.key, 0]));
  const count = Math.max(1, members.length), value = Math.abs(amount), sign = amount < 0 ? -1 : 1;
  const base = Math.floor(value / count), remainder = value % count;
  return Object.fromEntries(members.map((member, index) => [member.key, sign * (base + (index < remainder ? 1 : 0))]));
}

// Reading a settlement must never create or overwrite expense allocations.
function getEntrySplitSettings(entryKey, settings = state.settlement || {}) {
  const saved = settings.itemSplits?.[entryKey];
  return { mode: saved?.mode === 'custom' ? 'custom' : 'equal', shares: { ...(saved?.shares || {}) } };
}

function seedEntryCustomShares(entry, members, split, { force = false } = {}) {
  if (split && (force || !Object.keys(split.shares || {}).length)) split.shares = getEqualMemberShares(entry.amount, members);
}

function getSettlementEntryAllocation(entry, members, settings = state.settlement || {}) {
  const split = getEntrySplitSettings(entry.key, settings), keys = new Set(members.map(member => member.key));
  const shares = split.mode === 'custom'
    ? Object.fromEntries(members.map(member => [member.key, Number(split.shares[member.key] ?? 0)]))
    : getEqualMemberShares(entry.amount, members);
  const unknownShares = split.mode === 'custom' && Object.entries(split.shares).some(([key, value]) => !keys.has(key) && Number(value) !== 0);
  const invalidShares = Object.values(shares).some(value => !Number.isSafeInteger(value) || (entry.amount >= 0 ? value < 0 : value > 0));
  const allocatedTotal = Object.values(shares).reduce((sum, amount) => sum + amount, 0);
  const diff = entry.amount - allocatedTotal;
  return { ...entry, mode: split.mode, shares, allocatedTotal, diff, unknownShares,
    invalid: !Number.isSafeInteger(entry.amount) || !Number.isSafeInteger(allocatedTotal) || invalidShares || unknownShares || diff !== 0 };
}

function buildSettlementModel(selectedSource) {
  const settings = state.settlement || {}, members = getSettlementMembers();
  const entries = getSettlementEntriesForSource(selectedSource);
  const entryRows = entries.map(entry => {
    const allocation = getSettlementEntryAllocation(entry, members, settings);
    const unknownPayer = Boolean(entry.raw?.payerKey && !members.some(member => member.key === entry.raw.payerKey));
    return { ...allocation, unknownPayer, invalid: allocation.invalid || unknownPayer };
  });
  const sourceTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const legacyExpenses = (state.companions || []).filter(companion => Number(companion.individualSpent || 0) !== 0);
  const outsideSpent = legacyExpenses.reduce((sum, companion) => sum + Number(companion.individualSpent || 0), 0);
  const owedTotals = Object.fromEntries(members.map(member => [member.key, 0]));
  const paidTotals = Object.fromEntries(members.map(member => [member.key, 0]));
  entries.forEach(entry => {
    const payer = members.some(member => member.key === entry.raw?.payerKey) ? entry.raw.payerKey : 'leader';
    addSettlementAmount(paidTotals, payer, entry.amount);
  });
  entryRows.forEach(row => members.forEach(member => addSettlementAmount(owedTotals, member.key, row.shares[member.key] || 0)));
  const memberSummaries = members.map(member => ({ ...member,
    paid: paidTotals[member.key], owed: owedTotals[member.key], balance: paidTotals[member.key] - owedTotals[member.key],
  }));
  const invalidEntries = entryRows.filter(row => row.invalid);
  const invalidTotal = !Number.isSafeInteger(sourceTotal) || memberSummaries.some(member =>
    [member.paid, member.owed, member.balance].some(value => !Number.isSafeInteger(value)));
  const needsLegacyMigration = legacyExpenses.length > 0;
  const blocked = invalidEntries.length > 0 || invalidTotal || needsLegacyMigration;
  return { members, entries, entryRows, sourceTotal, outsideSpent, totalTripSpent: sourceTotal,
    memberSummaries, invalidEntries, invalidTotal, legacyExpenses, needsLegacyMigration, blocked,
    transactions: blocked ? [] : buildSettlementTransactions(memberSummaries) };
}

function buildSettlementTransactions(memberSummaries) {
  const debtors = memberSummaries.filter(member => member.balance < 0).map(member => ({ ...member, balance: -member.balance }));
  const creditors = memberSummaries.filter(member => member.balance > 0).map(member => ({ ...member }));
  const transactions = [];
  let dIdx = 0, cIdx = 0;
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx], creditor = creditors[cIdx], amount = Math.min(debtor.balance, creditor.balance);
    transactions.push({ from: debtor.name, to: creditor.name, fromKey: debtor.key, toKey: creditor.key, amount });
    debtor.balance -= amount; creditor.balance -= amount;
    if (!debtor.balance) dIdx++;
    if (!creditor.balance) cIdx++;
  }
  return transactions;
}

// Retained for older callers. The active UI edits allocations through the expense editor.
function setSettlementEntrySplitMode(entryKey, mode) {
  const settings = getSettlementSettings(), split = getEntrySplitSettings(entryKey, settings);
  split.mode = mode === 'custom' ? 'custom' : 'equal';
  const entry = getSettlementEntriesForSource({ id: 'current', state }).find(item => item.key === entryKey);
  if (entry && split.mode === 'custom') seedEntryCustomShares(entry, getSettlementMembers(), split);
  settings.itemSplits[entryKey] = split;
  return saveAndRender();
}

function updateSettlementEntryShare(entryKey, memberKey, amount) {
  const settings = getSettlementSettings(), split = getEntrySplitSettings(entryKey, settings);
  split.mode = 'custom'; split.shares[memberKey] = Math.max(0, Math.round(Number(amount || 0)));
  settings.itemSplits[entryKey] = split;
  return saveAndRender();
}

function toggleSettlementEntrySplit(entryKey) {
  const settings = getSettlementSettings();
  settings.expandedEntryKey = settings.expandedEntryKey === entryKey ? '' : entryKey;
  return saveAndRender();
}

window.TripLog.register('features.settlement.model', { getSettlementEntriesForSource, addSettlementAmount,
  getEqualMemberShares, getEntrySplitSettings, seedEntryCustomShares, getSettlementEntryAllocation,
  buildSettlementModel, buildSettlementTransactions, setSettlementEntrySplitMode, updateSettlementEntryShare, toggleSettlementEntrySplit });
