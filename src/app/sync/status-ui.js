(function () {
  "use strict";
  const R = window.TripLogSyncRepository, M = window.TripLogSyncModel;
  const controller = window.TripLog.sync.controller;
  const P = window.TripLog.sync.presentation;
  let dialog, content, selected = "status", viewedTrip, busy = false, drawing = 0;
  const presence = new Map();
  const expanded = new Map();
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  function button(label, action) { const node = element("button", label, "rd-button"); node.type = "button"; node.addEventListener("click", action); return node; }
  function icon(name) { const node = element("i", null, `ph ph-${name}`); node.setAttribute("aria-hidden", "true"); return node; }
  function remember(details, key, initiallyOpen = false) {
    details.open = expanded.get(key) ?? initiallyOpen;
    details.addEventListener("toggle", () => { if (details.isConnected) expanded.set(key, details.open); });
  }
  async function perform(fn) {
    if (busy) return;
    busy = true;
    const controls = [...content.querySelectorAll("button")].map(node => [node, node.disabled]);
    for (const [node] of controls) node.disabled = true;
    content.setAttribute("aria-busy", "true");
    try { await fn(); await draw(); }
    catch (error) { const message = element("p", error.message || "처리하지 못했습니다.", "sync-error"); message.setAttribute("role", "alert"); content.prepend(message); }
    finally { busy = false; content.setAttribute("aria-busy", "false"); for (const [node, disabled] of controls) if (node.isConnected) node.disabled = disabled; }
  }
  async function exportDiagnostics() {
    const identity = controller.engine.status();
    const records = (await R.all()).filter(r => (!r.accountId || r.accountId === identity.accountId) && (!r.projectId || r.projectId === identity.projectId));
    const report = { schemaVersion: 1, protocolVersion: 2, generatedAt: new Date().toISOString(), online: navigator.onLine, userAgent: navigator.userAgent,
      connected: identity.active, errorCode: identity.error?.code || null, requestId: identity.error?.requestId || null,
      trips: records.map(r => ({ tripId: r.localId, serverConnected: Boolean(r.serverId), cursor: r.cursor, revision: r.localRevision, role: r.role, pendingCount: r.queue.length, conflictCount: r.conflicts.length, lastConfirmedAt: r.lastConfirmedAt,
        operations: r.queue.map(q => ({ operationId: q.id, status: q.status, createdAt: q.createdAt, transmitted: Boolean(q.request), dependencyCount: q.dependsOn.length })) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `TripLOG-진단-${Date.now()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function render() {
    const control = els.itineraryPageButton;
    if (!control) return;
    const status = controller.status();
    const compact = P.badge(status, R.cached(state.id));
    control.dataset.syncTone = status.tone;
    control.dataset.syncMotion = compact.motion;
    control.classList.remove("is-dirty", "is-syncing", "is-synced", "is-warning");
    control.disabled = false;
    control.title = `${status.label}${compact.label !== status.label ? ` · ${compact.label}` : ""} · 저장 상태 자세히 보기`;
    control.setAttribute("aria-label", control.title);
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-busy", "false");
    let label = control.querySelector("[data-sync-label]");
    if (!label || !control.querySelector(".sync-cloud")) {
      const cloud = element("span", null, "sync-cloud"); cloud.setAttribute("aria-hidden", "true");
      const outline = element("span", null, "sync-cloud-outline");
      const symbol = icon(compact.icon); symbol.classList.add("sync-badge-icon");
      cloud.append(outline, symbol, element("span", null, "sync-badge-dot"));
      label = element("span", null, "sync-badge-label"); label.dataset.syncLabel = "";
      control.replaceChildren(cloud, label);
    }
    control.querySelector(".sync-badge-icon").className = `ph ph-${compact.icon} sync-badge-icon`;
    label.textContent = compact.label;
    if (dialog?.open) updateHeader();
    if (dialog?.open && viewedTrip !== state.id) { viewedTrip = state.id; selected = "status"; draw(); }
  }
  function updateHeader() {
    const record = R.cached(state.id), runtime = controller.engine.status();
    const online = navigator.onLine !== false;
    const connected = online && runtime.active && !runtime.error && Boolean(record?.serverId) && !record?.lastError;
    const subtitle = dialog.querySelector(".sync-trip-name"); subtitle.textContent = `${state.tripName || "현재 여행"} · ${record?.serverId ? "자동 저장" : "기기 보관"}`;
    const connection = dialog.querySelector(".sync-connection"); connection.dataset.connected = String(connected);
    connection.lastChild.textContent = !online ? "오프라인" : connected ? "온라인 연결됨" : runtime.active ? "연결 확인 중" : "기기에 보관 중";
    for (const tab of dialog.querySelectorAll("[data-sync-tab]")) {
      if (tab.dataset.syncTab === selected) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
    }
    content.setAttribute("aria-labelledby", `sync-menu-${selected}`);
  }
  function comparisonPanel(data, label, mine, key) {
    const panel = element("div", null, `sync-comparison-side ${mine ? "is-local" : "is-shared"}`);
    const heading = element("div", null, "sync-side-label"); heading.append(icon(mine ? "laptop" : "users"), element("span", label));
    const value = element("div", null, "sync-value-line"); value.append(element("strong", data.headline, "sync-value"));
    if (data.caption) value.append(element("p", data.caption, "sync-value-caption"));
    panel.append(heading, value);
    if (data.date || data.endTime) panel.append(element("p", [data.date ? P.date(data.date) : "날짜 미정", data.endTime ? `${data.endTime}까지` : ""].filter(Boolean).join(" · "), "sync-value-date"));
    const rows = data.schedule ? data.rows.filter(row => !["날짜", "시작 시간", "종료 시간"].includes(row.label)) : data.rows;
    if (rows.length) {
      const details = element("details", null, "sync-field-details"); details.append(element("summary", "변경 정보 자세히"));
      const list = element("dl");
      for (const row of rows) list.append(element("dt", row.label), element("dd", row.value));
      details.append(list); remember(details, key); panel.append(details);
    }
    return panel;
  }
  function conflictCard(record, conflict, index, tripId) {
    const patches = conflict.patches || [];
    const previews = patches.map(patch => P.comparison(record, conflict, patch));
    const card = element("details", null, "sync-review-card"); card.dataset.conflictId = conflict.id;
    remember(card, conflict.id, index === 0);
    const summary = element("summary", null, "sync-review-summary");
    summary.append(element("span", String(index + 1), "sync-step"), element("strong", previews.length > 1 ? `함께 확인할 변경 ${previews.length}건` : previews[0]?.title || "변경 내용 확인", "sync-review-title"));
    if (previews.length === 1) summary.append(element("span", `${previews[0].kind} · ${previews[0].date}`, "sync-review-meta"));
    summary.append(icon("caret-down")); card.append(summary);
    const body = element("div", null, "sync-review-body");
    for (const [i, preview] of previews.entries()) {
      const row = element("section", null, "sync-patch-preview");
      if (previews.length > 1) row.append(element("h4", `${i + 1}. ${preview.title}`));
      const comparison = element("div", null, "sync-comparison");
      comparison.append(comparisonPanel(preview.local, "내 기기", true, `${conflict.id}:${i}:local`), icon("arrows-left-right"), comparisonPanel(preview.shared, preview.sharedLabel, false, `${conflict.id}:${i}:shared`));
      row.append(comparison); body.append(row);
    }
    if (patches.length > 1) body.append(element("p", `서로 연결된 변경 ${patches.length}건을 함께 적용합니다.`, "sync-group-hint"));
    if (conflict.source === "validation") body.append(element("p", "저장 조건을 확인해야 하는 변경입니다. 내용을 살펴보고 필요한 항목을 수정해 주세요.", "sync-group-hint"));
    const actions = element("div", null, "sync-resolution-actions");
    for (const [label, choice] of [["내 변경 적용", "local"], ["공유 내용 사용", "server"], ["내 사본 보관 후 공유 내용 사용", "copy"]]) {
      const action = button(label, () => perform(() => controller.engine.resolve(tripId, conflict.id, choice)));
      action.dataset.syncFocus = `${conflict.id}:${choice}`;
      action.className = `sync-action ${choice === "local" ? "sync-action-primary" : "sync-action-secondary"}`;
      actions.append(action);
    }
    body.append(actions); card.append(body); return card;
  }
  function statusContent(record, status, tripId) {
    const total = P.count(record), compact = P.badge(status, record);
    const notice = element("section", null, "sync-notice"); notice.dataset.tone = total ? "warning" : status.tone; notice.setAttribute("role", "status");
    const symbol = element("span", null, "sync-notice-symbol"); symbol.append(icon(total ? "warning-circle" : compact.icon));
    const copy = element("div"); copy.append(element("h3", total ? `확인이 필요한 변경 ${total}건` : status.label), element("p", total ? "양쪽 내용은 안전하게 보관되어 있어요." : status.detail));
    notice.append(symbol, copy); content.append(notice);
    if (total) {
      const intro = element("div", null, "sync-review-intro"); intro.append(element("h3", "어떤 내용을 반영할까요?"), element("p", "각 항목을 비교하고, 적용할 내용을 선택해 주세요.")); content.append(intro);
      for (const [index, conflict] of record.conflicts.entries()) content.append(conflictCard(record, conflict, index, tripId));
    } else {
      const overview = element("div", null, "sync-save-overview");
      const rows = [["cloud-check", "공유 상태", record?.serverId ? "여행 변경을 자동으로 주고받아요" : "이 기기에 여행을 보관하고 있어요"], ["arrows-clockwise", "전송 대기", `${record?.queue.length || 0}건`]];
      for (const [symbol, label, value] of rows) { const row = element("div", null, "sync-save-row"); row.append(icon(symbol), element("strong", label), element("span", value)); overview.append(row); }
      content.append(overview);
    }
    const colleagues = [...new Map((presence.get(tripId) || []).filter(p => p.tripId === tripId && p.userId !== controller.engine.status().accountId).map(p => [p.userId, p])).values()];
    if (colleagues.length) { const line = element("p", null, "sync-presence"); line.append(icon("users"), element("span", `동행 ${colleagues.length}명이 함께 보고 있어요${colleagues.some(p => p.editing) ? " · 작성 중" : ""}`)); content.append(line); }
    if (status.retryable) content.append(button("다시 시도", () => controller.retry()));
    if (record?.quarantined && !record.serverId) content.append(button("새 공유 여행으로 저장", () => perform(() => controller.publishCopy(tripId))));
    const diagnostics = element("details", null, "sync-diagnostics");
    const summary = element("summary"); summary.append(icon("wrench"), element("strong", "문제 해결 및 진단"), element("span", "진단 파일 저장, 연결 상태 확인", "sync-diagnostics-caption"), icon("caret-down"));
    const detail = element("div", null, "sync-diagnostics-body");
    detail.append(element("p", `현재 여행 · 전송 대기 ${record?.queue.length || 0}건`), button("문제 진단 파일 저장", () => perform(exportDiagnostics)), element("p", "진단 파일에는 일정 내용·예약번호·인증 정보가 포함되지 않습니다."));
    diagnostics.append(summary, detail); remember(diagnostics, "diagnostics"); content.append(diagnostics);
    return detail;
  }
  function summarize(snapshot) { return `${snapshot.tripName || "여행"} · 일정 ${snapshot.itineraryItems?.length || 0}개 · 지출 ${snapshot.entries?.length || 0}개`; }
  function describe(patch) {
    const names = { itinerary: "일정", expense: "지출", packing: "준비물", participant: "참여자", reservation: "예약", trip: "여행 정보", settings: "설정", split: "분담", share: "분담", progress: "진행 상태", note_update: "공동 메모", comment: "댓글" };
    return `${names[patch.kind] || patch.kind} · ${patch.action === "delete" ? "삭제" : patch.action === "create" ? "추가" : "변경"}`;
  }
  async function draw() {
    if (!dialog?.open) return;
    if (selected === "settlement" && document.activeElement?.id === "triplogSettlementLeader" && !busy) return;
    const tripId = state.id;
    const token = ++drawing, tab = selected;
    viewedTrip = tripId;
    const record = await R.read(tripId);
    const stale = () => token !== drawing || tripId !== state.id || !dialog.open || tab !== selected;
    if (stale()) return;
    updateHeader();
    if (selected === "notes") { window.TripLog.sync.comments?.unmount(); await window.TripLog.sync.notes?.mount(content, tripId); return; }
    window.TripLog.sync.notes?.unmount();
    if (selected === "comments") { await window.TripLog.sync.comments?.mount(content, tripId); return; }
    window.TripLog.sync.comments?.unmount();
    const focusKey = document.activeElement?.dataset.syncFocus;
    const scrollTop = content.scrollTop;
    content.replaceChildren();
    if (selected === "status") {
      const status = controller.status(tripId);
      const diagnostics = statusContent(record, status, tripId);
      const others = (await R.all()).filter(r => r.localId !== tripId && r.accountId === controller.engine.status().accountId && r.queue.length);
      if (stale()) return;
      for (const other of others) diagnostics.append(element("p", `${other.snapshot.tripName} · 변경 ${other.queue.length}건 보관 중`));
      content.scrollTop = scrollTop;
      if (focusKey) [...content.querySelectorAll("[data-sync-focus]")].find(node => node.dataset.syncFocus === focusKey)?.focus({ preventScroll: true });
    } else if (selected === "recovery") {
      content.append(element("p", "기존 여행을 유지한 채 선택한 기록을 별도 여행으로 복원합니다."));
      const identity = controller.engine.status();
      const archived = (await R.all()).filter(r => (r.hidden || r.archivedAt) && (!r.accountId || r.accountId === identity.accountId) && (!r.projectId || r.projectId === identity.projectId));
      if (stale()) return;
      for (const trip of archived) {
        const card = element("section", null, "sync-conflict"); card.append(element("strong", `${trip.snapshot.tripName} · 보관된 여행`));
        if (!trip.archivedAt || trip.role === "owner") card.append(button("여행 다시 열기", () => perform(async () => {
          if (trip.serverId && trip.role === "owner") await controller.engine.control(trip.localId, "restore", {});
          await R.update(trip.localId, r => ({ ...r, hidden: false, archivedAt: null }));
          await controller.engine.refresh();
        })));
        content.append(card);
      }
      const drafts = await window.TripLog.sync.drafts.list(tripId);
      if (stale()) return;
      for (const draft of drafts) {
        const card = element("section", null, "sync-conflict");
        card.append(element("strong", draft.value.formId === "itineraryForm" ? "작성 중이던 일정 초안" : "작성 중이던 지출 초안"), element("p", new Date(draft.savedAt).toLocaleString("ko-KR")));
        const details = element("details"); details.append(element("summary", "입력 내용 미리보기"));
        for (const value of Object.values(draft.value.fields)) if (value.value) details.append(element("p", value.value));
        card.append(details);
        if (draft.value.formId === "itineraryForm") card.append(button("새 일정으로 이어서 작성", () => window.TripLog.sync.drafts.resume(draft)));
        card.append(button("초안 삭제", async () => {
          if (busy) return;
          const accountId = controller.engine.status().accountId;
          const subject = draft.value.formId === 'itineraryForm' ? '작성 중인 일정' : '작성 중인 지출';
          if (!await window.TripLog.ui.confirmation.ask({ kind: 'draft', subject }) || state.id !== tripId || controller.engine.status().accountId !== accountId) return;
          await perform(async () => {
            const latest = (await window.TripLog.sync.drafts.list(tripId)).find(row => row.id === draft.id);
            if (!latest) return;
            if (latest.savedAt !== draft.savedAt) throw new Error('초안이 변경됐어요. 다시 확인해 주세요.');
            await window.TripLog.sync.drafts.discard(latest);
          });
        }));
        content.append(card);
      }
      const snapshots = await R.snapshots(tripId);
      if (stale()) return;
      if (!snapshots.length) content.append(element("p", "아직 자동 복구 기록이 없습니다."));
      for (const snapshot of snapshots.slice(0, 100)) {
        const card = element("section", null, "sync-conflict");
        const source = { "legacy-original": "기존 기기 원본", "before-server-bind": "서버 연결 전", "before-remote-change": "공동 변경 수신 전", "before-delete": "삭제 전", "before-conflict-resolution": "충돌 확인 전", "before-trip-hide": "여행 보관 전", "before-history-restore": "기록 복원 전" }[snapshot.source] || "자동 복구 기록";
        card.append(element("strong", summarize(snapshot.state)), element("p", `${new Date(snapshot.timestamp).toLocaleString("ko-KR")} · ${source}`));
        const preview = element("details"); preview.append(element("summary", "일정 미리보기"));
        for (const item of (Array.isArray(snapshot.state.itineraryItems) ? snapshot.state.itineraryItems : [])) if (item) preview.append(element("p", `${item.date || "날짜 미정"} ${item.time || ""} · ${item.place || "장소 미정"}`));
        card.append(button("이 기록 JSON 저장", () => downloadArchiveJson({ app: "TripLOG", schemaVersion: 3, exportedAt: new Date().toISOString(), trips: [snapshot.state], records: [] })));
        card.append(preview, button("사본으로 복원", () => perform(async () => {
          const copy = { ...M.clone(snapshot.state), id: M.uuid(), tripName: `${snapshot.state.tripName} (복원 사본)` };
          copy.collaboration = { ownerId: controller.engine.status().accountId, privacy: { ...copy.collaboration?.privacy } };
          await window.TripLog.persistence.stateStorage.importSharedTripSnapshot(copy);
          dialog.close();
        })));
        content.append(card);
      }
    } else if (selected === "settlement") {
      const result = await controller.request("settlement-preview", tripId);
      if (stale()) return;
      const money = value => `${Number(value).toLocaleString("ko-KR")}원`;
      content.append(element("h3", `서버 확인 지출 ${money(result.calculation.total)}`), element("p", "현재 공유 지출과 참여자의 분담을 서버에서 다시 계산했습니다. 실제 송금은 별도로 진행해 주세요."));
      const leaderLabel = element("label", "기본 결제자 이름"); leaderLabel.htmlFor = "triplogSettlementLeader";
      const leader = element("input"); leader.id = "triplogSettlementLeader"; leader.maxLength = 80; leader.value = record.snapshot.settlement?.leaderName || "여행 대표";
      if (record.role !== "viewer" && !record.archivedAt) content.append(leaderLabel, leader, button("이름 저장", () => perform(async () => {
        const value = leader.value.trim(); if (!value) throw new Error("기본 결제자 이름을 입력해 주세요.");
        const snapshot = M.clone(record.snapshot); snapshot.settlement.leaderName = value;
        await R.save(snapshot, record.snapshot);
      })), element("p", "기본 결제자는 여행의 돈을 계산하는 참여자입니다. 소유권을 넘겨도 기존 결제자는 바뀌지 않습니다."));
      for (const member of result.calculation.members) content.append(element("p", `${member.name} · 결제 ${money(member.paid)} · 부담 ${money(member.owed)}`));
      for (const transfer of result.calculation.transfers) {
        const name = key => result.calculation.members.find(m => m.key === key)?.name || "동행";
        content.append(element("p", `${name(transfer.from)} → ${name(transfer.to)} · ${money(transfer.amount)}`));
      }
      if (result.finalized) content.append(element("p", result.stale ? "이전에 확정한 뒤 금액·분담·참여자가 바뀌었습니다. 현재 계산을 다시 확인해 주세요." : `현재 내용 확정됨 · ${new Date(result.finalized.created_at).toLocaleString("ko-KR")}`));
      const blocked = record.queue.length || record.conflicts.length || record.role === "viewer" || record.archivedAt || window.TripLog.sync.drafts.inMemory(tripId).length;
      if (blocked) content.append(element("p", "초안·전송 대기·충돌을 정리하고 편집 권한이 있는 상태에서 정산을 확정할 수 있습니다."));
      const operationId = M.uuid();
      const finalize = button("이 계산으로 정산 확정", () => perform(async () => {
        const current = await R.read(tripId);
        if (current.queue.length || current.conflicts.length) throw new Error("아직 반영되지 않은 변경이 있습니다. 저장 완료 후 다시 확인해 주세요.");
        const response = await controller.request("settlement-finalize", tripId, { operationId, sourceHash: result.sourceHash });
        await R.update(tripId, r => ({ ...r, finalizedSettlement: response.finalized }));
      }));
      finalize.disabled = Boolean(blocked || (result.finalized && !result.stale)); content.append(finalize);
    } else if (selected === "activity") {
      const result = await controller.request("history", tripId);
      if (stale()) return;
      if (!result.history.length) content.append(element("p", "아직 서버 변경 기록이 없습니다."));
      for (const entry of result.history) {
        const card = element("section", null, "sync-conflict");
        card.append(element("strong", `변경 #${entry.sequence}`), element("p", new Date(entry.created_at).toLocaleString("ko-KR")));
        for (const row of entry.changes) card.append(element("p", describe({ kind: row.kind, action: row.deleted_at ? "delete" : "patch" })));
        if ((record.role === "owner" || entry.actor_id === controller.engine.status().accountId) && record.role !== "viewer" && !entry.changes.some(row => row.kind === "note_update")) card.append(button("이 변경 되돌리기", () => perform(async () => {
          if (!await window.TripLog.ui.confirmation.ask({ title: '변경을 되돌릴까요?', subject: `변경 #${entry.sequence}`, message: '삭제된 기록도 복원돼요.\n모든 기기에 반영돼요.', confirmLabel: '되돌리기' }) || state.id !== tripId) return;
          try { await controller.engine.control(tripId, "restore-change", { sequence: entry.sequence, operationId: M.uuid() }); }
          catch (error) { if ((error.code || error.message) === "HISTORY_CHANGED") throw new Error("이후에 수정된 항목이 있어 최신 내용을 유지했습니다."); throw error; }
          await controller.engine.refresh();
        })));
        content.append(card);
      }
    } else if (selected === "members") {
      const result = await controller.request("members", tripId);
      if (stale()) return;
      for (const member of result.members) {
        const card = element("section", null, "sync-conflict");
        card.append(element("strong", member.display_name || "여행 멤버"), element("span", ` · ${member.role === "owner" ? "소유자" : member.role === "viewer" ? "보기 전용" : "편집 가능"}`));
        if (record.role === "owner" && member.role !== "owner") {
          const select = element("select"); select.setAttribute("aria-label", `${member.display_name || "멤버"} 권한`);
          for (const [value, label] of [["editor", "편집 가능"], ["viewer", "보기 전용"]]) { const option = element("option", label); option.value = value; select.append(option); }
          select.value = member.role === "viewer" ? "viewer" : "editor";
          card.append(select, button("권한 저장", () => perform(async () => { await controller.engine.control(tripId, "member", { userId: member.user_id, role: select.value }); await controller.engine.refresh(); })));
          card.append(button("멤버 내보내기", async () => {
            if (busy || !await window.TripLog.ui.confirmation.ask({ kind: 'member', subject: member.display_name || '여행 멤버' }) || state.id !== tripId) return;
            await perform(async () => {
              await controller.engine.control(tripId, "member", { userId: member.user_id, role: "remove" }); await controller.engine.refresh();
            });
          }), button("소유권 넘기기", () => perform(async () => {
            if (!await window.TripLog.ui.confirmation.ask({ title: '소유권을 넘길까요?', subject: member.display_name || '여행 멤버', message: '내 권한은 편집자로 바뀌어요.', confirmLabel: '넘기기' }) || state.id !== tripId) return;
            await controller.engine.control(tripId, "transfer-owner", { userId: member.user_id }); await controller.engine.refresh();
          })));
        }
        content.append(card);
      }
      if (record.role !== "owner") content.append(button("공유 여행 나가기", async () => {
        if (busy || !await window.TripLog.ui.confirmation.ask({ kind: 'leave', subject: record.snapshot.tripName || '공유 여행' }) || state.id !== tripId) return;
        await perform(async () => {
          await controller.engine.control(tripId, "leave", {});
          await R.update(tripId, r => ({ ...r, hidden: true, lastError: { code: "FORBIDDEN", at: Date.now() } }), { snapshot: true, source: "before-trip-hide" });
          const identity = controller.engine.status();
          await window.TripLog.persistence.stateStorage.activateAccount(identity.accountId, identity.projectId);
        });
      }));
    }
  }
  function setup() {
    if (dialog) return;
    dialog = element("dialog", null, "sync-panel"); dialog.id = "triplogSyncStatus"; dialog.setAttribute("aria-labelledby", "triplogSyncTitle");
    const header = element("header", null, "sync-panel-header");
    const heading = element("h2", "저장 및 공동 작업"); heading.id = "triplogSyncTitle";
    const subline = element("div", null, "sync-panel-subline");
    const connection = element("span", null, "sync-connection"); connection.append(element("span", null, "sync-connection-dot"), element("span"));
    subline.append(element("span", "", "sync-trip-name"), connection);
    const close = button("", () => dialog.close()); close.className = "sync-close"; close.setAttribute("aria-label", "닫기"); close.append(icon("x"));
    header.append(heading, subline, close); dialog.append(header);
    const tabs = element("nav", null, "sync-tabs"); tabs.setAttribute("aria-label", "공동 작업 메뉴");
    for (const [value, label, symbol] of [["status", "저장 상태", "floppy-disk"], ["notes", "공동 메모", "chat-dots"], ["comments", "댓글·담당자", "users"], ["settlement", "정산 확정", "credit-card"], ["activity", "변경 기록", "note"], ["recovery", "복구 기록", "clock-counter-clockwise"], ["members", "멤버", "users-three"]]) {
      const tab = button("", () => { selected = value; updateHeader(); draw().catch(error => { content.replaceChildren(element("p", error.message, "sync-error")); }); });
      tab.id = `sync-menu-${value}`; tab.dataset.syncTab = value; tab.append(icon(symbol), element("span", label)); tabs.append(tab);
    }
    content = element("div", null, "sync-content");
    content.setAttribute("role", "region");
    const workspace = element("div", null, "sync-workspace"); workspace.append(tabs, content); dialog.append(workspace); document.body.append(dialog);
    dialog.addEventListener("close", () => { drawing++; window.TripLog.sync.notes?.unmount(); window.TripLog.sync.comments?.unmount(); });
    window.addEventListener("triplog:presence", event => { presence.set(event.detail.tripId, Object.values(event.detail.members).flat()); if (dialog.open && selected === "status" && !busy) draw().catch(() => {}); });
    window.addEventListener("triplog:sync-status", render);
    window.addEventListener("offline", render);
    window.addEventListener("online", render);
    R.subscribe(() => { render(); if (dialog.open && ["status", "settlement"].includes(selected) && !busy) draw().catch(() => {}); });
    render();
  }
  function open() { setup(); if (!dialog.open) dialog.showModal(); viewedTrip = state.id; draw().catch(error => content.replaceChildren(element("p", error.message, "sync-error"))); }
  window.TripLog.register("sync.statusUi", { setup, render, open });
})();
