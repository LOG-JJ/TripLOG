'use strict';
// Strict local HTTP fixture backed by the real PostgreSQL functions.
const http = require('node:http');
const crypto = require('node:crypto');
const { createDatabase, actors } = require('../sync-database-regression');
const M = require('../../src/app/sync/model');
const Settlement = require('../../src/app/sync/settlement-model');
async function startCliFixture() {
  const db = await createDatabase(), attachments = new Map(), requests = [];
  const call = async (name, args) => (await db.query(`select public.${name}(${args.map((_, index) => '$' + (index + 1)).join(',')}) as result`, args.map(value => value && typeof value === 'object' ? JSON.stringify(value) : value))).rows[0].result;
  let origin, dropApply = false, dropRemoval = false;
  const server = http.createServer(async (req, res) => {
    const respond = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    try {
      if (req.url.startsWith('/storage/fixture/')) { const bytes = attachments.get(req.url.slice('/storage/fixture/'.length)); if (!bytes) return respond({}, 404); res.end(bytes); return; }
      const actor = req.headers.authorization?.replace('Bearer ', '');
      if (!actors.includes(actor)) return respond({ code: 'UNAUTHENTICATED' }, 401);
      if (req.url === '/auth/v1/user') return respond({ id: actor, email: 'cli-fixture@example.invalid', role: 'authenticated' });
      if (req.url !== '/functions/v1/triplog-sync') return respond({}, 404);
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString()); requests.push(body);
      const read = () => call('triplog_read_sync', [actor, body.tripId, body.after ?? null]);
      if (body.action === 'list') {
        const rows = (await db.query('select id,owner_id from public.triplog_trips')).rows, trips = [];
        for (const row of rows) if (await call('triplog_sync_role', [actor, row.id])) trips.push({ ...await call('triplog_read_sync', [actor, row.id, null]), ownerId: row.owner_id });
        return respond({ protocolVersion: 2, tripRemovalVersion: 1, trips });
      }
      if (body.action === 'remove-trip') {
        const result = await call('triplog_remove_trip', [actor, body.tripId, body.operationId]);
        const jobs = (await db.query('select object_paths from public.triplog_attachment_cleanup where actor_id=$1 and operation_id=$2', [actor, body.operationId])).rows;
        for (const job of jobs) for (const objectPath of job.object_paths) attachments.delete(objectPath);
        await db.query('delete from public.triplog_attachment_cleanup where actor_id=$1 and operation_id=$2', [actor, body.operationId]);
        if (dropRemoval) { dropRemoval = false; req.socket.destroy(); return; }
        return respond(result);
      }
      if (body.action === 'read') return respond(await read());
      if (body.action === 'create') {
        const snapshot = M.ensureIds(body.snapshot);
        if (snapshot.itineraryItems.some(item => item.voucherFile)) throw new Error('INVALID_INLINE_ATTACHMENT');
        const entities = M.shared(M.encode(snapshot), snapshot.collaboration?.privacy);
        const id = await call('triplog_create_sync', [actor, snapshot.id, snapshot, Object.values(entities)]);
        return respond({ ...await call('triplog_read_sync', [actor, id, null]), ownerId: actor });
      }
      if (body.action === 'apply') {
        if (body.writeVersion !== 3 || body.operation.protocolVersion !== 2) throw new Error('UPGRADE_REQUIRED');
        for (const patch of body.operation.patches) if (patch.action === 'delete' && ['itinerary', 'expense', 'packing', 'participant', 'reservation'].includes(patch.kind) && !body.deletions?.some(row => row.kind === patch.kind && row.id === patch.id)) throw new Error('INVALID_DELETE_INTENT');
        const result = await call('triplog_apply_sync', [actor, body.tripId, body.operation]);
        if (dropApply) { dropApply = false; req.socket.destroy(); return; }
        return respond(result);
      }
      if (body.action === 'members') { await read(); return respond({ members: (await db.query("select user_id,display_name,role,status from public.triplog_trip_members where trip_id=$1 and status='accepted'", [body.tripId])).rows }); }
      if (body.action === 'history') { await read(); return respond({ history: (await db.query('select sequence,actor_id,changes,before_changes,created_at from public.triplog_change_log where trip_id=$1 order by sequence desc limit 100', [body.tripId])).rows }); }
      if (body.action === 'control') {
        if (body.control === 'restore-change') return respond(await call('triplog_restore_change', [actor, body.tripId, body.data.sequence, body.data.operationId]));
        let token;
        if (body.control === 'invite') { token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); body.data.tokenHash = 'sha256:' + crypto.createHash('sha256').update(token).digest('hex'); }
        const result = await call('triplog_sync_control', [actor, body.tripId, body.control, body.data]); return respond({ ...result, ...(token ? { token } : {}) });
      }
      if (body.action === 'resolve' || body.action === 'accept') {
        const digest = 'sha256:' + crypto.createHash('sha256').update(body.token).digest('hex');
        if (body.action === 'resolve') return respond({ invite: (await db.query('select trip_id,app_trip_id,trip_name,invite_role from public.triplog_trip_invites where token=$1', [digest])).rows[0] });
        const id = await call('triplog_accept_sync_invite', [actor, digest, 'CLI fixture']); return respond(await call('triplog_read_sync', [actor, id, null]));
      }
      if (body.action === 'settlement-preview' || body.action === 'settlement-finalize') {
        const current = await read(), calculation = Settlement.calculate(M.decode(M.fromRows(current.entities)));
        const sourceHash = crypto.createHash('sha256').update(JSON.stringify(calculation.source)).digest('hex'); delete calculation.source;
        if (body.action === 'settlement-preview') return respond({ calculation, sourceHash, cursor: current.cursor });
        if (sourceHash !== body.sourceHash) throw new Error('SETTLEMENT_STALE');
        return respond({ finalized: await call('triplog_finalize_settlement', [actor, body.tripId, body.operationId, current.cursor, sourceHash, calculation]) });
      }
      if (body.action === 'attachment-upload') {
        await read(); const bytes = Buffer.from(body.data.split(',')[1], 'base64'), digest = crypto.createHash('sha256').update(bytes).digest('hex');
        attachments.set(`${body.tripId}/${digest}`, bytes);
        await db.query('insert into public.triplog_attachments(trip_id,digest,object_path,content_type,byte_size,created_by) values($1,$2,$3,$4,$5,$6) on conflict(trip_id,digest) do nothing', [body.tripId, digest, `${body.tripId}/${digest}`, body.data.slice(5).split(';')[0], bytes.length, actor]);
        return respond({ reference: `triplog-attachment:${digest}` });
      }
      if (body.action === 'attachment-download') { await read(); return respond({ url: `${origin}/storage/fixture/${body.tripId}/${body.reference.replace('triplog-attachment:', '')}` }); }
      respond({ code: 'UNKNOWN_ACTION' }, 400);
    } catch (error) { const code = error.message.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0] || 'FAILED'; respond({ code }, /FORBIDDEN|OWNER_REQUIRED/.test(code) ? 403 : /STALE|HISTORY_CHANGED|PRIVACY_CONFLICT/.test(code) ? 409 : 422); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  return { db, origin, actors, requests, call, dropNextApply() { dropApply = true; }, dropNextRemoval() { dropRemoval = true; }, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); } };
}
module.exports = { startCliFixture };
