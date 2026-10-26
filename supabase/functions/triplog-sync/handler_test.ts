import { handleRequest } from "./handler.ts";

Deno.test("trip removal uses verified identity, replays after membership deletion, and awaits physical attachment cleanup", async () => {
  const originalFetch=globalThis.fetch, originalInfo=console.info;
  Deno.env.set("SUPABASE_URL","http://removal.test"); Deno.env.set("SUPABASE_ANON_KEY","fixture-public"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","fixture-server");
  const tripId=crypto.randomUUID(),operationId=crypto.randomUUID(),objectPath=tripId+"/"+"a".repeat(64);
  let cleanup=true,storageFailure=true,forbidden=false;
  const calls:Array<{path:string;body:any;method:string}>=[];
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url),method=init?.method||"GET",body=init?.body?JSON.parse(String(init.body)):null;
    calls.push({path:url.pathname,body,method});let result:any,status=200;
    if(url.pathname==="/auth/v1/user")result={id:actor,user_metadata:{}};
    else if(url.pathname.endsWith("triplog_rate_limit"))result=true;
    else if(url.pathname.endsWith("triplog_remove_trip")){result=forbidden?{message:"FORBIDDEN"}:{ok:true,removed:true,serverDeleted:true,remainingMembers:0};status=forbidden?403:200;}
    else if(url.pathname==="/rest/v1/triplog_attachment_cleanup"){
      assert(url.searchParams.get("actor_id")==="eq."+actor,"Cleanup must be actor scoped");
      if(method==="DELETE"){cleanup=false;return new Response(null,{status:204});}
      result=cleanup?[{actor_id:actor,operation_id:operationId,trip_id:tripId,object_paths:[objectPath]}]:[];
    }else if(url.pathname==="/storage/v1/object/triplog-private-attachments"){
      assert(method==="DELETE"&&body.prefixes.length===1&&body.prefixes[0]===objectPath,"Delete only this trip's physical object using Storage API");
      result=storageFailure?{message:"unavailable",error:"StorageError"}:[{name:objectPath}];status=storageFailure?503:200;
    }else throw new Error("Unexpected request "+url.pathname);
    return new Response(JSON.stringify(result),{status,headers:{"Content-Type":"application/json"}});
  };
  console.info=()=>{};
  const req=(id:string=operationId)=>new Request("http://removal.test/functions/v1/triplog-sync",{method:"POST",headers:{Authorization:"Bearer fixture","Content-Type":"application/json"},body:JSON.stringify({action:"remove-trip",tripId,operationId:id,actor:"forged"})});
  try{
    let response=await handleRequest(req());assert(response.status===503,"Cleanup failure cannot be reported as complete");
    assert((await response.json()).code==="REMOVAL_CLEANUP_PENDING"&&cleanup,"Keep durable cleanup work for the retry");
    storageFailure=false;response=await handleRequest(req());assert(response.status===200,"The same operation can finish after membership is gone");
    assert((await response.json()).serverDeleted===true&&!cleanup,"Success requires attachment cleanup");
    const mutations=calls.filter(call=>call.path.endsWith("triplog_remove_trip"));
    assert(mutations.length===2&&mutations.every(call=>call.body.p_actor===actor&&call.body.p_operation===operationId),"Verified actor and unchanged operation ID reach the RPC");
    assert(!calls.some(call=>call.path.endsWith("triplog_sync_role")),"Receipt validation must happen before any current-membership requirement");
    forbidden=true;response=await handleRequest(req(crypto.randomUUID()));assert(response.status===403,"RPC membership denial is enforced");
    const before=calls.filter(call=>call.path.endsWith("triplog_remove_trip")).length;
    response=await handleRequest(req("invalid"));assert(response.status===422,"Reject invalid removal IDs");
    assert(calls.filter(call=>call.path.endsWith("triplog_remove_trip")).length===before,"Invalid IDs never reach the mutation");
  }finally{globalThis.fetch=originalFetch;console.info=originalInfo;}
});

const actor = "00000000-0000-4000-8000-000000000001";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.test("list completeness gates device removal and in-flight uploads compensate a deleted trip", async () => {
  const oldFetch=globalThis.fetch,oldInfo=console.info;
  Deno.env.set("SUPABASE_URL","http://removal-boundary.test");Deno.env.set("SUPABASE_ANON_KEY","public");Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","server");
  let memberCount=1,mode="list",uploaded=false,removed=false;
  const tripId=crypto.randomUUID();
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url),method=init?.method||"GET";
    let result:any, status=200;const headers:Record<string,string>={"Content-Type":"application/json"};
    if(url.pathname==="/auth/v1/user")result={id:actor,user_metadata:{}};
    else if(url.pathname.endsWith("triplog_rate_limit"))result=true;
    else if(url.pathname.endsWith("triplog_sync_role"))result="editor";
    else if(url.pathname==="/rest/v1/triplog_trip_members"){result=[];headers["Content-Range"]="*/"+memberCount;}
    else if(url.pathname==="/rest/v1/triplog_trips"){result=mode==="list"?[]:{privacy:{},archived_at:null};headers["Content-Range"]="*/0";}
    else if(url.pathname==="/rest/v1/triplog_attachments"){
      if(method==="POST"){result={code:"23503",message:"trip no longer exists"};status=409;}
      else {result=[];headers["Content-Range"]="*/0";}
    }else if(url.pathname.startsWith("/storage/v1/object/triplog-private-attachments")){
      if(method==="DELETE"){removed=true;result=[];}else {uploaded=true;result={Key:"fixture"};}
    }else throw new Error("Unexpected request "+url.pathname);
    return new Response(method==="HEAD"?null:JSON.stringify(result),{status,headers});
  };
  console.info=()=>{};
  const request=(body:any)=>new Request("http://removal-boundary.test",{method:"POST",headers:{Authorization:"Bearer fixture","Content-Type":"application/json"},body:JSON.stringify(body)});
  try{
    let response=await handleRequest(request({action:"list"}));
    assert(response.status===200&&(await response.json()).tripRemovalVersion===0,"A truncated membership list cannot authorize device cleanup");
    memberCount=0;response=await handleRequest(request({action:"list"}));
    assert(response.status===200&&(await response.json()).tripRemovalVersion===1,"Only a complete list authorizes absent-trip cleanup");
    mode="upload";response=await handleRequest(request({action:"attachment-upload",tripId,data:"data:application/pdf;base64,"+btoa("%PDF-1.4\nfixture")}));
    assert(response.status===422&&uploaded&&removed,"An upload that loses its trip before metadata commit removes the physical object");
  }finally{globalThis.fetch=oldFetch;console.info=oldInfo;}
});
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
