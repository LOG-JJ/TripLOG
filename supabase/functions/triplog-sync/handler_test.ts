import { handleRequest } from "./handler.ts";

const actor = "00000000-0000-4000-8000-000000000001";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.test("gateway authenticates every request, ignores forged actor, gates RPCs and validates input", async () => {
  const oldFetch = globalThis.fetch, oldInfo = console.info;
  Deno.env.set("SUPABASE_URL", "http://gateway.test");
  Deno.env.set("SUPABASE_ANON_KEY", "fixture-public-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-server-key");
  const calls: Array<{ path: string; body: any }> = []; let valid = true, allowed = true, role: string | null = "editor";
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path: url.pathname, body });
    let result: any;
    let status = 200;
    if (url.pathname === "/auth/v1/user") { result = valid ? { id: actor, email: "fixture@example.test", user_metadata: {} } : { msg: "invalid token" }; status = valid ? 200 : 401; }
    else if (url.pathname.endsWith("triplog_rate_limit")) result = allowed;
    else if (url.pathname.endsWith("triplog_sync_role")) result = role;
    else if (url.pathname.endsWith("triplog_apply_sync")) result = { status: "conflict", conflicts: [] };
    else throw new Error(`Unexpected network request: ${url.pathname}`);
    return new Response(JSON.stringify(result), { status, headers: { "Content-Type": "application/json" } });
  };
  console.info = () => {};
  const request = (body: any, authenticated = true) => new Request("http://gateway.test/functions/v1/triplog-sync", { method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer fixture-user-token" } : {}) }, body: JSON.stringify({writeVersion:3,...body}) });
  try {
    assert((await handleRequest(request({}, false))).status === 401, "Missing token must fail before API calls");
    assert(calls.length === 0, "No admin client request before authentication");
    valid = false;
    assert((await handleRequest(request({ action: "apply" }))).status === 401, "Invalid user token must fail");
    assert(calls.every(c => c.path === "/auth/v1/user"), "Invalid auth must not reach privileged RPC");
    valid = true; calls.length = 0;
    const operation = { protocolVersion: 2, operationId: crypto.randomUUID(), patches: [{ kind: "packing", id: crypto.randomUUID(), action: "create", fields: { "p:name": "여권" } }] };
    const response = await handleRequest(request({ action: "apply", tripId: crypto.randomUUID(), actor: "forged-actor", p_actor: "forged-actor", operation }));
    assert(response.status === 200, "Verified command must reach RPC");
    assert(calls.find(c => c.path.endsWith("triplog_apply_sync"))?.body.p_actor === actor, "Actor must be derived only from verified token");
    calls.length = 0;
    assert((await handleRequest(request({ action: "apply", writeVersion: 2, tripId: crypto.randomUUID(), operation }))).status === 426, "Old snapshot clients must upgrade before writing");
    const removing = { ...operation, patches: [{ kind: "itinerary", id: "day2", action: "delete", before: {}, expectedVersion: 8 }] };
    assert((await handleRequest(request({ action: "apply", tripId: crypto.randomUUID(), operation: removing }))).status === 422, "A snapshot omission cannot authorize deletion");
    assert(!calls.some(c => c.path.endsWith("triplog_apply_sync")), "Unsafe requests must not reach mutation even with a valid version");
    assert((await handleRequest(request({ action: "apply", tripId: crypto.randomUUID(), operation: removing, deletions: [{kind:"itinerary",id:"day2"}] }))).status === 200, "Explicit deletion is supported");
    role = null; calls.length = 0;
    assert((await handleRequest(request({ action: "apply", tripId: crypto.randomUUID(), operation }))).status === 403, "Nonmember rejected");
    assert(!calls.some(c => c.path.endsWith("triplog_apply_sync")), "Nonmember cannot reach mutation");
    allowed = false; calls.length = 0;
    assert((await handleRequest(request({ action: "list" }))).status === 429, "Request limit enforced");
    assert(!calls.some(c => c.path.endsWith("triplog_sync_role")), "Throttled request stops early");
    allowed = true;
    assert((await handleRequest(request({ action: "create", snapshot: null }))).status === 422, "Bad create payload returns validation error");
    const oversized = new Request("http://gateway.test", { method: "POST", headers: { Authorization: "Bearer fixture" }, body: '"' + 'x'.repeat(3 * 1024 * 1024) + '"' });
    assert((await handleRequest(oversized)).status === 422, "Streamed body limit enforced");
  } finally { globalThis.fetch = oldFetch; console.info = oldInfo; }
});
