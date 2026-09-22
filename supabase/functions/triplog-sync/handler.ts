import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import "../_shared/sync-model.js";
import "../_shared/settlement-model.js";
import { Doc, applyUpdate, encodeStateAsUpdate } from "npm:yjs@13.6.32";
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

const M = (globalThis as any).TripLogSyncModel;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const jsonReply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const allowedActions = new Set(["list", "read", "apply", "create", "control", "accept", "resolve", "history", "members", "attachment-upload", "attachment-download", "settlement-preview", "settlement-finalize"]);
function checkObject(value: any, depth = 0) {
  if (depth > 24) throw new Error("INPUT_TOO_DEEP");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("INVALID_FIELD");
    checkObject(child, depth + 1);
  }
}
async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return "sha256:" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function limitedBody(req: Request) {
  const reader = req.body?.getReader(); if (!reader) throw new Error("INVALID_BODY");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new Error("INVALID_PAYLOAD_SIZE"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function validateNewTrip(snapshot: any) {
  const date = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
  };
  if (typeof snapshot.id !== "string" || !snapshot.id || snapshot.id.length > 300 || typeof snapshot.tripName !== "string" || !snapshot.tripName.trim() || snapshot.tripName.length > 200) throw new Error("INVALID_TRIP");
  if (!date(snapshot.startDate) || !date(snapshot.endDate) || snapshot.startDate > snapshot.endDate) throw new Error("INVALID_DATE_RANGE");
  for (const key of ["itineraryItems", "entries", "packingList", "companions"]) if (snapshot[key] !== undefined && (!Array.isArray(snapshot[key]) || snapshot[key].length > 10000)) throw new Error("INVALID_COLLECTION");
  for (const item of snapshot.itineraryItems || []) {
    if (!item || typeof item !== "object" || !date(item.date) || typeof item.place !== "string" || item.place.length > 1000) throw new Error("INVALID_ITINERARY");
    for (const key of ["time", "endTime"]) if (item[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item[key])) throw new Error("INVALID_TIME");
    if (item.voucherFile) throw new Error("INVALID_INLINE_ATTACHMENT");
  }
  for (const entry of snapshot.entries || []) if (!entry || (entry.date !== "__pretrip__" && !date(entry.date)) || !Number.isSafeInteger(entry.amount) || entry.amount < 0) throw new Error("INVALID_EXPENSE");
  for (const item of snapshot.itineraryItems || []) if (item.syncExpense && item.expenseId) {
    const expense = (snapshot.entries || []).find((e: any) => e.id === item.expenseId);
    if (!expense || expense.amount !== item.cost || expense.date !== item.date) throw new Error("INVALID_LINKED_EXPENSE");
  }
}

export async function handleRequest(req: Request) {
  const started = performance.now(), requestId = crypto.randomUUID(); let observedAction = "authenticate";
  const reply = (body: Record<string, unknown>, status = 200) => {
    console.info(JSON.stringify({ event: "triplog-sync", requestId, action: observedAction, status, durationMs: Math.round(performance.now() - started), code: body.code || null }));
    return jsonReply({ ...body, requestId }, status);
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const authKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try {
    const bearer = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer) return reply({ code: "UNAUTHENTICATED" }, 401);
    const auth = createClient(url, authKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(bearer);
    if (authError || !authData.user) return reply({ code: "UNAUTHENTICATED" }, 401);
    const actor = authData.user.id;
    const body = await limitedBody(req);
    checkObject(body);
    if (!allowedActions.has(body.action)) return reply({ code: "UNKNOWN_ACTION" }, 400);
    observedAction = body.action;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const rpc = async (name: string, parameters: any) => {
      const { data, error } = await admin.rpc(name, parameters);
      if (error) throw error;
      return data;
    };
    const category = body.action.startsWith("attachment-") ? "attachment" : body.action === "create" ? "create" : ["apply", "control", "accept", "settlement-finalize"].includes(body.action) ? "write" : "read";
    const allowed = await rpc("triplog_rate_limit", { p_actor: actor, p_category: category, p_limit: { attachment: 60, create: 20, write: 600, read: 1200 }[category] });
    if (!allowed) return reply({ code: "RATE_LIMITED", retryAfter: 60 }, 429);
    const role = async (tripId: string) => {
      const value = await rpc("triplog_sync_role", { p_actor: actor, p_trip: tripId });
      if (!value) throw new Error("FORBIDDEN");
      return value;
    };
    const read = (tripId: string, after: number | null = null) => rpc("triplog_read_sync", { p_actor: actor, p_trip: tripId, p_after: after });
    const noteDocument = async (tripId: string) => {
      const { data, error } = await admin.from("triplog_entities").select("data").eq("trip_id", tripId).eq("kind", "note_update").is("deleted_at", null);
      if (error) throw error;
      const doc = new Doc();
      try { for (const row of data || []) applyUpdate(doc, Uint8Array.from(atob(row.data["p:update"]), c => c.charCodeAt(0))); }
      catch (_) { doc.destroy(); throw new Error("INVALID_STORED_NOTE"); }
      return { doc, count: data?.length || 0, bytes: (data || []).reduce((total, row) => total + row.data["p:update"].length, 0) };
    };
    const compactNote = async (tripId: string) => {
      const { data: trip, error } = await admin.from("triplog_trips").select("sync_revision").eq("id", tripId).single();
      if (error) throw error;
      const { doc, count, bytes: storedBytes } = await noteDocument(tripId);
      try {
        if (count < 64 && storedBytes < 1048576) return;
        const bytes = encodeStateAsUpdate(doc); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
        await rpc("triplog_compact_note", { p_actor: actor, p_trip: tripId, p_head: trip.sync_revision, p_update: btoa(binary) });
      } finally { doc.destroy(); }
    };
    const initialize = async (row: any) => {
      if (row.collaboration_version === 2) return;
      const entities = M.shared(M.encode(row.travel_state), row.privacy);
      await rpc("triplog_initialize_sync", { p_actor: actor, p_trip: row.id, p_updated_at: row.updated_at, p_entities: Object.values(entities) });
    };
    const deliver = async (tripId: string) => {
      const { data: pending } = await admin.from("triplog_notification_outbox").select("sequence").eq("trip_id", tripId).is("delivered_at", null).order("sequence").limit(100);
      if (!pending?.length) return;
      const { data: trip } = await admin.from("triplog_trips").select("channel_epoch").eq("id", tripId).single();
      if (!trip) return;
      const channel = admin.channel(`triplog:${tripId}:${trip.channel_epoch}`, { config: { private: true } });
      try {
        const result = await channel.send({ type: "broadcast", event: "changed", payload: { head: pending.at(-1)?.sequence, protocolVersion: 2 } });
        if (result === "ok") await admin.from("triplog_notification_outbox").update({ delivered_at: new Date().toISOString() }).eq("trip_id", tripId).in("sequence", pending.map(p => p.sequence));
      } finally { await admin.removeChannel(channel); }
    };
    if (body.action === "list") {
      const { data: memberships, error: memberError } = await admin.from("triplog_trip_members").select("trip_id").eq("user_id", actor).eq("status", "accepted");
      if (memberError) throw memberError;
      const ids = (memberships || []).map(m => m.trip_id);
      const { data: rows, error } = await admin.from("triplog_trips").select("*").or(`owner_id.eq.${actor}${ids.length ? ",id.in.(" + ids.join(",") + ")" : ""}`);
      if (error) throw error;
      const trips = [];
      for (const row of rows || []) {
        await initialize(row);
        const current = await read(row.id);
        trips.push({ ...current, ownerId: row.owner_id });
        EdgeRuntime.waitUntil(deliver(row.id).catch(() => {}));
      }
      return reply({ protocolVersion: 2, trips });
    }
    if (body.action === "create") {
      if (!body.snapshot || typeof body.snapshot !== "object" || Array.isArray(body.snapshot)) throw new Error("INVALID_TRIP");
      validateNewTrip(body.snapshot);
      const snapshot = M.ensureIds(body.snapshot);
      delete snapshot._syncRecovery;
      snapshot.collaboration = { ...(snapshot.collaboration || {}), ownerId: actor, ownerEmail: authData.user.email || "", ownerName: String(authData.user.user_metadata?.display_name || "여행 소유자").slice(0,80), members: [], pendingInvites: [] };
      const entities = M.shared(M.encode(snapshot), snapshot.collaboration?.privacy);
      if (Object.keys(entities).length > 20000) throw new Error("INVALID_TRIP_SIZE_LIMIT");
      const sharedSnapshot = M.decode(entities, { id: snapshot.id, collaboration: snapshot.collaboration });
      const id = await rpc("triplog_create_sync", { p_actor: actor, p_app_id: snapshot.id, p_snapshot: sharedSnapshot, p_entities: Object.values(entities) });
      return reply({ ...(await read(id)), ownerId: actor });
    }
    if (body.action === "resolve") {
      const token = String(body.token || "");
      if (token.length < 12 || token.length > 256) throw new Error("INVALID_INVITE");
      const { data, error } = await admin.from("triplog_trip_invites").select("trip_id,app_trip_id,trip_name,expires_at,invite_role").in("token", [await tokenHash(token), token]).eq("status", "open").gt("expires_at", new Date().toISOString()).limit(1);
      if (error) throw error;
      if (!data?.length) throw new Error("INVALID_INVITE");
      return reply({ invite: data[0] });
    }
    if (body.action === "accept") {
      const token = String(body.token || "");
      if (token.length < 12 || token.length > 256) throw new Error("INVALID_INVITE");
      let id;
      try { id = await rpc("triplog_accept_sync_invite", { p_actor: actor, p_token: await tokenHash(token), p_name: authData.user.user_metadata?.display_name || "여행 멤버" }); }
      catch (error) {
        if (!String((error as Error).message).includes("INVALID_INVITE")) throw error;
        id = await rpc("triplog_accept_sync_invite", { p_actor: actor, p_token: token, p_name: authData.user.user_metadata?.display_name || "여행 멤버" });
      }
      const { data: row, error } = await admin.from("triplog_trips").select("*").eq("id", id).single();
      if (error) throw error;
      await initialize(row);
      return reply(await read(id));
    }
    const tripId = String(body.tripId || "");
    const currentRole = await role(tripId);
    if (body.action === "settlement-preview" || body.action === "settlement-finalize") {
      const current = await read(tripId);
      if (current.privacy?.shareExpenses === false) throw new Error("PRIVATE_DATA_NOT_SHARED");
      if (body.action === "settlement-finalize") {
        if (currentRole === "viewer") throw new Error("FORBIDDEN");
        if (!/^[a-f0-9-]{36}$/i.test(String(body.operationId || ""))) throw new Error("INVALID_OPERATION_ID");
        const { data: previous, error } = await admin.from("triplog_settlement_snapshots").select("*").eq("trip_id", tripId).eq("actor_id", actor).eq("operation_id", body.operationId).maybeSingle();
        if (error) throw error;
        if (previous) {
          if (previous.source_hash !== body.sourceHash) throw new Error("OPERATION_ID_REUSED");
          return reply({ finalized: previous });
        }
      }
      const snapshot = M.decode(M.fromRows(current.entities), { collaboration: { ownerName: "방장" } });
      const result = (globalThis as any).TripLogSettlement.calculate(snapshot);
      const sourceHash = (await tokenHash(JSON.stringify(result.source))).replace("sha256:", "");
      delete result.source;
      if (body.action === "settlement-preview") {
        const { data, error } = await admin.from("triplog_settlement_snapshots").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(1);
        if (error) throw error;
        return reply({ calculation: result, sourceHash, cursor: current.cursor, finalized: data?.[0] || null, stale: Boolean(data?.[0] && data[0].source_hash !== sourceHash) });
      }
      if (body.sourceHash !== sourceHash) throw new Error("SETTLEMENT_STALE");
      const finalized = await rpc("triplog_finalize_settlement", { p_actor: actor, p_trip: tripId, p_operation: body.operationId, p_cursor: current.cursor, p_hash: sourceHash, p_result: result });
      EdgeRuntime.waitUntil(deliver(tripId).catch(() => {}));
      return reply({ finalized });
    }
    if (body.action === "attachment-upload" || body.action === "attachment-download") {
      const { data: trip, error: tripError } = await admin.from("triplog_trips").select("privacy,archived_at").eq("id", tripId).single();
      if (tripError) throw tripError;
      if (trip.privacy?.shareItinerary === false && currentRole !== "owner") throw new Error("FORBIDDEN");
      const bucket = admin.storage.from("triplog-private-attachments");
      if (body.action === "attachment-download") {
        const digest = String(body.reference || "").replace(/^triplog-attachment:/, "");
        if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("INVALID_ATTACHMENT_REFERENCE");
        const { data: attachment, error } = await admin.from("triplog_attachments").select("object_path").eq("trip_id", tripId).eq("digest", digest).single();
        if (error || !attachment) throw new Error("INVALID_ATTACHMENT_REFERENCE");
        const { data, error: signError } = await bucket.createSignedUrl(attachment.object_path, 60, { download: true });
        if (signError) throw signError;
        return reply({ url: data.signedUrl });
      }
      if (currentRole === "viewer") throw new Error("FORBIDDEN");
      if (trip.archived_at) throw new Error("TRIP_ARCHIVED");
      const match = String(body.data || "").match(/^data:(image\/(?:jpeg|png|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new Error("INVALID_ATTACHMENT_TYPE");
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      if (!bytes.length || bytes.length > 1572864) throw new Error("INVALID_ATTACHMENT_SIZE");
      const header = new TextDecoder("latin1").decode(bytes.slice(0, 16));
      const magic = match[1] === "application/pdf" ? header.startsWith("%PDF-") : match[1] === "image/png" ? bytes[0] === 137 && header.slice(1,4) === "PNG" : match[1] === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 : match[1] === "image/gif" ? header.startsWith("GIF8") : header.startsWith("RIFF") && header.slice(8,12) === "WEBP";
      if (!magic) throw new Error("INVALID_ATTACHMENT_CONTENT");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2,"0")).join("");
      const objectPath = `${tripId}/${digest}`;
      const { data: existing } = await admin.from("triplog_attachments").select("digest").eq("trip_id", tripId).eq("digest", digest).maybeSingle();
      if (!existing) {
        const { count } = await admin.from("triplog_attachments").select("digest", { count: "exact", head: true }).eq("trip_id", tripId);
        if ((count || 0) >= 500) throw new Error("INVALID_ATTACHMENT_LIMIT");
        const { error: uploadError } = await bucket.upload(objectPath, bytes, { contentType: match[1], upsert: false });
        if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
        const { error: metadataError } = await admin.from("triplog_attachments").upsert({ trip_id: tripId, digest, object_path: objectPath, content_type: match[1], byte_size: bytes.length, created_by: actor }, { onConflict: "trip_id,digest", ignoreDuplicates: true });
        if (metadataError) throw metadataError;
      }
      return reply({ reference: `triplog-attachment:${digest}` });
    }
    if (body.action === "read") {
      EdgeRuntime.waitUntil(deliver(tripId).catch(() => {}));
      return reply(await read(tripId, body.after ?? null));
    }
    if (body.action === "apply") {
      // Older builds can turn a stale whole-trip snapshot into valid deletes.
      // Keep their reads working, but require the command-aware client for writes.
      if (body.writeVersion !== 3) throw new Error("UPGRADE_REQUIRED");
      const deletions = Array.isArray(body.deletions) ? body.deletions : [];
      for (const patch of body.operation?.patches || []) {
        if (patch.action === "delete" && ["itinerary", "expense", "packing", "participant", "reservation"].includes(patch.kind)
          && !deletions.some((d: any) => d.kind === patch.kind && d.id === patch.id)) throw new Error("INVALID_DELETE_INTENT");
      }
      if (!body.operation || body.operation.protocolVersion !== 2 || !Array.isArray(body.operation.patches) || body.operation.patches.length < 1 || body.operation.patches.length > 500) throw new Error("INVALID_OPERATION");
      for (const patch of body.operation.patches) if (!patch || typeof patch !== "object" || typeof patch.kind !== "string" || typeof patch.id !== "string" || !["create", "patch", "delete"].includes(patch.action)) throw new Error("INVALID_PATCH");
      for (const patch of body.operation?.patches || []) {
        if (patch.kind !== "note_update") continue;
        if (patch.action !== "create" || patch.fields?.["p:document"] !== "shared-notes" || typeof patch.fields?.["p:update"] !== "string" || patch.fields["p:update"].length > 1048576) throw new Error("INVALID_NOTE_UPDATE");
        const { doc } = await noteDocument(tripId);
        try {
          applyUpdate(doc, Uint8Array.from(atob(patch.fields["p:update"]), c => c.charCodeAt(0)));
          if ([...doc.share.keys()].some(key => key !== "body") || doc.getText("body").length > 100000 || encodeStateAsUpdate(doc).byteLength > 786432) throw new Error("INVALID_NOTE_SIZE");
        }
        catch (_) { throw new Error("INVALID_NOTE_UPDATE"); }
        finally { doc.destroy(); }
      }
      const result = await rpc("triplog_apply_sync", { p_actor: actor, p_trip: tripId, p_operation: body.operation });
      if (result.status === "applied") EdgeRuntime.waitUntil((async () => {
        try { if (body.operation.patches.some((p: any) => p.kind === "note_update")) await compactNote(tripId); }
        finally { await deliver(tripId); }
      })().catch(() => console.warn(JSON.stringify({ event: "triplog-background-retry", requestId }))));
      return reply(result);
    }
    if (body.action === "members") {
      const { data, error } = await admin.from("triplog_trip_members").select("user_id, display_name, role, status").eq("trip_id", tripId).eq("status", "accepted");
      if (error) throw error;
      return reply({ members: data });
    }
    if (body.action === "history") {
      // Read historic payloads only if their kind is still visible now.
      const current = await read(tripId);
      const visible = (e: any) => current.role === "owner" || (!(current.privacy?.shareItinerary === false && ["itinerary", "reservation", "progress", "note_update", "comment"].includes(e.kind))
        && !(current.privacy?.shareExpenses === false && (["expense", "split", "share"].includes(e.kind) || (e.kind === "settings" && e.entity_id === "settlement"))));
      const redact = (e: any) => {
        if (current.role === "owner" || current.privacy?.shareExpenses !== false) return e;
        const row = structuredClone(e);
        const field = row.kind === "participant" ? "p:individualSpent" : row.kind === "trip" ? "p:totalBudget" : null;
        if (field) { if (row.data) delete row.data[field]; if (row.field_versions) delete row.field_versions[field]; }
        return row;
      };
      const { data, error } = await admin.from("triplog_change_log").select("sequence,actor_id,changes,before_changes,created_at").eq("trip_id", tripId).order("sequence", { ascending: false }).limit(100);
      if (error) throw error;
      return reply({ history: (data || []).map(row => ({ ...row, changes: row.changes.filter(visible).map(redact), before_changes: row.before_changes.filter(visible).map(redact) })) });
    }
    if (body.action === "control") {
      const control = String(body.control || "");
      const data = body.data || {};
      if (control === "restore-change") {
        if (!Number.isSafeInteger(data.sequence) || data.sequence < 1 || !/^[a-f0-9-]{36}$/i.test(String(data.operationId || ""))) throw new Error("INVALID_HISTORY");
        const result = await rpc("triplog_restore_change", { p_actor: actor, p_trip: tripId, p_sequence: data.sequence, p_operation: data.operationId });
        EdgeRuntime.waitUntil(deliver(tripId).catch(() => {}));
        return reply(result);
      }
      let token;
      if (control === "invite") {
        token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
        data.tokenHash = await tokenHash(token);
        data.role = data.role === "viewer" ? "viewer" : "editor";
      }
      if (control === "privacy") {
        for (const k of ["shareItinerary", "shareExpenses", "showMemberEmail", "allowInviteRequests"]) if (typeof data[k] !== "boolean") throw new Error("INVALID_PRIVACY");
        if (!data._expected || typeof data._expected !== "object") throw new Error("INVALID_PRIVACY_BASELINE");
      }
      const result = await rpc("triplog_sync_control", { p_actor: actor, p_trip: tripId, p_action: control, p_data: data });
      return reply({ ...result, ...(token ? { token } : {}) });
    }
    return reply({ code: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ code: "INVALID_JSON" }, 400);
    if (/^(22|23)/.test(String((error as { code?: string })?.code || ""))) return reply({ code: "INVALID_INPUT" }, 422);
    const message = String((error as Error)?.message || "REQUEST_FAILED");
    const status = /FORBIDDEN|OWNER_REQUIRED/.test(message) ? 403 : /SETTLEMENT_STALE|PRIVACY_CONFLICT|HISTORY_CHANGED/.test(message) ? 409 : /MIGRATION_REQUIRED|UPGRADE_REQUIRED/.test(message) ? 426 : /INVALID|REUSED|PRIVATE_DATA|REQUIRED_ENTITY/.test(message) ? 422 : 503;
    // Do not echo SQL details or input values to the browser.
    return reply({ code: message.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0] || "SERVER_UNAVAILABLE" }, status);
  }
}
