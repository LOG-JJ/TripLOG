(function () {
  "use strict";
  const M = window.TripLogSyncModel;
  const R = window.TripLogSyncRepository;
  let client, account, connection, initializing, connecting = 0;
  const localFailures = new Map(), localWrites = new Map();
  const engine = window.TripLogSyncEngine.createEngine({ repository: R,
    transport: {
      async preparePatches(tripId, patches, request, identity) {
        for (const patch of patches) {
          const voucher = patch.fields?.["g:voucher"];
          if (String(voucher?.voucherFile || "").startsWith("data:")) {
            const result = await request({ action: "attachment-upload", tripId, data: voucher.voucherFile });
            await R.draft(`attachment:${identity.accountId}:${tripId}:${result.reference}`, { data: voucher.voucherFile, kind: "attachment", tripId: identity.localId, accountId: identity.accountId });
            voucher.voucherFile = result.reference;
          }
        }
        return patches;
      },
      async request(body) {
        if (!client || !account) throw Object.assign(new Error("UNAUTHENTICATED"), { code: "UNAUTHENTICATED" });
        // Also bound time spent waiting for Auth; a fetch timeout alone cannot
        // release a request stuck before the SDK has started its fetch.
        let timeout;
        const { data, error } = await Promise.race([
          client.functions.invoke("triplog-sync", { body }),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(Object.assign(new Error("NETWORK_TIMEOUT"), { code: "NETWORK_TIMEOUT" })), 20000); }),
        ]).finally(() => clearTimeout(timeout));
        if (error) {
          let code = error.context?.status === 404 ? "FUNCTION_NOT_FOUND" : "NETWORK_ERROR";
          let detail;
          try { detail = await error.context?.json(); code = detail?.code || code; } catch (_) { /* Response can be missing after a network error. */ }
          throw Object.assign(new Error(code), { code, requestId: detail?.requestId, retryAfter: detail?.retryAfter });
        }
        return data;
      },
      async subscribe(topic, changed, identity) {
        const owner = client;
        const channel = owner.channel(topic, { config: { private: true, presence: { key: M.uuid() } } });
        let subscribed = false, signature = "", presenceTimer;
        const track = () => {
          if (!subscribed) return;
          const note = document.activeElement?.id === "triplogSharedNote" && !document.activeElement.disabled;
          const entry = { userId: identity.accountId, tripId: getActiveTripId(), editing: note ? "notes" : document.activeElement?.form?.id === "itineraryForm" ? "itinerary" : document.activeElement?.form?.id === "expenseForm" ? "expense" : "", ...(note ? { selection: window.TripLog.sync.notes?.presence() } : {}) };
          const next = JSON.stringify(entry); if (next === signature) return; signature = next; channel.track(entry);
        };
        channel.on("broadcast", { event: "changed" }, changed)
          .on("presence", { event: "sync" }, () => window.dispatchEvent(new CustomEvent("triplog:presence", { detail: { tripId: identity.localId, members: channel.presenceState() } })))
          .subscribe(status => { if (status === "SUBSCRIBED") { subscribed = true; signature = ""; track(); changed(); } else subscribed = false; });
        const notePresence = () => { if (!presenceTimer) presenceTimer = setTimeout(() => { presenceTimer = null; track(); }, 300); };
        window.addEventListener("triplog:note-presence", notePresence);
        window.addEventListener("triplog:state-saved", track); document.addEventListener("focusin", track);
        return () => { clearTimeout(presenceTimer); window.removeEventListener("triplog:note-presence", notePresence); window.removeEventListener("triplog:state-saved", track); document.removeEventListener("focusin", track); return owner.removeChannel(channel); };
      },
    },
    onChange(localId) { window.TripLog.persistence.stateStorage.applyRepositoryChange?.(localId); },
  });
  engine.subscribe(() => {
    if (engine.status().error?.code === "UPGRADE_REQUIRED") window.TripLog.sync.lifecycle?.checkForUpdate();
    window.dispatchEvent(new CustomEvent("triplog:sync-status"));
  });
  function setLocalFailure(error, id = typeof state === "undefined" ? "" : state.id) { if (error) localFailures.set(id, { message: error.message || String(error), at: Date.now() }); else localFailures.delete(id); window.dispatchEvent(new CustomEvent("triplog:sync-status")); }
  function localWrite(id, delta) { localWrites.set(id, Math.max(0, (localWrites.get(id) || 0) + delta)); window.dispatchEvent(new CustomEvent("triplog:sync-status")); }
  async function connect(nextClient, nextAccount, projectId = "", { isCurrent = () => true } = {}) {
    await window.TripLog.persistence.stateStorage.ready;
    if (!isCurrent()) return;
    client = nextClient; account = nextAccount;
    const scope = `${projectId}:${account?.id || ""}`;
    if (connection === scope) return initializing;
    connection = scope;
    if (!account) { engine.stop(); return; }
    const token = ++connecting;
    engine.stop();
    const actor = account.id;
    initializing = (async () => {
      await window.TripLog.persistence.stateStorage.activateAccount?.(actor, projectId);
      if (token !== connecting) return;
      await engine.start(actor, projectId);
      if (token === connecting) await window.TripLog.persistence.stateStorage.activateAccount?.(actor, projectId);
    })().catch(error => { if (token === connecting) connection = null; throw error; });
    return initializing;
  }
  function disconnect() { connecting++; connection = null; account = null; client = null; engine.stop(); window.TripLog.persistence.stateStorage.activateAccount?.("").catch(setLocalFailure); window.dispatchEvent(new CustomEvent("triplog:sync-status")); }
  function status(localId = typeof state === "undefined" ? "" : state.id) {
    const runtime = engine.status();
    const record = R.cached(localId);
    const pending = (record?.queue.length || 0) + (!record?.serverId && !record?.quarantined && !record?.placeholder && record?.localRevision > 0 ? 1 : 0);
    const localFailure = localFailures.get(localId);
    const drafts = window.TripLog.sync.drafts?.inMemory(localId) || [];
    if (drafts.some(d => !d.persisted) && !localWrites.get(localId)) return { tone: "error", label: "초안 저장 재시도 필요", detail: "입력 내용을 그대로 유지했습니다. 연결과 기기 저장 공간을 확인하면 다시 저장할 수 있어요.", pending };
    if (localFailure) return { tone: "error", label: "기기에 저장하지 못함", detail: localFailure.message, pending };
    if (localWrites.get(localId)) return { tone: "saving", label: "기기에 저장 중", detail: "입력 내용을 기기 저장소에 기록하고 있습니다.", pending };
    if (record?.removal && !record.removedAt) return { tone: "warning", label: "여행 삭제 결과 확인 필요", detail: "여행 목록에서 삭제를 다시 누르면 같은 요청으로 결과를 확인합니다.", pending };
    if (record?.archivedAt) return { tone: "local", label: "보관된 여행", detail: "현재 내용은 읽기 전용입니다. 소유자가 복구 기록에서 다시 열 수 있습니다.", pending };
    if (record?.quarantined) return { tone: "local", label: "보관 사본", detail: "이 기기에 보관된 사본입니다. 내용을 확인한 뒤 새 공유 여행으로 저장할 수 있습니다.", pending };
    if (!runtime.active) return { tone: "local", label: "기기에 보관됨", detail: "로그인하면 이 계정의 공유 여행을 자동으로 연결합니다.", pending };
    if (record?.conflicts.length) return { tone: "warning", label: "변경 내용 확인 필요", detail: "양쪽 내용을 보존했습니다. 충돌한 항목을 확인해 주세요.", pending };
    if (record?.role === "viewer") return { tone: pending ? "warning" : "saved", label: "보기 전용 여행", detail: pending ? "편집 권한이 바뀌기 전에 작성한 변경을 기기에 보관하고 있습니다." : "변경 내용은 자동으로 받아 표시합니다.", pending };
    if (record?.lastError) return { tone: "warning", label: record.lastError.code === "FORBIDDEN" ? "여행 접근 권한 확인 필요" : "일부 변경 전송 대기", detail: `기기에서 내용을 보존하고 있습니다. (${record.lastError.code})`, pending, retryable: true };
    if (runtime.error) {
      const code = runtime.error.code;
      if (code === "UPGRADE_REQUIRED") return { tone: "saving", label: "자동 연결 중", detail: "기록을 안전하게 보관하며 연결을 자동으로 준비하고 있어요.", pending };
      const messages = { FUNCTION_NOT_FOUND: "연결 재시도 중", UNAUTHENTICATED: "다시 로그인 필요", FORBIDDEN: "여행 접근 권한 확인 필요" };
      return { tone: "warning", label: navigator.onLine === false ? `오프라인 · 변경 ${pending}건 보관 중` : messages[code] || "연결 재시도 중", detail: "저장된 내용은 보존하며 연결 가능한 작업을 자동으로 다시 시도합니다.", pending, retryable: !messages[code] };
    }
    if (navigator.onLine === false) return { tone: "offline", label: `오프라인 · 변경 ${pending}건 보관 중`, detail: record?.lastConfirmedAt || "연결 복구 후 자동으로 전송합니다.", pending };
    if (pending || runtime.running) return { tone: "saving", label: "저장 중", detail: `서버 확인 대기 ${pending}건`, pending };
    if (drafts.length) return { tone: "local", label: "초안 기기에 보관됨", detail: "작성 중인 입력을 보관했습니다. 입력창에서 추가·저장을 완료하면 자동으로 공유됩니다.", pending };
    if (!record?.serverId) return { tone: "local", label: "기기에 보관됨", detail: record?.quarantined ? "이관 사본을 확인해 주세요." : "여행 변경을 저장하면 자동으로 서버에 연결합니다.", pending };
    const partlyLocal = record.snapshot.collaboration?.privacy?.shareItinerary === false || record.snapshot.collaboration?.privacy?.shareExpenses === false;
    return { tone: "saved", label: partlyLocal ? "공유 내용 저장됨" : "모두 저장됨", detail: partlyLocal ? "공유를 끈 내용은 이 기기에 보관됩니다. 공유 항목은 서버에 저장했습니다." : record.lastConfirmedAt ? `마지막 저장 ${new Date(record.lastConfirmedAt).toLocaleString("ko-KR")}` : "현재 여행의 공유 내용이 서버와 연결되었습니다.", pending };
  }
  async function request(action, localId, extra = {}) {
    const identity = engine.status();
    const record = await R.read(localId);
    if (identity.accountId !== engine.status().accountId || identity.projectId !== engine.status().projectId || !engine.status().active) throw new Error("SESSION_CHANGED");
    if (!record?.serverId) throw new Error("서버 연결을 기다려 주세요.");
    if (record.accountId !== identity.accountId || (record.projectId && record.projectId !== identity.projectId)) throw new Error("FORBIDDEN");
    return engine.request({ action, tripId: record.serverId, ...extra });
  }
  async function attachmentUrl(localId, reference) {
    const actor = account?.id;
    const scope = connection;
    const checkAccount = () => { if (!actor || actor !== account?.id || connection !== scope) throw new Error("SESSION_CHANGED"); };
    const record = await R.read(localId);
    checkAccount();
    if (!record || record.accountId !== actor) throw new Error("FORBIDDEN");
    const cacheKey = `attachment:${actor}:${record.serverId}:${reference}`;
    const cached = await R.draft(cacheKey);
    checkAccount();
    if (cached?.data) return cached.data;
    const result = await request("attachment-download", localId, { reference });
    const response = await fetch(result.url);
    if (!response.ok) throw new Error("ATTACHMENT_UNAVAILABLE");
    const blob = await response.blob();
    if (blob.size > 1572864) throw new Error("INVALID_ATTACHMENT_SIZE");
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    checkAccount();
    await R.draft(cacheKey, { data, kind: "attachment", tripId: localId, accountId: actor });
    checkAccount();
    return data;
  }
  async function publishCopy(localId) {
    const identity = engine.status();
    if (!identity.active) throw new Error("로그인 후 공유 여행으로 저장해 주세요.");
    const record = await R.read(localId);
    if (!record?.quarantined || record.serverId) throw new Error("공유할 보관 사본을 찾지 못했습니다.");
    const snapshot = M.clone(record.snapshot);
    for (const item of snapshot.itineraryItems || []) if (String(item.voucherFile || "").startsWith("triplog-attachment:")) item.voucherFile = await attachmentUrl(snapshot._syncRecovery?.sourceLocalId, item.voucherFile);
    const documents = Object.values(M.apply(record.base || {}, record.queue.flatMap(q => q.patches)).entities).filter(e => !e.deleted && ["note_update", "comment"].includes(e.kind));
    if (documents.length && snapshot.collaboration?.privacy?.shareItinerary === false) throw new Error("공동 메모와 댓글을 포함한 사본은 일정 공유를 켠 뒤 공유 여행으로 저장해 주세요.");
    const intents = documents.map(entity => {
      const fields = M.clone(entity.fields); delete fields["p:authorId"]; delete fields["p:createdAt"];
      return { id: M.uuid(), status: "queued", createdAt: Date.now(), dependsOn: [], patches: [{ kind: entity.kind, id: M.uuid(), action: "create", before: null, expectedVersion: 0, fields }] };
    });
    if (engine.status().accountId !== identity.accountId || engine.status().projectId !== identity.projectId) throw new Error("계정이 변경됐습니다. 다시 확인해 주세요.");
    snapshot.collaboration = { ownerId: identity.accountId, privacy: snapshot.collaboration?.privacy || {} };
    await R.update(localId, fresh => {
      if (engine.status().accountId !== identity.accountId || engine.status().projectId !== identity.projectId || !engine.status().active) throw new Error("SESSION_CHANGED");
      if (fresh.localRevision !== record.localRevision) throw new Error("사본이 변경됐습니다. 내용을 확인한 뒤 다시 시도해 주세요.");
      return { ...fresh, snapshot, base: null, queue: intents, conflicts: [], quarantined: false, accountId: identity.accountId, projectId: identity.projectId, localRevision: fresh.localRevision + 1 };
    }, { snapshot: true, source: "before-copy-publish" });
    engine.wake(0);
  }
  window.TripLog.register("sync.controller", { engine, connect, disconnect, status, setLocalFailure, localWrite, request, attachmentUrl, publishCopy, getAccount: () => account, retry: () => engine.wake(0), canReload: () => !localFailures.size && ![...localWrites.values()].some(Boolean) && !(window.TripLog.sync.drafts?.inMemory() || []).some(row => !row.persisted) });
})();
