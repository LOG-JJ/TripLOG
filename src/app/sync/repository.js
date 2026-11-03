(function (root) {
  "use strict";
  const M = root.TripLogSyncModel;
  const NAME = "triplog-collaboration-v2";
  const VERSION = 1;
  let database, opening;
  const listeners = new Set();
  const cache = new Map();
  let channel;
  function emit(id) {
    for (const fn of listeners) fn(id);
    root.dispatchEvent?.(new CustomEvent("triplog:repository-changed", { detail: { tripId: id } }));
  }
  function open() {
    if (database) return Promise.resolve(database);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error("이 브라우저에서 기기 저장소를 사용할 수 없습니다.")); return; }
      const request = root.indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("trips", { keyPath: "localId" });
        const snapshots = db.createObjectStore("snapshots", { keyPath: "id" });
        snapshots.createIndex("tripId", "tripId");
        db.createObjectStore("meta", { keyPath: "id" });
        db.createObjectStore("drafts", { keyPath: "id" });
      };
      request.onblocked = () => reject(new Error("다른 TripLOG 탭을 닫아 저장소 업데이트를 완료해 주세요."));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        database = request.result;
        database.onversionchange = () => { database.close(); database = null; opening = null; };
        resolve(database);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function transaction(stores, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error("기기 저장에 실패했습니다."));
      try { work(tx, value => { result = value; }, error => { failure = error; tx.abort(); }); } catch (error) { tx.abort(); reject(error); }
    });
  }
  function makeRecord(snapshot) {
    const value = M.ensureIds(snapshot);
    const recovery = value._syncRecovery?.documents;
    // The trip owner is not necessarily the signed-in person using this device.
    const record = { localId: value.id, accountId: "", serverId: null,
      snapshot: value, base: null, cursor: 0, queue: [], conflicts: [], localRevision: 0, updatedAt: Date.now(), lastError: null };
    if (Array.isArray(recovery)) {
      record.base = { ...M.encode(value), ...Object.fromEntries(recovery.filter(e => ["note_update", "comment"].includes(e.kind) && typeof e.id === "string").map(e => [M.key(e.kind,e.id), M.clone(e)])) };
      record.quarantined = true;
    }
    return record;
  }
  function backup(tx, record, source) {
    if (!record) return;
    const state = M.clone(record.snapshot);
    const documents = Object.values(M.apply(record.base || {}, (record.queue || []).flatMap(q => q.patches)).entities).filter(e => !e.deleted && ["note_update", "comment"].includes(e.kind));
    state._syncRecovery = { documents, sourceLocalId: record.localId };
    tx.objectStore("snapshots").put({ id: M.uuid(), tripId: record.localId, timestamp: new Date().toISOString(), source, state });
    const older = tx.objectStore("snapshots").index("tripId").getAll(record.localId);
    older.onsuccess = () => {
      const rows = older.result.filter(row => row.source !== "legacy-original").sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      for (const row of rows.slice(100)) tx.objectStore("snapshots").delete(row.id);
    };
  }
  async function read(localId) {
    const result = await transaction(["trips"], "readonly", (tx, done) => {
      const request = tx.objectStore("trips").get(localId);
      request.onsuccess = () => done(request.result || null);
    });
    if (result) cache.set(localId, M.clone(result));
    return result;
  }
  async function all() {
    const rows = await transaction(["trips"], "readonly", (tx, done) => {
      const request = tx.objectStore("trips").getAll(); request.onsuccess = () => done(request.result);
    });
    for (const row of rows) cache.set(row.localId, M.clone(row));
    return rows;
  }
  async function update(localId, change, { snapshot = false, source = "before-change", allowRemoved = false } = {}) {
    const result = await transaction(["trips", "snapshots"], "readwrite", (tx, done, fail) => {
      const store = tx.objectStore("trips");
      const request = store.get(localId);
      request.onsuccess = () => {
        try {
          const record = request.result || null;
          if (record?.removedAt && !allowRemoved) throw new Error("TRIP_REMOVED");
          if (snapshot) backup(tx, record, source);
          const next = change(record, tx);
          if (next) { next.updatedAt = Date.now(); store.put(next); }
          done(next);
        } catch (error) { fail(error); }
      };
    });
    if (result) cache.set(localId, M.clone(result));
    channel?.postMessage({ localId });
    emit(localId);
    return result;
  }
  async function removeTrip(localId, { accountId, projectId, operationId, serverDeleted = false } = {}) {
    const result = await transaction(["trips", "snapshots", "drafts", "meta"], "readwrite", (tx, done, fail) => {
      const store = tx.objectStore("trips"), request = store.get(localId);
      request.onsuccess = () => {
        const old = request.result;
        if (!old) { done(null); return; }
        if ((accountId && old.accountId && old.accountId !== accountId) || (projectId && old.projectId && old.projectId !== projectId)) { fail(new Error("SESSION_CHANGED")); return; }
        const now = new Date().toISOString();
        // Retain only a local tombstone so old tabs cannot recreate the trip.
        const next = { localId, accountId: old.accountId || accountId || "", projectId: old.projectId || projectId || "", serverId: old.serverId || null,
          snapshot: { id: localId, tripName: "삭제된 여행", itineraryItems: [], entries: [], companions: [], packingList: [], travelCompanion: {} },
          base: null, queue: [], conflicts: [], localRevision: 0, cursor: 0, role: "viewer", hidden: true, archivedAt: now, removedAt: now, updatedAt: Date.now(),
          removal: { id: operationId || old.removal?.id || M.uuid(), status: "confirmed", serverDeleted } };
        store.put(next);
        const snapshots = tx.objectStore("snapshots").index("tripId").openKeyCursor(localId);
        snapshots.onsuccess = () => { const cursor = snapshots.result; if (cursor) { tx.objectStore("snapshots").delete(cursor.primaryKey); cursor.continue(); } };
        const drafts = tx.objectStore("drafts").openCursor();
        drafts.onsuccess = () => { const cursor = drafts.result; if (cursor) { if (cursor.value.value?.tripId === localId) cursor.delete(); cursor.continue(); } };
        const personalPrefix = `personal:today:${old.accountId || accountId || 'device'}:${localId}:`;
        const metadata = tx.objectStore('meta').openCursor();
        metadata.onsuccess = () => { const cursor = metadata.result; if (cursor) { if (String(cursor.key).startsWith(personalPrefix)) cursor.delete(); cursor.continue(); } };
        done(next);
      };
    });
    if (result) cache.set(localId, M.clone(result));
    channel?.postMessage({ localId }); emit(localId); return result;
  }
  async function migrate(trips, { accountId = "" } = {}) {
    await open();
    await transaction(["trips", "snapshots", "meta"], "readwrite", (tx, done) => {
      const metadata = tx.objectStore("meta");
      const request = metadata.get("legacy-migration");
      request.onsuccess = () => {
        if (request.result) { done(false); return; }
        const ids = new Map();
        for (const source of trips) {
          if (!source?.id) continue;
          backup(tx, { localId: source.id, snapshot: M.clone(source) }, "legacy-original");
          const snapshot = M.ensureIds(source);
          const existing = ids.get(snapshot.id);
          if (existing && M.equal(existing, snapshot)) continue;
          if (existing) { snapshot.id = M.uuid(); snapshot.tripName += " (이관 확인 필요)"; }
          const record = makeRecord(snapshot);
          record.accountId = accountId;
          if (Object.values(M.collections).some(field => source[field] != null && (!Array.isArray(source[field]) || source[field].some(item => !item || typeof item !== "object" || Array.isArray(item))))) record.quarantined = true;
          if (existing) record.quarantined = true;
          tx.objectStore("trips").put(record);
          ids.set(snapshot.id, snapshot);
        }
        metadata.put({ id: "legacy-migration", at: Date.now() });
        done(true);
      };
    });
    await all();
    if (typeof root.BroadcastChannel === "function" && !channel) {
      channel = new root.BroadcastChannel("triplog-repository-v2");
      channel.onmessage = async event => { const id = event.data?.localId; if (id) { await read(id); emit(id); } };
    }
  }
  function project(record) {
    let entities = M.clone(record.base || M.encode(record.snapshot));
    for (const intent of record.queue) {
      if (intent.status !== "rejected") {
        // A pending edit stays visible even if the server deleted its target.
        // The command still conflicts on the server; this is only the local draft.
        for (const patch of intent.patches) {
          const entityKey = M.key(patch.kind, patch.id), current = entities[entityKey];
          if (patch.action === "patch" && (!current || current.deleted)) {
            const original = intent.originalEntities?.[entityKey] || current;
            entities[entityKey] = { kind: patch.kind, id: patch.id, fields: M.clone(original?.fields || patch.before || {}) };
          }
        }
        entities = M.apply(entities, intent.patches).entities;
      }
    }
    let result = M.decode(entities, record.snapshot);
    const privacy = record.snapshot.collaboration?.privacy || {};
    if (privacy.shareItinerary === false) {
      result.itineraryItems = M.clone(record.snapshot.itineraryItems);
      result.travelCompanion = M.clone(record.snapshot.travelCompanion);
    }
    if (privacy.shareExpenses === false) {
      result.travelCompanion.reservations = (result.travelCompanion.reservations || []).map(row => {
        const local = record.snapshot.travelCompanion?.reservations?.find(item => item.id === row.id);
        if (!local) return row;
        const next = { ...row };
        for (const key of ['quotedAmount', 'quotedCurrency', 'linkedExpenseId']) {
          if (record.role && record.role !== 'owner') delete next[key];
          else if (Object.hasOwn(local, key)) next[key] = M.clone(local[key]);
        }
        return next;
      });
      result.entries = M.clone(record.snapshot.entries); result.settlement = M.clone(record.snapshot.settlement);
      result.totalBudget = record.snapshot.totalBudget;
      result.companions = result.companions.map(item => {
        const local = record.snapshot.companions?.find(c => c.id === item.id);
        return local && Object.hasOwn(local, "individualSpent") ? { ...item, individualSpent: local.individualSpent } : item;
      });
    }
    return result;
  }
  function reconcileLegacy(record) {
    // A device snapshot without a server baseline is not a set of user commands.
    // Missing rows/fields must never become deletes or roll back newer cloud data.
    const local = M.shared(M.encode(record.snapshot), record.snapshot.collaboration?.privacy);
    const pendingKeys = new Set(record.queue.flatMap(q => q.patches.map(p => M.key(p.kind, p.id))));
    const additions = M.diff(record.base, local).filter(p => p.action === "create" && !record.base[M.key(p.kind, p.id)] && !pendingKeys.has(M.key(p.kind, p.id)));
    if (additions.length && record.role !== "viewer") record.queue.push({ id: M.uuid(), status: "queued", patches: additions, createdAt: Date.now(), dependsOn: [] });
    record.conflicts = record.conflicts.filter(c => c.source !== "migration");
    record.snapshot = project(record);
    return record;
  }
  async function reconcile(localId) {
    return update(localId, record => reconcileLegacy(record), { snapshot: true, source: "before-automatic-reconcile" });
  }
  async function save(snapshot, observed, { deletions = [], sourceSnapshot = observed || snapshot, expectedScope } = {}) {
    const localId = snapshot.id;
    const before = M.encode(observed || snapshot);
    const ranked = M.reposition(snapshot, before);
    const patches = M.diff(before, M.encode(ranked), { source: M.encode(sourceSnapshot) });
    const explicitDeletes = new Set(deletions.map(p => M.key(p.kind, p.id)));
    if (patches.some(p => p.action === "delete" && ["itinerary", "expense", "packing", "participant", "reservation"].includes(p.kind) && !explicitDeletes.has(M.key(p.kind, p.id)))) {
      throw new Error("기존 기록을 지우는 저장을 중단했습니다. 삭제할 항목에서 삭제 버튼을 사용해 주세요.");
    }
    return update(localId, old => {
      const record = old || makeRecord(ranked);
      if (expectedScope && ['accountId','projectId','serverId'].some(key => (record[key] || '') !== (expectedScope[key] || ''))) throw new Error('여행이나 계정이 변경됐어요. 다시 열어 주세요.');
      if (record.removal) throw new Error("여행 삭제 결과를 먼저 확인해 주세요.");
      if (record.archivedAt && patches.length) throw new Error("보관된 여행입니다. 복구 기록에서 여행을 다시 열어 주세요.");
      if (record.role === "viewer" && patches.length && !M.splitOnly(patches)) throw new Error("보기 전용 여행입니다. 분담 외의 항목은 수정할 수 없어요.");
      const fresh = M.encode(record.snapshot);
      const merged = M.apply(fresh, patches, { check: true });
      const atomicConflict = patches.length > 1 && merged.conflicts.length > 0;
      if (atomicConflict) merged.entities = fresh;
      const candidate = M.decode(merged.entities, ranked);
      candidate.id = localId;
      record.snapshot = candidate;
      if (record.placeholder && (candidate.itineraryItems?.length || candidate.entries?.length || candidate.travelCompanion?.reservations?.length || candidate.tripName !== "새 여행")) record.placeholder = false;
      if (patches.length) record.localRevision++;
      if (!record.base && deletions.length) record.unboundDeletions = [...(record.unboundDeletions || []), ...M.clone(deletions)];
      record.lastError = null;
      if (atomicConflict) record.conflicts.push({ id: M.uuid(), source: "tab", patches: M.clone(patches), deletions: M.clone(deletions), snapshot: M.clone(ranked), originalEntities: before, createdAt: Date.now() });
      else for (const conflict of merged.conflicts) record.conflicts.push({ id: M.uuid(), source: "tab", patches: [conflict], deletions: M.clone(deletions), snapshot: M.clone(ranked), originalEntity: before[M.key(conflict.kind, conflict.id)], createdAt: Date.now() });
      if (record.base && patches.length) {
        const filtered = M.diff(M.shared(fresh, candidate.collaboration?.privacy), M.shared(merged.entities, candidate.collaboration?.privacy));
        if (filtered.length) {
          for (const patch of filtered) {
            const base = record.base[M.key(patch.kind, patch.id)];
            if (patch.action === "patch") patch.expectedFields = Object.fromEntries(Object.keys(patch.fields).map(field => [field, base?.fieldVersions?.[field] || 0]));
            else patch.expectedVersion = base?.version || 0;
          }
          const batches = filtered.length === 1 && filtered[0].action === "patch" && !Object.hasOwn(filtered[0].fields, "g:transit")
            ? Object.keys(filtered[0].fields).map(field => [{ ...filtered[0], fields: { [field]: filtered[0].fields[field] }, before: { [field]: filtered[0].before[field] }, expectedFields: { [field]: filtered[0].expectedFields[field] } }])
            : [filtered];
          for (const patches of batches) {
            const overlaps = (a, b) => a.kind === b.kind && a.id === b.id && (a.action !== "patch" || b.action !== "patch" || Object.keys(a.fields).some(field => Object.hasOwn(b.fields, field)));
            record.queue.push({ id: M.uuid(), patches, deletions: M.clone(deletions), originalEntities: Object.fromEntries(patches.map(p => [M.key(p.kind,p.id), fresh[M.key(p.kind,p.id)] || null])), status: "queued", createdAt: Date.now(), dependsOn: record.queue.filter(q => q.patches.some(p => patches.some(n => overlaps(n, p)))).map(q => q.id) });
          }
        }
      }
      return record;
    }, { snapshot: patches.some(p => p.action === "delete"), source: "before-delete" });
  }
  async function attach(localId, serverId, accountId, entities, cursor, confirmedSnapshot, role) {
    return update(localId, old => {
      if (!old) throw new Error("기기 여행을 찾지 못했습니다.");
      if (old.accountId && old.accountId !== accountId) throw new Error("다른 계정의 여행입니다.");
      const record = old;
      record.role = role || record.role;
      const wasBound = Boolean(record.base);
      const local = M.shared(M.encode(record.snapshot), record.snapshot.collaboration?.privacy);
      record.serverId = serverId; record.accountId = accountId; record.base = M.clone(entities); record.cursor = cursor;
      if (!wasBound) {
        const comparable = M.shared(Object.fromEntries(Object.entries(entities).filter(([, e]) => !["note_update", "comment"].includes(e.kind))), record.snapshot.collaboration?.privacy);
        const differences = M.diff(comparable, local);
        const submitted = confirmedSnapshot && M.shared(M.encode(confirmedSnapshot), confirmedSnapshot.collaboration?.privacy);
        const knownBaseline = submitted && !M.diff(M.shared(entities, confirmedSnapshot.collaboration?.privacy), submitted).length;
        if (differences.length && knownBaseline) record.queue.push({ id: M.uuid(), status: "queued", patches: differences, deletions: record.unboundDeletions || [], createdAt: Date.now(), dependsOn: [] });
        else if (differences.length) reconcileLegacy(record);
        else record.snapshot = project(record);
      } else record.snapshot = project(record);
      delete record.unboundDeletions;
      return record;
    }, { snapshot: true, source: "before-server-bind" });
  }
  async function receive(localId, entities, cursor) {
    const current = await read(localId);
    if (current && (cursor < current.cursor || (cursor === current.cursor && M.equal(current.base, entities)))) return current;
    return update(localId, old => {
      if (!old || cursor < old.cursor) return old;
      old.base = M.clone(entities); old.cursor = cursor;
      if (!old.conflicts.some(c => c.source === "migration")) old.snapshot = project(old);
      return old;
    }, { snapshot: true, source: "before-remote-change" });
  }
  async function acknowledge(localId, intentId, result) {
    return update(localId, record => {
      const intent = record?.queue.find(q => q.id === intentId);
      if (!intent) return record;
      if (result.status === "conflict") {
        intent.status = "conflict";
        if (!record.conflicts.some(c => c.intentId === intentId)) record.conflicts.push({ id: M.uuid(), source: "server", intentId, patches: M.clone(intent.patches), deletions: M.clone(intent.deletions || []), originalEntities: M.clone(intent.originalEntities || record.base), snapshot: M.clone(record.snapshot), details: result.conflicts, createdAt: Date.now() });
      } else {
        const changes = M.fromRows(result.changes || []);
        for (const [key, entity] of Object.entries(changes)) {
          if (!record.base[key] || entity.version >= record.base[key].version) record.base[key] = entity;
        }
        // The cursor advances only on ordered catch-up, never on a possibly out-of-order write ACK.
        record.queue = record.queue.filter(q => q.id !== intentId);
        for (const dependent of record.queue.filter(q => q.dependsOn.includes(intentId) && !q.request)) {
          for (const patch of dependent.patches) {
            const changed = changes[M.key(patch.kind, patch.id)];
            if (!changed) continue;
            if (patch.action === "patch") {
              for (const field of Object.keys(patch.fields)) {
                const parent = intent.patches.find(p => p.kind === patch.kind && p.id === patch.id);
                if (M.equal(patch.before[field], changed.fields[field]) || (parent?.fields && Object.hasOwn(parent.fields, field) && M.equal(patch.before[field], parent.fields[field]))) {
                  patch.before[field] = M.clone(changed.fields[field] ?? null);
                  patch.expectedFields[field] = changed.fieldVersions[field] || 0;
                }
              }
            } else {
              const parent = intent.patches.find(p => p.kind === patch.kind && p.id === patch.id);
              if (M.equal(patch.before, changed.fields) || (parent?.fields && M.equal(patch.before, parent.fields))) { patch.before = M.clone(changed.fields); patch.expectedVersion = changed.version; }
            }
          }
          dependent.dependsOn = dependent.dependsOn.filter(id => id !== intentId);
        }
        record.lastConfirmedAt = new Date().toISOString(); record.lastError = null;
        record.snapshot = project(record);
      }
      return record;
    });
  }
  async function snapshots(localId) {
    return transaction(["snapshots"], "readonly", (tx, done) => {
      const request = localId ? tx.objectStore("snapshots").index("tripId").getAll(localId) : tx.objectStore("snapshots").getAll();
      request.onsuccess = () => done(request.result.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    });
  }
  async function enqueue(localId, patches) {
    return update(localId, record => {
      if (!record) throw new Error("여행을 찾지 못했습니다.");
      if (record.removal || (record.role === "viewer" && !M.splitOnly(patches)) || record.archivedAt) throw new Error("현재 여행은 읽기 전용입니다.");
      const dependencies = record.queue.filter(q => q.patches.some(parent => patches.some(p => (p.kind === parent.kind && p.id === parent.id) || (p.kind === "comment" && p.fields?.["p:targetId"] === parent.id && parent.kind === "itinerary")))).map(q => q.id);
      record.queue.push({ id: M.uuid(), patches: M.clone(patches), status: "queued", createdAt: Date.now(), dependsOn: dependencies });
      record.localRevision++;
      record.placeholder = false;
      record.snapshot = project(record);
      return record;
    });
  }
  async function draft(id, value) {
    return transaction(["drafts", "trips"], value === undefined ? "readonly" : "readwrite", (tx, done, fail) => {
      const store = tx.objectStore("drafts");
      if (value === null) store.delete(id);
      else if (value !== undefined) {
        const put = () => store.put({ id, value: M.clone(value), savedAt: Date.now() });
        if (!value.tripId) put();
        else {
          const request = tx.objectStore("trips").get(value.tripId);
          request.onsuccess = () => { if (request.result?.removedAt) fail(new Error("TRIP_REMOVED")); else put(); };
        }
      }
      else { const request = store.get(id); request.onsuccess = () => done(request.result?.value || null); }
    });
  }
  async function drafts(localId) {
    const rows = await transaction(["drafts"], "readonly", (tx, done) => {
      const request = tx.objectStore("drafts").getAll(); request.onsuccess = () => done(request.result);
    });
    return rows.filter(row => !localId || row.value.tripId === localId).sort((a, b) => b.savedAt - a.savedAt);
  }
  function close() { channel?.close(); channel = null; database?.close(); database = null; opening = null; }
  async function personal(id, value) {
    return transaction(['meta'], value === undefined ? 'readonly' : 'readwrite', (tx, done) => {
      const store = tx.objectStore('meta'), key = `personal:${id}`;
      if (value !== undefined) { store.put({ id: key, value: M.clone(value) }); done(value); }
      else { const request = store.get(key); request.onsuccess = () => done(request.result?.value || null); }
    });
  }
  const api = { open, migrate, all, read, update, removeTrip, save, attach, reconcile, receive, acknowledge, enqueue, project, snapshots, draft, drafts, makeRecord, close, cached: id => M.clone(cache.get(id)), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  api.personal = personal;
  root.TripLog?.register("sync.repository", api);
  root.TripLogSyncRepository = api;
})(typeof window === "undefined" ? globalThis : window);
