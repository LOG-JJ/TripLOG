'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const M = require('../../src/app/sync/model');
const Domain = require('../../src/app/domain/commands');
const { readJson, writeJson, hash } = require('../lib/files');
const { home, loadConfig } = require('../lib/config');
const { fail } = require('../lib/errors');
const Auth = require('../lib/auth');
const { note, comment, applyDocuments } = require('../commands/documents');
const { attachment } = require('../commands/attachments');
const { artifactDirectory } = require('../../scripts/helpers/artifact-output');
function cleanPath(value) { const text = String(value || '').trim(); return path.resolve((text.startsWith('"') && text.endsWith('"') || text.startsWith("'") && text.endsWith("'") ? text.slice(1, -1) : text).replace(/^~(?=[/\\]|$)/, os.homedir())); }
const scopeKey = context => JSON.stringify([context.source, context.profile || 'default', context.store || '', context.trip || '']);
function baseOptions(context, group) {
  if (group === 'dev') return {};
  if (group === 'auth' || group === 'config') return { profile: context.profile || 'default' };
  return { profile: context.profile || 'default', source: context.source || 'cloud', ...(context.store ? { store: context.store } : {}), ...(context.trip ? { trip: context.trip } : {}) };
}
function describePreview(preview, context, label, spec = {}) {
  const lines = [`작업: ${label}`];
  const fieldNames = { tripName: '여행 이름', country: '국가', countryCode: '국가 코드', city: '도시', travelMode: '여행 유형', startDate: '시작일', endDate: '종료일', currencyCode: '통화', totalBudget: '예산', place: '장소', date: '일자', time: '시작', endTime: '종료', location: '주소', memo: '메모', note: '메모', body: '내용', name: '이름', title: '예약 이름', description: '지출 내용', amount: '원화 금액', mode: '금액 유형', currency: '통화', foreignAmount: '외화 금액', exchangeRate: '환율', exchangeBase: '환율 기준 단위', checked: '준비 완료', cost: '이동 비용', duration: '이동 시간', trans: '이동 수단', transits: '이동 구간', syncExpense: '지출 연동', individualSpent: '개인 지출', payerKey: '결제자', paymentMethod: '결제 수단', paymentDate: '결제일', category: '분류', type: '종류', reference: '예약 번호', transportKind: '교통수단', arrivalDate: '도착일', from: '출발지', to: '도착지', url: '링크', leaderName: '대표 이름', splitMode: '분담 방식', role: '권한', userId: '멤버 ID', displayName: '표시 이름', shareItinerary: '일정 공유', shareExpenses: '지출 공유', showMemberEmail: '이메일 표시', allowInviteRequests: '초대 요청 허용', sequence: '변경 번호' };
  fieldNames.expenseOrder = '지출 순서';
  const describeFields = fields => {
    for (const [raw, value] of Object.entries(fields || {})) {
      const key = raw.replace(/^[pg]:/, '');
      if (['update', '_expected', 'createdAt', 'id', 'expenseId', 'linkedReservationId', 'voucherFile'].includes(key)) continue;
      if (raw.startsWith('g:') && value && typeof value === 'object') { describeFields(value); continue; }
      const display = typeof value === 'boolean' ? value ? '예' : '아니요' : typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      lines.push(`    ${fieldNames[key] || key}: ${display || '(비움)'}`);
    }
  };
  if (preview.patches) {
    const names = { itinerary: '일정', expense: '지출', packing: '준비물', participant: '동행인', reservation: '예약', trip: '여행 정보', note_update: '공동 메모', comment: '댓글', progress: '완료·잠금', settings: '설정', split: '분담', share: '분담' };
    const verbs = { create: '추가', patch: '수정', delete: '삭제' };
    lines.push(`변경 ${preview.patches.length}건`);
    for (const patch of preview.patches) {
      const fields = patch.fields || patch.before || {};
      const title = fields['p:name'] || fields['p:description'] || fields['p:title'] || fields['g:place']?.place || fields['p:tripName'] || '';
      lines.push(`  ${names[patch.kind] || patch.kind} ${verbs[patch.action]}${title ? ' · ' + title : ''}`);
      if (patch.action !== 'delete') describeFields(patch.fields);
    }
  } else if (preview.snapshot) lines.push(`새 여행: ${preview.snapshot.tripName}`, `${preview.snapshot.startDate} ~ ${preview.snapshot.endDate}`);
  else if (preview.trips) for (const trip of preview.trips.slice(0, 8)) lines.push(`새 여행: ${trip.name || trip.tripName}`);
  else if (preview.calculation) lines.push(`정산 합계: ${Number(preview.calculation.total).toLocaleString('ko-KR')}원`, `송금 ${preview.calculation.transfers.length}건`);
  else if (preview.file) lines.push(`파일: ${preview.file}`, preview.overwrite ? '기존 출력 파일을 덮어씁니다.' : '새 파일로 저장합니다.');
  else if (preview.control) describeFields(preview.data);
  else if (preview.invite) { const invite = preview.invite.invite || preview.invite; lines.push(`초대 여행: ${invite.tripName || invite.trip_name || '확인된 여행'}`, `참여 권한: ${invite.role || invite.inviteRole || invite.invite_role || ''}`); }
  if (spec.group === 'note' && spec.text !== undefined) lines.push('메모 내용:', spec.text);
  if (spec.kind === 'attachment') lines.push(`첨부파일: ${spec.options.file}`);
  lines.push(`대상: ${context.source === 'file' ? context.store : `클라우드 / ${context.profile || 'default'}`}`);
  if (context.source === 'file' && preview.patches) lines.push('확인하면 선택한 JSON 파일에 저장합니다.');
  return lines.join('\n');
}
class TerminalService {
  constructor({ dispatch, adapterFor } = {}) {
    this.dispatch = dispatch || ((args, options) => require('../index').dispatch(args, options));
    this.adapterFor = adapterFor || ((options, extra) => require('../index').adapterFor(options, extra));
  }
  call(context, group, action, options = {}, subaction) { return this.dispatch([group, action, ...(subaction ? [subaction] : [])], { ...baseOptions(context, group), ...options }); }
  async adapter(context, extra = {}) { return this.adapterFor({ ...baseOptions(context, 'trip'), ...(context.source === 'file' ? { inPlace: true } : {}) }, extra); }
  async capture(context) { const adapter = await this.adapter(context); return { adapter, record: await adapter.read(context.trip), scope: scopeKey(context) }; }
  async preferences() { try { return await readJson(path.join(home(), 'terminal.json')); } catch (_) { return {}; } }
  async remember(context) {
    if (context.demo) return;
    await writeJson(path.join(home(), 'terminal.json'), { source: context.source, profile: context.profile || 'default', ...(context.store ? { store: context.store } : {}), ...(context.trip ? { trip: context.trip } : {}) }, { overwrite: true });
  }
  async login(context, email, password) { return Auth.login(await loadConfig(context.profile), { email, password }); }
  async demo() {
    const folder = artifactDirectory('terminal-demo'), file = path.join(folder, `${M.uuid()}.json`);
    const trip = Domain.createTrip({ tripName: '예시 · 순천 2박 3일', startDate: '2026-11-07', endDate: '2026-11-09', city: '순천' });
    trip.itineraryItems = [
      ['2026-11-07', '10:00', '순천만 국가정원 둘러보기'], ['2026-11-07', '13:00', '점심 식사 · 꼬막정식'], ['2026-11-07', '16:00', '순천만 습지 걷기'],
      ['2026-11-08', '10:30', '낙안읍성 산책'], ['2026-11-08', '15:00', '카페에서 쉬어가기'], ['2026-11-09', '11:00', '기념품 구입'],
    ].map(([date, time, place]) => ({ id: M.uuid(), date, time, place, theme: 'sightseeing', transits: [], trans: 'none', duration: 0, cost: 0, createdAt: Date.now() }));
    trip.entries = [
      ['숙박', '순천 숙소 2박', 240000], ['교통', '왕복 교통비', 108000], ['식비', '꼬막정식', 54000], ['관광', '국가정원 입장권', 26000],
    ].map(([category, description, amount]) => ({ id: M.uuid(), date: '2026-11-07', category, description, amount, mode: 'domestic', paymentMethod: 'card', payerKey: 'leader' }));
    trip.companions = [{ id: M.uuid(), name: '예시 동행 1', individualSpent: 0 }, { id: M.uuid(), name: '예시 동행 2', individualSpent: 0 }];
    trip.packingList = ['우산', '충전기', '편한 신발'].map((name, index) => ({ id: M.uuid(), name, checked: index === 2 }));
    trip.travelCompanion.reservations = [{ id: M.uuid(), type: 'stay', title: '예시 숙소', date: '2026-11-07', endDate: '2026-11-09' }, { id: M.uuid(), type: 'activity', title: '국가정원 입장', date: '2026-11-07' }, { id: M.uuid(), type: 'transport', title: '순천행 열차', date: '2026-11-07', time: '07:30' }, { id: M.uuid(), type: 'transport', title: '귀가 열차', date: '2026-11-09', time: '16:00' }];
    await writeJson(file, { app: 'TripLOG', schemaVersion: 3, trips: [trip], records: [] });
    return { source: 'file', profile: 'default', store: file, trip: trip.id, demo: true };
  }
  outputPath(trip, extension) {
    const name = String(trip?.tripName || 'TripLOG').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 60);
    const suffix = String(extension || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'bin';
    return path.join(artifactDirectory('terminal-exports'), `${name}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${suffix}`);
  }
  async prepare(context, spec) {
    context = { ...context }; const options = spec.options || {}, label = spec.label;
    if (spec.captured && spec.captured.scope !== scopeKey(context)) fail('CONFLICT', '입력 중 여행 또는 연결이 바뀌었습니다. 다시 선택해 주세요.');
    let preview, execute;
    if (spec.kind === 'domain') {
      const adapter = spec.captured?.adapter || await this.adapter(context, { allowCreate: spec.group === 'trip' && spec.action === 'create' });
      if (spec.group === 'trip' && spec.action === 'create') {
        const snapshot = Domain.createTrip(spec.data); preview = await adapter.create(snapshot, { dryRun: true }); execute = () => adapter.create(snapshot);
      } else {
        const record = spec.captured?.record || await adapter.read(context.trip);
        const next = Domain.mutate(record.snapshot, spec.group, spec.action, { id: options.id?.replace(spec.group === 'reservation' ? /^manual:/ : /$^/, ''), data: spec.data || {}, target: options.target, placement: options.placement, checked: options.checked });
        if (spec.group === 'settlement') require('../../src/app/sync/settlement-model').calculate(next);
        preview = await adapter.apply(record, next, { dryRun: true, label }); execute = () => adapter.apply(record, next, { label });
      }
    } else if (spec.kind === 'document') {
      const adapter = await this.adapter(context), record = await adapter.read(context.trip);
      preview = spec.group === 'note' ? await note(adapter, record, spec.action, spec.text, { dryRun: true }) : await comment(adapter, record, spec.action, { text: spec.text, id: options.id, target: options.target }, { dryRun: true });
      execute = () => applyDocuments(adapter, record, preview.patches, { label });
    } else if (spec.kind === 'control') {
      const adapter = spec.captured?.adapter || await this.adapter(context), record = spec.captured?.record || await adapter.read(context.trip);
      let data = { ...spec.data };
      if (spec.control === 'privacy') { const expected = { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true, ...record.privacy }; data = { ...expected, ...data, _expected: expected }; }
      if (spec.control === 'restore-change' && adapter.kind === 'cloud') data.operationId = M.uuid();
      preview = await adapter.control(record, spec.control, data, { dryRun: true }); execute = async () => { const result = await adapter.control(record, spec.control, data); if (result.token && adapter.config?.appUrl) { const url = new URL(adapter.config.appUrl); url.searchParams.set('invite', result.token); result.url = url.href; } return result; };
    } else if (spec.kind === 'finalize') {
      const adapter = await this.adapter(context), record = await adapter.read(context.trip);
      if (adapter.kind === 'cloud') {
        adapter.writable(record); preview = await adapter.send({ action: 'settlement-preview', tripId: record.id });
        const body = { action: 'settlement-finalize', tripId: record.id, sourceHash: preview.sourceHash, operationId: M.uuid() };
        execute = () => adapter.journal.execute(body, adapter.send, { label, retryable: true });
      } else {
        const calculation = require('../../src/app/sync/settlement-model').calculate(record.snapshot), sourceHash = hash(JSON.stringify(calculation.source)); delete calculation.source; preview = { calculation };
        if (record.archivedAt) fail('FORBIDDEN', '보관된 여행은 정산을 확정할 수 없습니다.');
        execute = () => adapter.save({ ...adapter.payload, cliSettlements: [...(adapter.payload.cliSettlements || []), { id: M.uuid(), tripId: record.id, sourceHash, calculation, createdAt: new Date().toISOString() }] });
      }
    } else if (spec.kind === 'attachment') {
      const adapter = await this.adapter(context), record = await adapter.read(context.trip), digest = hash(await fs.readFile(options.file));
      preview = await attachment(adapter, record, 'upload', { ...options, dryRun: true });
      execute = async () => { if (hash(await fs.readFile(options.file)) !== digest) fail('CONFLICT', '확인 이후 첨부파일이 바뀌었습니다. 다시 확인해 주세요.'); return attachment(adapter, record, 'upload', options); };
    } else {
      const inputHash = options.file ? hash(await fs.readFile(options.file)) : null;
      const destinationHash = context.source === 'file' && context.store ? hash(await fs.readFile(context.store)) : null;
      if (spec.preview) preview = await this.call(context, spec.group, spec.action, { ...options, dryRun: true }, spec.subaction);
      else preview = { file: options.out, overwrite: options.overwrite };
      execute = async () => {
        if (options.file && hash(await fs.readFile(options.file)) !== inputHash) fail('CONFLICT', '확인 이후 입력 파일이 바뀌었습니다. 다시 확인해 주세요.');
        if (destinationHash && hash(await fs.readFile(context.store)) !== destinationHash) fail('CONFLICT', '확인 이후 여행 파일이 바뀌었습니다. 다시 확인해 주세요.');
        return this.call(context, spec.group, spec.action, { ...options, ...(spec.write && context.source === 'file' ? { inPlace: true } : {}) }, spec.subaction);
      };
    }
    return { label, context, scope: scopeKey(context), preview, summary: describePreview(preview, context, label, spec), execute };
  }
}
module.exports = { TerminalService, baseOptions, scopeKey, cleanPath, describePreview };
