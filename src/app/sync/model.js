(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TripLogSyncModel = api;
  root.TripLog?.register("sync.model", api);
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  const collections = { itinerary: "itineraryItems", expense: "entries", packing: "packingList", participant: "companions" };
  const localKeys = new Set(["id", "theme", "selectedDate", "selectedItineraryDate", "lastActiveItineraryDate", "selectedItineraryId", "collaboration", "travelCompanion", "settlement", ...Object.values(collections)]);
  const groups = {
    itinerary: {
      schedule: ["date", "time", "endTime"],
      place: ["place", "location", "lat", "lon", "mapQuery", "coordinateSource", "coordinateSignature", "coordinatePrecision", "coordinateAddress", "googlePlaceId"],
      transit: ["trans", "transits", "duration", "cost", "syncExpense", "expenseId"],
      voucher: ["voucherName", "voucherCode", "voucherFile", "voucherFileName"],
    },
    expense: {
      money: ["amount", "foreignAmount", "currency", "exchangeRate", "exchangeBase", "mode"],
      payment: ["paymentDate", "payerKey", "paymentMethod"],
    },
    trip: {
      dates: ["startDate", "endDate"],
      destination: ["travelMode", "country", "countryCode", "city"],
      currency: ["currencyCode", "currencySymbol", "currencyUnit", "exchangeBase", "exchangeRate", "exchangeRateSource", "exchangeRateUpdatedAt", "currencyAutoMatchedCountryCode"],
    },
  };
  const forbidden = new Set(["__proto__", "constructor", "prototype"]);
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).filter(k => !forbidden.has(k)).sort().map(k => [k, stable(value[k])]));
    return value;
  }
  function signature(value) { return JSON.stringify(stable(value ?? null)); }
  function equal(a, b) { return signature(a) === signature(b); }
  function uuid() { return globalThis.crypto.randomUUID(); }
  function key(kind, id) { return `${kind}:${encodeURIComponent(id)}`; }
  function hash(text) {
    let h = 2166136261;
    for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
    return h.toString(16);
  }
  function ensureIds(snapshot) {
    const value = clone(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {});
    for (const name of forbidden) delete value[name];
    for (const [kind, field] of Object.entries(collections)) {
      const used = new Set();
      value[field] = (Array.isArray(value[field]) ? value[field] : []).filter(item => item && typeof item === "object" && !Array.isArray(item)).map((item, index) => {
        let id = String(item.id || `legacy_${kind}_${hash(signature(item))}_${index}`);
        if (used.has(id)) id = `${id}_duplicate_${index}`;
        used.add(id);
        return { ...item, id };
      });
    }
    // Upgrade legacy name-based payer/share keys without making a rename move money
    // to another person. Ambiguous duplicate names are left for explicit review.
    const aliases = new Map();
    for (const item of value.companions) {
      const legacy = `companion:${item.name || ""}`;
      aliases.set(legacy, aliases.has(legacy) ? null : `companion:${item.id}`);
    }
    const currentKeys = new Set(value.companions.map(item => `companion:${item.id}`));
    const memberKey = key => currentKeys.has(key) ? key : aliases.get(key) || key;
    for (const entry of value.entries) if (entry.payerKey) entry.payerKey = memberKey(entry.payerKey);
    if (value.settlement?.customShares) value.settlement.customShares = Object.fromEntries(Object.entries(value.settlement.customShares).map(([key,amount]) => [memberKey(key),amount]));
    for (const split of Object.values(value.settlement?.itemSplits || {})) if (split?.shares) split.shares = Object.fromEntries(Object.entries(split.shares).map(([key,amount]) => [memberKey(key),amount]));
    return value;
  }
  function fieldsFor(kind, item) {
    const result = {};
    const consumed = new Set(["id", "_syncPosition"]);
    for (const [name, fields] of Object.entries(groups[kind] || {})) {
      const value = {};
      for (const field of fields) {
        consumed.add(field);
        if (Object.hasOwn(item, field)) value[field] = clone(item[field]);
      }
      if (Object.keys(value).length) result[`g:${name}`] = value;
    }
    for (const [field, value] of Object.entries(item)) {
      if (!consumed.has(field) && !forbidden.has(field)) result[`p:${field}`] = clone(value);
    }
    return result;
  }
  function itemFor(entity) {
    const item = { id: entity.id };
    for (const [field, value] of Object.entries(entity.fields || {})) {
      if (field.startsWith("g:")) Object.assign(item, clone(value));
      else if (field.startsWith("p:") && !forbidden.has(field.slice(2))) item[field.slice(2)] = clone(value);
    }
    return item;
  }
  function encode(input) {
    const snapshot = ensureIds(input);
    const entities = {};
    function add(kind, id, fields) { entities[key(kind, id)] = { kind, id: String(id), fields }; }
    const meta = Object.fromEntries(Object.entries(snapshot).filter(([k]) => !localKeys.has(k) && !k.startsWith("_sync")));
    add("trip", "settings", fieldsFor("trip", meta));
    for (const [kind, field] of Object.entries(collections)) {
      for (const [index, item] of snapshot[field].entries()) {
        add(kind, item.id, { ...fieldsFor(kind, item), "@position": Number.isFinite(item._syncPosition) ? item._syncPosition : (index + 1) * 1024 });
      }
    }
    for (const item of snapshot.travelCompanion?.reservations || []) add("reservation", item.id, fieldsFor("reservation", item));
    const flags = snapshot.travelCompanion || {};
    for (const id of new Set([...(flags.completedItineraryIds || []), ...(flags.lockedItineraryIds || [])])) {
      add("progress", id, { "p:completed": (flags.completedItineraryIds || []).includes(id), "p:locked": (flags.lockedItineraryIds || []).includes(id) });
    }
    add("settings", "timezone", { "p:timeZone": flags.timeZone || "" });
    const settlement = snapshot.settlement || {};
    add("settings", "settlement", { "p:splitMode": settlement.splitMode || "equal", "p:leaderName": settlement.leaderName || "여행 대표" });
    for (const [id, value] of Object.entries(settlement.itemSplits || {})) add("split", id, { "p:value": clone(value) });
    for (const [id, value] of Object.entries(settlement.customShares || {})) add("share", id, { "p:value": clone(value) });
    return entities;
  }
  function decode(entities, template) {
    const snapshot = ensureIds(template || {});
    const values = Object.values(entities).filter(e => !e.deleted);
    const meta = entities[key("trip", "settings")];
    if (meta) { const item = itemFor(meta); delete item.id; Object.assign(snapshot, item); }
    for (const [kind, field] of Object.entries(collections)) {
      snapshot[field] = values.filter(e => e.kind === kind).sort((a, b) => Number(a.fields["@position"] || 0) - Number(b.fields["@position"] || 0) || a.id.localeCompare(b.id)).map(e => ({ ...itemFor(e), _syncPosition: e.fields["@position"] }));
    }
    snapshot.travelCompanion = { ...(snapshot.travelCompanion || {}),
      reservations: values.filter(e => e.kind === "reservation").map(itemFor),
      completedItineraryIds: values.filter(e => e.kind === "progress" && e.fields["p:completed"]).map(e => e.id),
      lockedItineraryIds: values.filter(e => e.kind === "progress" && e.fields["p:locked"]).map(e => e.id),
      timeZone: entities[key("settings", "timezone")]?.fields["p:timeZone"] || "",
    };
    snapshot.settlement = { ...(snapshot.settlement || {}),
      splitMode: entities[key("settings", "settlement")]?.fields["p:splitMode"] || "equal",
      leaderName: entities[key("settings", "settlement")]?.fields["p:leaderName"] || "여행 대표",
      itemSplits: Object.fromEntries(values.filter(e => e.kind === "split").map(e => [e.id, clone(e.fields["p:value"])])),
      customShares: Object.fromEntries(values.filter(e => e.kind === "share").map(e => [e.id, clone(e.fields["p:value"])])),
    };
    return snapshot;
  }
  function reposition(snapshot, previousEntities) {
    const result = ensureIds(snapshot);
    for (const [kind, field] of Object.entries(collections)) {
      const list = result[field];
      // Assign only moved/new rows a rank; adding one item does not edit every other row.
      let previousRank = 0;
      for (let i = 0; i < list.length; i++) {
        const current = previousEntities[key(kind, list[i].id)]?.fields["@position"];
        const remaining = list.slice(i + 1).map(row => previousEntities[key(kind, row.id)]?.fields["@position"]).filter(rank => Number.isFinite(rank) && rank > previousRank);
        const nextRank = remaining.length ? Math.min(...remaining) : previousRank + 2048;
        const rank = Number.isFinite(current) && current > previousRank && current < nextRank ? current : (previousRank + nextRank) / 2;
        list[i]._syncPosition = rank;
        previousRank = rank;
      }
    }
    return result;
  }
  function shared(entities, privacy = {}) {
    return Object.fromEntries(Object.entries(entities).flatMap(([key, source]) => {
      const e = clone(source);
      if (privacy.shareItinerary === false && ["itinerary", "progress", "reservation", "note_update", "comment"].includes(e.kind)) return [];
      if (privacy.shareExpenses === false) {
        if (e.kind === 'reservation') {
          delete e.fields['g:money'];
          for (const field of ['quotedAmount', 'quotedCurrency', 'linkedExpenseId']) delete e.fields[`p:${field}`];
        }
        if (["expense", "split", "share"].includes(e.kind) || (e.kind === "settings" && e.id === "settlement")) return [];
        if (e.kind === "participant") delete e.fields["p:individualSpent"];
        if (e.kind === "trip") delete e.fields["p:totalBudget"];
      }
      return [[key, e]];
    }));
  }
  function diff(before, after, { source = before } = {}) {
    const patches = [];
    for (const entityKey of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const a = before[entityKey], b = after[entityKey];
      // User intent comes from the displayed view; comparison values come from
      // the exact stored snapshot that produced it, before rendering cleanup.
      const original = source[entityKey] || a;
      if (!a || a.deleted) {
        if (b && !b.deleted) patches.push({ kind: b.kind, id: b.id, action: "create", before: null, fields: clone(b.fields), expectedVersion: a?.version || 0 });
      } else if (!b || b.deleted) {
        patches.push({ kind: a.kind, id: a.id, action: "delete", before: clone(original.fields), expectedVersion: original.version || 0 });
      } else {
        const fields = {}, previous = {}, versions = {};
        for (const field of new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])) {
          if (equal(a.fields[field], b.fields[field])) continue;
          fields[field] = Object.hasOwn(b.fields, field) ? clone(b.fields[field]) : null;
          previous[field] = Object.hasOwn(original.fields, field) ? clone(original.fields[field]) : null;
          versions[field] = original.fieldVersions?.[field] || 0;
        }
        if (Object.keys(fields).length) patches.push({ kind: b.kind, id: b.id, action: "patch", before: previous, fields, expectedFields: versions });
      }
    }
    return patches;
  }
  function selectScope(entities, scope) {
    return Object.fromEntries(Object.entries(entities).flatMap(([key, source]) => {
      const e = clone(source);
      if (scope === "itinerary") return ["itinerary", "reservation", "progress"].includes(e.kind) ? [[key,e]] : [];
      if (e.kind === 'reservation') {
        e.fields = Object.fromEntries(['p:quotedAmount', 'p:quotedCurrency', 'p:linkedExpenseId'].filter(field => Object.hasOwn(e.fields, field)).map(field => [field, e.fields[field]]));
        return Object.keys(e.fields).length ? [[key, e]] : [];
      }
      if (["expense", "split", "share"].includes(e.kind) || (e.kind === "settings" && e.id === "settlement")) return [[key,e]];
      const field = e.kind === "participant" ? "p:individualSpent" : e.kind === "trip" ? "p:totalBudget" : null;
      if (!field) return [];
      e.fields = Object.hasOwn(e.fields,field) ? { [field]:e.fields[field] } : {};
      return [[key,e]];
    }));
  }
  function apply(entities, patches, { check = false } = {}) {
    const next = clone(entities), conflicts = [];
    for (const patch of patches) {
      const entityKey = key(patch.kind, patch.id), current = next[entityKey];
      if (patch.action === "create") {
        if (check && current && !equal(current.fields, patch.fields)) conflicts.push({ ...clone(patch), current: clone(current.fields), reason: current.deleted ? "deleted" : "exists" });
        else next[entityKey] = { kind: patch.kind, id: patch.id, fields: clone(patch.fields) };
      } else if (patch.action === "delete") {
        if (check && current && !current.deleted && !equal(current.fields, patch.before)) conflicts.push({ ...clone(patch), current: clone(current.fields), reason: "changed" });
        else delete next[entityKey];
      } else if (!current || current.deleted) conflicts.push({ ...clone(patch), current: null, reason: "deleted" });
      else {
        for (const [field, value] of Object.entries(patch.fields)) {
          if (check && !equal(current.fields[field], patch.before?.[field]) && !equal(current.fields[field], value)) {
            conflicts.push({ ...clone(patch), fields: { [field]: value }, before: { [field]: patch.before?.[field] ?? null }, current: { [field]: clone(current.fields[field]) }, reason: "changed" });
          } else if (value === null) delete current.fields[field];
          else current.fields[field] = clone(value);
        }
      }
    }
    return { entities: next, conflicts };
  }
  function fromRows(rows = []) {
    return Object.fromEntries(rows.map(row => [key(row.kind, row.entity_id || row.id), { kind: row.kind, id: row.entity_id || row.id, fields: clone(row.data || row.fields || {}), version: Number(row.version || 0), fieldVersions: clone(row.field_versions || row.fieldVersions || {}), deleted: Boolean(row.deleted_at || row.deleted) }]));
  }
  // Every accepted trip member may edit allocations, including a viewer.
  // Keep the exception narrow so it cannot grant expense/settings edits.
  function splitOnly(patches) {
    return Array.isArray(patches) && patches.length > 0 && patches.every(patch =>
      patch.kind === 'split' && /^current:.+/.test(patch.id || '') &&
      ['create', 'patch', 'delete'].includes(patch.action) &&
      (patch.action === 'delete' || (patch.fields && Object.keys(patch.fields).length === 1 && Object.hasOwn(patch.fields, 'p:value'))));
  }
  return { clone, equal, signature, uuid, key, ensureIds, encode, decode, reposition, shared, selectScope, diff, apply, fromRows, collections, splitOnly };
});
