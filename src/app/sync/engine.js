(function (root) {
  "use strict";
  const M = root.TripLogSyncModel;
  function createEngine({ repository: R, transport, onChange = () => {}, clock = root }) {
    let accountId = "", projectId = "", generation = 0, timer, polling, running, listing;
    let retryAt = 0, failures = 0, error = null, active = false, scheduledAt = 0;
    const subscriptions = new Map();
    const listeners = new Set();
    const announce = () => { for (const fn of listeners) fn(); };
    function wake(delay = 500) {
      if (!active) return;
      const due = Date.now() + Math.max(delay, retryAt - Date.now());
      if (timer && scheduledAt <= due) return;
      clock.clearTimeout(timer);
      scheduledAt = due;
      timer = clock.setTimeout(() => { timer = null; scheduledAt = 0; pump().catch(() => {}); }, Math.max(0, due - Date.now()));
    }
    R.subscribe(() => { announce(); if (!running && active) wake(); });
    function checkScope(token) { if (!active || token !== generation) throw Object.assign(new Error("SESSION_CHANGED"), { stale: true }); }
    async function request(body, token = generation) {
      checkScope(token);
      const result = await transport.request(body);
      checkScope(token);
      return result;
    }
    async function acceptRemote(remote, token = generation, { restoreRemoved = false } = {}) {
      checkScope(token);
      const actor = accountId, project = projectId;
      let records = await R.all();
      checkScope(token);
      let record = records.find(r => r.accountId === accountId && (!r.projectId || r.projectId === projectId) && r.serverId === remote.tripId);
      if (!record) record = records.find(r => !r.serverId && !r.quarantined && (!r.projectId || r.projectId === projectId) && r.localId === remote.appTripId && (!r.accountId || r.accountId === accountId));
      const entities = M.fromRows(remote.entities);
      if (record?.removedAt) {
        if (!restoreRemoved) return record;
        const snapshot = M.decode(entities, { id: record.localId, tripName: remote.tripName, collaboration: { ownerId: remote.ownerId || "", privacy: remote.privacy } });
        record = await R.update(record.localId, () => {
          checkScope(token);
          return { ...R.makeRecord(snapshot), accountId: actor, projectId: project, serverId: remote.tripId, base: entities, cursor: remote.cursor, role: remote.role, epoch: remote.epoch };
        }, { allowRemoved: true });
      }
      if (!record) {
        let localId = remote.appTripId || M.uuid();
        if (records.some(r => r.localId === localId)) localId = M.uuid();
        const template = { id: localId, tripName: remote.tripName, collaboration: { ownerId: remote.ownerId || "", privacy: remote.privacy } };
        const snapshot = M.decode(entities, template);
        record = await R.update(localId, () => { checkScope(token); return { ...R.makeRecord(snapshot), accountId: actor, projectId: project, serverId: remote.tripId, base: entities, cursor: remote.cursor, role: remote.role, epoch: remote.epoch }; });
      } else if (!record.base) {
        record = await R.attach(record.localId, remote.tripId, accountId, entities, remote.cursor, remote.confirmedSnapshot, remote.role);
      } else {
        record = await R.receive(record.localId, entities, remote.cursor);
      }
      if (record.conflicts.some(c => c.source === "migration")) record = await R.reconcile(record.localId);
      checkScope(token);
      if (record.projectId !== projectId || record.archivedAt !== (remote.archivedAt || null) || record.epoch !== remote.epoch || record.role !== remote.role || !M.equal(record.serverPrivacy, remote.privacy)) {
        record = await R.update(record.localId, r => {
          checkScope(token);
          if (remote.role === "owner") {
            const differences = [];
            for (const [flag, scope] of [["shareItinerary", "itinerary"], ["shareExpenses", "expenses"]]) {
              if (r.snapshot.collaboration?.privacy?.[flag] === false && remote.privacy?.[flag] !== false) differences.push(...M.diff(M.selectScope(M.apply(entities, r.queue.flatMap(q => q.patches)).entities, scope), M.selectScope(M.encode(r.snapshot), scope)));
            }
            if (differences.length) r.conflicts.push({ id: M.uuid(), source: "migration", patches: differences, snapshot: M.clone(r.snapshot), createdAt: Date.now() });
          }
          r.projectId = projectId; r.epoch = remote.epoch; r.role = remote.role; r.serverPrivacy = remote.privacy;
          r.archivedAt = remote.archivedAt || null;
          r.snapshot.collaboration = { ...r.snapshot.collaboration, ownerId: remote.ownerId || r.snapshot.collaboration?.ownerId, privacy: M.clone(remote.privacy) };
          if (remote.role !== "owner" && remote.privacy?.shareItinerary === false) { r.snapshot.itineraryItems = []; r.snapshot.travelCompanion = {}; }
          if (remote.role !== "owner" && remote.privacy?.shareExpenses === false) {
            r.snapshot.entries = []; r.snapshot.settlement = {};
            for (const row of r.snapshot.travelCompanion?.reservations || []) for (const key of ['quotedAmount', 'quotedCurrency', 'linkedExpenseId']) delete row[key];
          }
          return r;
        });
      }
      await subscribe(record);
      onChange(record.localId);
      return record;
    }
    async function refresh() {
      if (!active) return;
      const scope = generation;
      if (running) await running;
      checkScope(scope);
      if (listing) return listing;
      const token = generation;
      listing = (async () => {
        const result = await request({ action: "list", tripRemovalVersion: 1 }, token);
        if (result.protocolVersion !== 2) throw new Error("UPGRADE_REQUIRED");
        for (const remote of result.trips) await acceptRemote(remote, token);
        if (result.tripRemovalVersion === 1) {
          const present = new Set(result.trips.map(trip => trip.tripId));
          for (const record of await R.all()) {
            checkScope(token);
            if (record.accountId !== accountId || (record.projectId && record.projectId !== projectId) || !record.serverId || record.removal || present.has(record.serverId)) continue;
            subscriptions.get(record.localId)?.close(); subscriptions.delete(record.localId);
            await R.removeTrip(record.localId, { accountId, projectId });
          }
        }
        error = null; failures = 0;
        return result;
      })().finally(() => { if (token === generation) listing = null; announce(); });
      return listing;
    }
    async function subscribe(record) {
      if (!transport.subscribe || !record.serverId || !record.epoch) return;
      const topic = `triplog:${record.serverId}:${record.epoch}`;
      const previous = subscriptions.get(record.localId);
      if (previous?.topic === topic) return;
      previous?.close();
      const token = generation;
      const close = await transport.subscribe(topic, () => { if (token === generation) wake(0); }, { accountId, localId: record.localId });
      if (token !== generation) { close?.(); return; }
      subscriptions.set(record.localId, { topic, close });
    }
    async function catchUp(record, token) {
      let current = record;
      for (let page = 0; page < 100; page++) {
        const result = await request({ action: "read", tripId: current.serverId, after: current.cursor }, token);
        if (result.full) { await acceptRemote(result, token); return; }
        if (result.epoch !== current.epoch) {
          const full = await request({ action: "read", tripId: current.serverId }, token);
          await acceptRemote(full, token); return;
        }
        if (result.cursor > current.cursor) {
          const base = { ...current.base, ...M.fromRows(result.entities) };
          current = await R.receive(current.localId, base, result.cursor);
          onChange(current.localId);
        }
        if (result.cursor >= result.head) break;
      }
    }
    function shouldCreate(record) {
      if (record.quarantined || record.placeholder) return false;
      const snapshot = record.snapshot;
      if (record.localRevision === 0 && !snapshot.entries?.length && !snapshot.itineraryItems?.length && !snapshot.travelCompanion?.reservations?.length) return false;
      if (snapshot.id === "trip_default" && !snapshot.entries?.length && !snapshot.itineraryItems?.length && !record.queue.length) return false;
      const owner = snapshot.collaboration?.ownerId;
      return !owner || owner.startsWith("local_") || owner === accountId;
    }
    async function pump() {
      if (!active) return false;
      if (running) return running;
      const token = generation;
      let more = false;
      running = (async () => {
        if (listing) await listing;
        const records = (await R.all()).filter(r => !r.hidden && !r.removal && (!r.accountId || r.accountId === accountId) && (!r.projectId || r.projectId === projectId));
        for (const candidate of records) {
          checkScope(token);
          let record = await R.read(candidate.localId);
          if (record.retryAt > Date.now()) continue;
          try {
          if (!record.serverId) {
            if (!shouldCreate(record)) continue;
            const submitted = M.clone(record.snapshot);
            const privacy = submitted.collaboration?.privacy || {};
            if (privacy.shareItinerary === false) { submitted.itineraryItems = []; submitted.travelCompanion = { timeZone: submitted.travelCompanion?.timeZone || "" }; }
            if (privacy.shareExpenses === false) { submitted.entries = []; submitted.settlement = {}; delete submitted.totalBudget; submitted.companions = (submitted.companions || []).map(item => { const next = { ...item }; delete next.individualSpent; return next; }); }
            // Attachments travel independently after the trip has an authorized server ID.
            for (const item of submitted.itineraryItems || []) if (String(item.voucherFile || "").startsWith("data:")) item.voucherFile = null;
            const remote = await request({ action: "create", snapshot: submitted }, token);
            remote.confirmedSnapshot = submitted;
            record = await acceptRemote(remote, token);
          }
          await catchUp(record, token);
          record = await R.read(record.localId);
          if (record.archivedAt || record.conflicts.some(c => c.source === "migration")) continue;
          for (let count = 0; count < 20; count++) {
            record = await R.read(record.localId);
            const intent = record.queue.find(q => q.status === "queued" && (record.role !== "viewer" || M.splitOnly(q.patches)) && q.dependsOn.every(id => !record.queue.some(parent => parent.id === id)));
            if (!intent) break;
            if (!intent.request) {
              let prepared = M.clone(intent.patches);
              try { if (transport.preparePatches) prepared = await transport.preparePatches(record.serverId, prepared, body => request(body, token), { localId: record.localId, accountId }); }
              catch (e) {
                if (/^INVALID_/.test(e.code || e.message)) {
                  await R.acknowledge(record.localId, intent.id, { status: "conflict", conflicts: [{ reason: e.code || e.message }] });
                  continue;
                }
                throw e;
              }
              checkScope(token);
              record = await R.update(record.localId, r => {
                const q = r.queue.find(row => row.id === intent.id);
                if (q && !q.request && M.equal(q.patches, intent.patches)) q.request = { protocolVersion: 2, operationId: q.id, patches: prepared };
                return r;
              });
            }
            const frozen = record.queue.find(q => q.id === intent.id)?.request;
            if (!frozen) continue; // A coalesced note changed while attachments were being prepared.
            let result;
            try { result = await request({ action: "apply", writeVersion: 3, deletions: intent.deletions || [], tripId: record.serverId, operation: frozen }, token); }
            catch (e) {
              if ((e.code || e.message) === "INVALID_DELETE_INTENT") {
                // Upgrade an old unsafe snapshot command without replaying its
                // inferred removals. Preserve its candidate in automatic history.
                await R.update(record.localId, r => ({ ...r, queue: r.queue.filter(q => q.id !== intent.id) }), { snapshot: true, source: "before-automatic-reconcile" });
                await R.reconcile(record.localId);
                onChange(record.localId);
                continue;
              }
              if (/^(INVALID_|REQUIRED_|PRIVATE_DATA_|OPERATION_ID_REUSED|TRIP_ARCHIVED)/.test(e.code || e.message)) {
                await R.update(record.localId, r => {
                  const q = r.queue.find(q => q.id === intent.id); q.status = "conflict";
                  r.conflicts.push({ id: M.uuid(), source: "validation", intentId: q.id, patches: M.clone(q.patches), deletions: q.deletions || [], snapshot: M.clone(r.snapshot), message: e.code || e.message, createdAt: Date.now() });
                  return r;
                });
                continue;
              }
              throw e;
            }
            await R.acknowledge(record.localId, intent.id, result);
            onChange(record.localId);
          }
          const latest = await R.read(record.localId);
          if (latest.lastError || latest.retryAt) await R.update(record.localId, r => ({ ...r, lastError: null, retryAt: 0 }));
          more ||= latest.queue.some(q => q.status === "queued" && q.dependsOn.every(id => !latest.queue.some(parent => parent.id === id)));
          } catch (e) {
            if ((e.code || e.message) !== "FORBIDDEN") throw e;
            await R.update(record.localId, r => ({ ...r, lastError: { code: "FORBIDDEN", at: Date.now() }, retryAt: Date.now() + 30000 }));
            subscriptions.get(record.localId)?.close(); subscriptions.delete(record.localId);
          }
        }
        error = null; retryAt = 0; failures = 0;
        return true;
      })().catch(e => {
        if (!e.stale) {
          error = { code: e.code || e.message, requestId: e.requestId, at: Date.now() }; failures++;
          retryAt = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(failures - 1, 5)) * (0.8 + Math.random() * 0.4);
          if (["FORBIDDEN", "UNAUTHENTICATED", "UPGRADE_REQUIRED", "FUNCTION_NOT_FOUND"].includes(error.code)) retryAt = Date.now() + 30000;
          if (error.code === "RATE_LIMITED") retryAt = Date.now() + Math.max(30, Math.min(3600, Number(e.retryAfter) || 60)) * 1000;
        }
        return false;
      }).finally(() => { if (token === generation) { running = null; announce(); if (active && (error || more)) wake(); } });
      return running;
    }
    async function start(id, project = "") {
      if (active && accountId === id && projectId === project) return listing || undefined;
      stop(); accountId = id; projectId = project; active = true;
      const token = generation;
      try { await refresh(); wake(0); }
      catch (e) { if (token !== generation) return; error = { code: e.code || e.message, at: Date.now() }; announce(); }
      if (token !== generation) return;
      polling = clock.setInterval(() => {
        if (!root.document || root.document.visibilityState !== "hidden") {
          // Trip-specific subscriptions cannot announce a trip this device has
          // never seen. Discover the account's complete list on every poll.
          refresh().then(() => wake(0)).catch(e => {
            if (!e.stale) { error = { code: e.code || e.message, at: Date.now() }; announce(); wake(); }
          });
        }
      }, 30000);
    }
    function stop() {
      active = false; generation++; clock.clearTimeout(timer); clock.clearInterval(polling);
      timer = null; scheduledAt = 0;
      running = null; listing = null;
      for (const subscription of subscriptions.values()) subscription.close?.(); subscriptions.clear();
      error = null; retryAt = 0;
    }
    async function resolve(localId, conflictId, choice) {
      if (!["local", "server", "copy"].includes(choice)) throw new Error("INVALID_CHOICE");
      const token = generation, actor = accountId, project = projectId;
      const guard = record => { if (token !== generation || (record.accountId && (!active || record.accountId !== actor)) || (record.projectId && record.projectId !== project)) throw new Error("SESSION_CHANGED"); };
      if (choice === "copy") {
        const source = await R.read(localId);
        guard(source);
        const original = source.conflicts.find(c => c.id === conflictId)?.snapshot || source.snapshot;
        const snapshot = { ...M.clone(original), id: M.uuid(), tripName: `${source.snapshot.tripName} (보관 사본)` };
        snapshot._syncRecovery = { ...snapshot._syncRecovery, sourceLocalId: source.localId };
        const documents = Object.fromEntries(Object.entries(M.apply(source.base || {}, source.queue.flatMap(q => q.patches)).entities).filter(([, e]) => ["note_update", "comment"].includes(e.kind)));
        await R.update(snapshot.id, () => { guard(source); return { ...R.makeRecord(snapshot), base: { ...M.encode(snapshot), ...documents }, accountId: actor, projectId: project, quarantined: true }; });
        choice = "server";
      }
      await R.update(localId, record => {
        guard(record);
        const conflict = record.conflicts.find(c => c.id === conflictId);
        if (!conflict) return record;
        record.conflicts = record.conflicts.filter(c => c.id !== conflictId);
        record.queue = record.queue.filter(q => q.id !== conflict.intentId);
        if (choice === "server" && conflict.patches.some(p => p.kind === "note_update")) record.noteGeneration = (record.noteGeneration || 0) + 1;
        if (choice === "local") {
          let patches;
          if (conflict.source === "migration") throw new Error("최신 여행을 자동으로 확인하고 있습니다. 잠시 후 다시 열어 주세요.");
          else {
            patches = M.clone(conflict.patches);
            const replacements = new Map();
            for (const patch of patches) {
              const current = (record.base || M.encode(record.snapshot))[M.key(patch.kind, patch.id)];
              if (!current || current.deleted) {
                if (patch.action !== "delete") {
                  const original = conflict.originalEntities?.[M.key(patch.kind, patch.id)] || conflict.originalEntity;
                  const previousId = patch.id; patch.id = M.uuid(); replacements.set(M.key(patch.kind, previousId), patch.id);
                  patch.action = "create"; patch.fields = { ...(original?.fields || current?.fields || patch.before || {}), ...(patch.fields || {}) }; patch.before = null; patch.expectedVersion = 0;
                }
              } else if (patch.action === "delete") { patch.before = M.clone(current.fields); patch.expectedVersion = current.version; }
              else { patch.action = "patch"; patch.before = Object.fromEntries(Object.keys(patch.fields).map(k => [k, current.fields[k] ?? null])); patch.expectedFields = Object.fromEntries(Object.keys(patch.fields).map(k => [k, current.fieldVersions[k] || 0])); }
            }
            for (const patch of patches) {
              const transit = patch.fields?.["g:transit"];
              if (transit?.expenseId && replacements.has(M.key("expense", transit.expenseId))) transit.expenseId = replacements.get(M.key("expense", transit.expenseId));
              const target = patch.fields?.["p:targetId"];
              if (target && replacements.has(M.key("itinerary", target))) patch.fields["p:targetId"] = replacements.get(M.key("itinerary", target));
            }
          }
          if (patches.length && record.base) record.queue.push({ id: M.uuid(), status: "queued", patches, deletions: conflict.deletions || [], createdAt: Date.now(), dependsOn: [] });
          else if (patches.length) { record.snapshot = M.decode(M.apply(M.encode(record.snapshot), patches).entities, record.snapshot); record.localRevision++; }
        }
        // A dependent edit must be re-reviewed if its parent was explicitly discarded.
        for (const dependent of record.queue.filter(q => q.dependsOn.includes(conflict.intentId))) {
          dependent.status = "conflict";
          record.conflicts.push({ id: M.uuid(), source: "server", intentId: dependent.id, patches: M.clone(dependent.patches), createdAt: Date.now() });
        }
        record.snapshot = R.project(record);
        return record;
      }, { snapshot: true, source: "before-conflict-resolution" });
      onChange(localId); wake(0);
    }
    async function control(localId, control, data) {
      const token = generation;
      await pump();
      checkScope(token);
      const record = await R.read(localId);
      checkScope(token);
      if (!record?.serverId) throw new Error("서버에 여행을 저장한 뒤 다시 시도해 주세요.");
      if (record.removal) throw new Error("TRIP_REMOVAL_PENDING");
      if (record.accountId !== accountId || (record.projectId && record.projectId !== projectId)) throw new Error("FORBIDDEN");
      const result = await request({ action: "control", tripId: record.serverId, control, data }, token);
      return result;
    }
    async function removeTrip(localId) {
      const token = generation;
      await pump(); checkScope(token);
      let record = await R.read(localId); checkScope(token);
      if (!record || record.accountId !== accountId || (record.projectId && record.projectId !== projectId)) throw new Error("FORBIDDEN");
      if (record.removedAt) return { ok: true, removed: true, serverDeleted: Boolean(record.removal?.serverDeleted) };
      if (!record.serverId) throw new Error("INVALID_TRIP");
      if (record.queue.length || record.conflicts.length) throw new Error("UNSYNCED_CHANGES");
      const actor = accountId, project = projectId;
      if (!record.removal) record = await R.update(localId, current => {
        checkScope(token);
        if (current.queue.length || current.conflicts.length) throw new Error("UNSYNCED_CHANGES");
        current.removal = { id: M.uuid(), status: "pending" }; return current;
      });
      const operationId = record.removal.id;
      let result;
      try { result = await request({ action: "remove-trip", tripId: record.serverId, operationId }, token); }
      catch (error) {
        if (["FORBIDDEN", "UNKNOWN_ACTION", "FUNCTION_NOT_FOUND", "INVALID_OPERATION_ID"].includes(error.code || error.message)) {
          checkScope(token);
          await R.update(localId, current => { if (current.removal?.id === operationId) delete current.removal; return current; });
        }
        throw error;
      }
      checkScope(token);
      if (result?.removed !== true) throw new Error("INVALID_REMOVAL_RESPONSE");
      subscriptions.get(localId)?.close(); subscriptions.delete(localId);
      await R.removeTrip(localId, { accountId: actor, projectId: project, operationId, serverDeleted: result.serverDeleted === true });
      onChange(localId); return result;
    }
    const online = () => { retryAt = 0; if (active) refresh().then(() => wake(0)).catch(() => wake()); };
    root.addEventListener?.("online", online);
    root.addEventListener?.("pageshow", event => { if (event.persisted) online(); });
    root.document?.addEventListener("visibilitychange", () => { if (root.document.visibilityState === "visible") online(); });
    return { start, stop, pump, refresh, wake, resolve, control, removeTrip, request, acceptRemote,
      status: () => ({ active, accountId, projectId, error, retryAt, running: Boolean(running) }),
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };
  }
  root.TripLog?.register("sync.engineFactory", { createEngine });
  root.TripLogSyncEngine = { createEngine };
})(typeof window === "undefined" ? globalThis : window);
