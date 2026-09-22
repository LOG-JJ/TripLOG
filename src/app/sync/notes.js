(function () {
  "use strict";
  const R = window.TripLogSyncRepository, M = window.TripLogSyncModel;
  const controller = window.TripLog.sync.controller;
  let current;
  const encode = bytes => { let text = ""; for (const b of bytes) text += String.fromCharCode(b); return btoa(text); };
  const decode = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));
  function unmount() { current?.unsubscribe?.(); current?.presenceUnsubscribe?.(); current?.doc.destroy(); current = null; }
  function presence() {
    if (!current || current.input.disabled) return null;
    const Y = window.TripLogY;
    return { anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(current.text, Math.min(current.input.selectionStart,current.text.length))), head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(current.text, Math.min(current.input.selectionEnd,current.text.length))) };
  }
  async function mount(parent, tripId, force = false) {
    if (!force && current?.tripId === tripId && parent.contains(current.input)) return;
    unmount();
    parent.replaceChildren();
    const Y = window.TripLogY;
    if (!Y) { parent.textContent = "공동 메모를 불러오지 못했습니다."; return; }
    const label = document.createElement("label"); label.textContent = "여행 공동 메모"; label.htmlFor = "triplogSharedNote";
    const help = document.createElement("p"); help.textContent = "입력은 기기에 보관한 뒤 자동 공유됩니다. 다른 사람과 같은 문장을 함께 편집할 수 있습니다.";
    const input = document.createElement("textarea"); input.id = "triplogSharedNote"; input.className = "sync-note-input"; input.maxLength = 100000;
    const message = document.createElement("p"); message.setAttribute("role", "status");
    const colleagues = document.createElement("p"); colleagues.className = "sync-note-presence";
    parent.append(label, help, input, message, colleagues);
    const ctx = { tripId, doc: new Y.Doc(), input, seen: new Map(), saving: 0, writes: Promise.resolve(), composing: false };
    ctx.text = ctx.doc.getText("body"); current = ctx;
    const remotePresence = event => {
      if (event.detail.tripId !== tripId || current !== ctx) return;
      const rows = [...new Map(Object.values(event.detail.members).flat().filter(p => p.tripId === tripId && p.editing === "notes" && p.userId !== controller.engine.status().accountId).map(p => [p.userId,p])).values()];
      colleagues.textContent = rows.map((row,index) => {
        try { const position = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(row.selection?.head), ctx.doc); return `동행 ${index+1} · ${position ? `${position.index+1}번째 글자 위치` : "메모 작성 중"}`; }
        catch (_) { return `동행 ${index+1} · 메모 작성 중`; }
      }).join(" / ");
    };
    window.addEventListener("triplog:presence", remotePresence);ctx.presenceUnsubscribe=()=>window.removeEventListener("triplog:presence",remotePresence);
    async function receive() {
      const record = await R.read(tripId);
      if (current !== ctx || !record) return;
      if (ctx.noteGeneration !== undefined && ctx.noteGeneration !== (record.noteGeneration || 0)) { await mount(parent, tripId, true); return; }
      ctx.noteGeneration = record.noteGeneration || 0;
      if (ctx.composing) return;
      input.disabled = record.role === "viewer" || Boolean(record.archivedAt) || record.snapshot.collaboration?.privacy?.shareItinerary === false;
      if (input.disabled) message.textContent = "보기 전용이거나 일정 공유가 꺼져 있습니다.";
      else if (!ctx.saving) message.textContent = controller.status(tripId).label;
      const entities = M.apply(record.base || {}, record.queue.flatMap(q => q.patches)).entities;
      const start = Y.createRelativePositionFromTypeIndex(ctx.text, Math.min(input.selectionStart, ctx.text.length));
      const end = Y.createRelativePositionFromTypeIndex(ctx.text, Math.min(input.selectionEnd, ctx.text.length));
      for (const row of Object.values(entities)) {
        const update = row.fields?.["p:update"];
        if (row.kind !== "note_update" || row.deleted || row.fields["p:document"] !== "shared-notes" || !update || ctx.seen.get(row.id) === update) continue;
        try { Y.applyUpdate(ctx.doc, decode(update), "remote"); ctx.seen.set(row.id, update); }
        catch (_) { message.textContent = "메모 변경을 읽지 못했습니다. 저장 상태를 확인해 주세요."; }
      }
      if (input.value !== ctx.text.toString()) {
        input.value = ctx.text.toString();
        if (document.activeElement === input) {
          const a = Y.createAbsolutePositionFromRelativePosition(start, ctx.doc), b = Y.createAbsolutePositionFromRelativePosition(end, ctx.doc);
          input.setSelectionRange(a?.index ?? input.value.length, b?.index ?? input.value.length);
        }
      }
    }
    ctx.doc.on("update", (update, origin) => {
      if (origin === "remote") return;
      ctx.saving++; controller.localWrite(tripId, 1); message.textContent = "기기에 저장 중…";
      ctx.writes = ctx.writes.then(() => R.update(tripId, record => {
        if (!record) throw new Error("여행 저장소를 찾지 못했습니다.");
        const pending = record.queue.find(q => !q.request && q.status === "queued" && q.patches.length === 1 && q.patches[0].kind === "note_update" && q.patches[0].fields["p:document"] === "shared-notes");
        if (pending) pending.patches[0].fields["p:update"] = encode(Y.mergeUpdates([decode(pending.patches[0].fields["p:update"]), update]));
        else record.queue.push({ id: M.uuid(), status: "queued", createdAt: Date.now(), dependsOn: record.queue.filter(q => q.patches.some(p => p.kind === "note_update")).map(q => q.id), patches: [{ kind: "note_update", id: M.uuid(), action: "create", before: null, expectedVersion: 0, fields: { "p:document": "shared-notes", "p:update": encode(update) } }] });
        record.localRevision++;
        record.placeholder = false;
        return record;
      })).then(() => { controller.setLocalFailure(null, tripId); if (current === ctx) message.textContent = "기기에 보관했습니다. 자동 공유 중입니다."; })
        .catch(error => { controller.setLocalFailure(error, tripId); if (current === ctx) message.textContent = "기기에 저장하지 못했습니다. 입력한 메모를 복사해 보관해 주세요."; })
        .finally(() => { ctx.saving--; controller.localWrite(tripId, -1); });
    });
    function updateText() {
      if (current !== ctx || input.disabled) return;
      const previous = ctx.text.toString(), next = input.value;
      let start = 0, end = 0;
      while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
      while (end < previous.length - start && end < next.length - start && previous[previous.length - 1 - end] === next[next.length - 1 - end]) end++;
      ctx.doc.transact(() => {
        if (previous.length - start - end) ctx.text.delete(start, previous.length - start - end);
        if (next.length - start - end) ctx.text.insert(start, next.slice(start, next.length - end));
      }, "local");
    }
    input.addEventListener("input", event => { if (!event.isComposing) updateText(); });
    input.addEventListener("compositionstart", () => { ctx.composing = true; });
    input.addEventListener("compositionend", () => { ctx.composing = false; updateText(); receive(); });
    for (const event of ["input", "select", "keyup", "pointerup"]) input.addEventListener(event, () => window.dispatchEvent(new CustomEvent("triplog:note-presence")));
    ctx.unsubscribe = R.subscribe(id => { if (id === tripId) receive(); });
    await receive();
  }
  window.TripLog.register("sync.notes", { mount, unmount, presence });
})();
