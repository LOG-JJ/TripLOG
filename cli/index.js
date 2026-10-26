'use strict';
const { parse, help, commands, validateOptions } = require('./lib/arguments');
const { output, errorOutput } = require('./lib/output');
const { fail } = require('./lib/errors');
const { readJson, readText, parseJson, hash } = require('./lib/files');
const { loadConfig, saveConfig } = require('./lib/config');
const Auth = require('./lib/auth');
const { FileAdapter } = require('./adapters/file');
const { CloudAdapter } = require('./adapters/cloud');
const Domain = require('../src/app/domain/commands');
const M = require('../src/app/sync/model');
const Costs = require('../src/app/shared/travel-costs');
const Settlement = require('../src/app/sync/settlement-model');
const Companion = require('../src/app/features/travel-companion/model');
const { report } = require('./commands/report');
const { exportBackup, importBackup } = require('./commands/backup');
const { note, comment } = require('./commands/documents');
const { attachment } = require('./commands/attachments');
const ItineraryArt = require('../src/app/data/itinerary-art');
function bool(value, label) { if (value === true || value === 'true') return true; if (value === false || value === 'false') return false; fail('USAGE', `${label}는 true 또는 false입니다.`); }
const requireValue = (value, name) => { if (!value) fail('USAGE', `${name} 옵션이 필요합니다.`); return value; };
async function dataFor(kind, options) {
  const data = options.file ? await readJson(options.file) : options.data ? parseJson(options.data) : {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('INVALID_INPUT', '입력은 JSON 객체여야 합니다.');
  const mapping = { name: kind === 'trip' ? 'tripName' : 'name', country: 'country', countryCode: 'countryCode', city: 'city', mode: kind === 'trip' ? 'travelMode' : 'mode', start: 'startDate', end: 'endDate', date: 'date', time: 'time', endTime: 'endTime', place: 'place', location: 'location', category: 'category', description: 'description', amount: 'amount', foreignAmount: 'foreignAmount', currency: kind === 'trip' ? 'currencyCode' : 'currency', exchangeRate: 'exchangeRate', exchangeBase: 'exchangeBase', paymentDate: 'paymentDate', paymentMethod: 'paymentMethod', payer: 'payerKey', note: 'note', memo: 'memo', theme: 'theme', themeSubtype: 'themeSubtype', trans: 'trans', duration: 'duration', cost: 'cost', syncExpense: 'syncExpense', individualSpent: 'individualSpent', checked: 'checked', type: 'type', title: 'title', reference: 'reference', endDate: 'endDate', arrivalDate: 'arrivalDate', transportKind: 'transportKind', from: 'from', to: 'to', url: 'url' };
  const numeric = new Set(['amount', 'foreignAmount', 'exchangeRate', 'exchangeBase', 'duration', 'cost', 'individualSpent']);
  for (const [option, field] of Object.entries(mapping)) if (options[option] !== undefined) {
    let value = options[option];
    if (numeric.has(field)) { value = Number(value); if (!Number.isFinite(value) || String(options[option]).trim() === '') fail('USAGE', `${option}는 숫자여야 합니다.`); }
    if (['checked', 'syncExpense'].includes(field)) value = bool(value, option);
    data[field] = value;
  }
  return Domain.input(kind, data);
}
async function adapterFor(options, { allowCreate = false } = {}) {
  if ((options.source || (options.store ? 'file' : 'cloud')) === 'file') return FileAdapter.open(options.store, { ...options, allowCreate });
  if (options.inPlace) fail('USAGE', '--in-place는 file 모드에서만 사용합니다.');
  const config = await loadConfig(options.profile), identity = await Auth.authenticate(config);
  return new CloudAdapter(config, identity);
}
function filterRows(rows, options) {
  const query = options.query?.toLocaleLowerCase();
  return rows.filter(row => (!options.date || row.date === options.date) && (!query || JSON.stringify(row).toLocaleLowerCase().includes(query)));
}
function cloudOnly(adapter) { if (adapter.kind !== 'cloud') fail('UNSUPPORTED', '이 명령은 cloud 모드에서 사용해 주세요.'); }
async function dispatch(positionals, options) {
  const [group, action, subaction, ...rest] = positionals;
  if (options.version) return `TripLOG CLI ${require('../package.json').version}`;
  if ((!group && !options.help && process.stdin.isTTY && process.stdout.isTTY) || group === 'ui' && !options.help) {
    if (action || subaction || rest.length) fail('USAGE', 'triplog ui [--demo] [--store 파일] 형식으로 실행해 주세요.');
    validateOptions('ui', undefined, undefined, options);
    return require('./tui').start(options);
  }
  if (options.help || !group || group === 'help') return help(group === 'help' ? action : group);
  if (!Object.hasOwn(commands, group) || (group !== 'schema' && !commands[group].includes(action)) || rest.length || (subaction && !(group === 'dev' && action === 'deploy'))) fail('USAGE', '지원하지 않는 명령입니다. triplog --help를 확인해 주세요.');
  validateOptions(group, action, subaction, options);
  if (group === 'schema') {
    if (!Object.hasOwn(Domain.fields, action)) fail('USAGE', 'schema 다음에 데이터 영역을 지정해 주세요.');
    return { kind: action, fields: Domain.fields[action].split(' '), exampleInput: '--file input.json', managedFields: ['id', 'createdAt', 'expenseId', 'linkedReservationId'],
      ...(action === 'itinerary' ? { themeSubtypes: Object.fromEntries(Object.entries(ItineraryArt.themes).map(([theme, meta]) => [theme, { label: meta.label, types: Object.values(ItineraryArt.catalog).filter(row => row.group === theme).map(({ id, label }) => ({ id, label })) }])) } : {}) };
  }
  if (options.dryRun && (['auth', 'config', 'operation'].includes(group) || group === 'dev' && ['serve', 'doctor'].includes(action))) fail('USAGE', '이 명령은 --dry-run을 지원하지 않습니다.');
  if (group === 'dev') return require('./commands/dev').execute(action, subaction, options);
  if (group === 'config') {
    if (action === 'set') {
      if (!options.url && !options.key) fail('USAGE', '--url 또는 --key로 연결 설정을 지정해 주세요.');
      return saveConfig(options.profile, { ...(options.url ? { url: options.url } : {}), ...(options.key ? { publishableKey: options.key } : {}) });
    }
    const config = await loadConfig(options.profile); return { ...config, publishableKey: `${config.publishableKey.slice(0, 18)}…` };
  }
  if (group === 'auth') {
    const config = await loadConfig(options.profile);
    if (action === 'login') return Auth.login(config, options);
    if (action === 'logout') return Auth.logout(config);
    const identity = await Auth.authenticate(config); return { profile: config.profile, url: config.url, userId: identity.user.id, email: identity.user.email, expiresAt: identity.expiresAt, externalToken: identity.external };
  }
  const adapter = await adapterFor(options, { allowCreate: group === 'trip' && action === 'create' || group === 'backup' && action === 'import' });
  if (group === 'operation') {
    cloudOnly(adapter);
    if (action === 'list') return adapter.journal.list();
    requireValue(options.id, '--id');
    return action === 'show' ? adapter.journal.read(options.id) : adapter.journal.retry(options.id, adapter.send);
  }
  if (group === 'backup') return action === 'export' ? exportBackup(adapter, options) : importBackup(adapter, options);
  if (group === 'trip' && action === 'list') {
    const rows = (await adapter.list()).filter(record => options.archived || !record.archivedAt).map(record => ({ id: record.id, appTripId: record.appTripId, name: record.snapshot.tripName, city: record.snapshot.city, startDate: record.snapshot.startDate, endDate: record.snapshot.endDate, role: record.role, archived: Boolean(record.archivedAt) }));
    return filterRows(rows, options);
  }
  if (group === 'trip' && action === 'create') return adapter.create(Domain.createTrip(await dataFor('trip', options)), options);
  if (group === 'invite' && ['resolve', 'accept'].includes(action)) {
    cloudOnly(adapter); const token = requireValue(options.token, '--token'); if (token.length < 12 || token.length > 256) fail('USAGE', '초대 토큰 길이가 올바르지 않습니다.');
    const body = { action, token }; if (options.dryRun) return { dryRun: true, action, invite: await adapter.send({ action: 'resolve', token }) };
    return action === 'resolve' ? adapter.send(body) : adapter.journal.execute(body, adapter.send, { label: 'invite accept', retryable: false });
  }
  const record = await adapter.read(requireValue(options.trip, '--trip'));
  const snapshot = record.snapshot;
  if (group === 'trip') {
    if (action === 'show') return { source: adapter.kind, tripId: record.id, appTripId: record.appTripId, cursor: record.cursor, role: record.role, archivedAt: record.archivedAt, snapshot };
    if (action === 'update') return adapter.apply(record, Domain.mutate(snapshot, 'trip', 'update', { data: await dataFor('trip', options) }), { ...options, label: 'trip update' });
    if (['archive', 'restore', 'leave'].includes(action)) return adapter.control(record, action, {}, options);
    if (action === 'transfer') return adapter.control(record, 'transfer-owner', { userId: requireValue(options.user, '--user') }, options);
    const data = options.file ? await readJson(options.file) : options.data ? parseJson(options.data) : null;
    if (!data) return record.privacy || snapshot.collaboration?.privacy || {};
    const allowed = ['shareItinerary', 'shareExpenses', 'showMemberEmail', 'allowInviteRequests'];
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !allowed.includes(key) || typeof data[key] !== 'boolean')) fail('INVALID_INPUT', '공유 설정은 shareItinerary/shareExpenses/showMemberEmail/allowInviteRequests의 boolean 객체입니다.');
    const expected = { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true, ...record.privacy };
    return adapter.control(record, 'privacy', { ...expected, ...data, _expected: expected }, options);
  }
  if (['itinerary', 'expense', 'packing', 'companion', 'reservation'].includes(group)) {
    if (action === 'summary') return Costs.summarize(snapshot, { date: options.date || '' });
    if (action === 'list') return filterRows(group === 'reservation' ? Companion.reservations(snapshot) : group === 'itinerary' ? require('../src/app/shared/itinerary-order').sort(Domain.list(snapshot, group)) : Domain.list(snapshot, group), options);
    if (action === 'show') {
      requireValue(options.id, '--id');
      if (group !== 'reservation') return Domain.find(snapshot, group, options.id);
      const row = Companion.reservations(snapshot).find(row => row.id === options.id || row.id === `manual:${options.id}`);
      if (!row) fail('NOT_FOUND', '예약을 찾을 수 없습니다.'); return row;
    }
    if (action !== 'add') requireValue(options.id, '--id');
    if (action === 'move') requireValue(options.target, '--target');
    const data = ['add', 'update'].includes(action) ? await dataFor(group, options) : {};
    const next = Domain.mutate(snapshot, group, action, { id: options.id?.replace(group === 'reservation' ? /^manual:/ : /$^/, ''), data, target: options.target, placement: options.placement, checked: options.unchecked ? false : options.checked === undefined ? true : bool(options.checked, 'checked') });
    return adapter.apply(record, next, { ...options, label: `${group} ${action}` });
  }
  if (group === 'settlement') {
    if (action === 'show') return snapshot.settlement;
    if (action === 'update') {
      const next = Domain.mutate(snapshot, 'settlement', 'update', { data: await dataFor('settlement', options) }); Settlement.calculate(next);
      return adapter.apply(record, next, { ...options, label: 'settlement update' });
    }
    if (adapter.kind === 'cloud') {
      const preview = await adapter.send({ action: 'settlement-preview', tripId: record.id });
      if (action === 'preview' || options.dryRun) return { ...preview, ...(options.dryRun ? { dryRun: true } : {}) };
      adapter.writable(record);
      return adapter.journal.execute({ action: 'settlement-finalize', tripId: record.id, sourceHash: preview.sourceHash, operationId: M.uuid() }, adapter.send, { retryable: true, label: 'settlement finalize' });
    }
    const calculation = Settlement.calculate(snapshot), sourceHash = hash(JSON.stringify(calculation.source)); delete calculation.source;
    if (action === 'preview' || options.dryRun) return { calculation, sourceHash, finalized: (adapter.payload.cliSettlements || []).findLast(item => item.tripId === record.id) || null, ...(options.dryRun ? { dryRun: true } : {}) };
    if (record.archivedAt) fail('FORBIDDEN', '보관된 여행은 정산을 확정할 수 없습니다.');
    return adapter.save({ ...adapter.payload, cliSettlements: [...(adapter.payload.cliSettlements || []), { id: M.uuid(), tripId: record.id, sourceHash, calculation, createdAt: new Date().toISOString() }] });
  }
  if (group === 'report') return report(snapshot, options);
  if (group === 'history') {
    if (action === 'list') return adapter.kind === 'cloud' ? adapter.send({ action: 'history', tripId: record.id }) : (adapter.payload.cliHistory || []).filter(row => row.tripId === record.id).map(({ before, after, ...row }) => row);
    if (adapter.kind === 'file') return adapter.control(record, 'restore-change', { id: requireValue(options.id, '--id') }, options);
    const sequence = Number(options.sequence); if (!Number.isSafeInteger(sequence) || sequence < 1) fail('USAGE', '--sequence는 1 이상의 변경 번호입니다.');
    return adapter.control(record, 'restore-change', { sequence, operationId: M.uuid() }, options);
  }
  if (group === 'member') {
    cloudOnly(adapter);
    if (action === 'list') return adapter.send({ action: 'members', tripId: record.id });
    if (action === 'profile') return adapter.control(record, 'profile', { displayName: requireValue(options.name, '--name') }, options);
    if (action === 'set' && !['editor', 'viewer'].includes(options.role)) fail('USAGE', '--role editor|viewer를 지정해 주세요.');
    return adapter.control(record, 'member', { userId: requireValue(options.user, '--user'), role: action === 'remove' ? 'remove' : options.role }, options);
  }
  if (group === 'invite') {
    cloudOnly(adapter);
    if (action === 'revoke') return adapter.control(record, 'revoke-invite', { inviteId: requireValue(options.id, '--id') }, options);
    if (options.role && !['editor', 'viewer'].includes(options.role)) fail('USAGE', '--role editor|viewer를 지정해 주세요.');
    const result = await adapter.control(record, 'invite', { role: options.role || 'editor' }, options);
    if (result.token) { const url = new URL(adapter.config.appUrl); url.searchParams.set('invite', result.token); result.url = url.href; }
    return result;
  }
  if (group === 'note' || group === 'comment') {
    const text = options.file ? await readText(options.file, 1024 * 1024) : options.text;
    return group === 'note' ? note(adapter, record, action, text, options) : comment(adapter, record, action, { text, id: options.id, target: options.target }, options);
  }
  if (group === 'attachment') return attachment(adapter, record, action, options);
  fail('USAGE', '명령을 처리할 수 없습니다.');
}
async function main(argv = process.argv.slice(2)) {
  let options = { json: argv.includes('--json') };
  try { const parsed = parse(argv); options = parsed.options; const result = await dispatch(parsed.positionals, options); if (result !== undefined) output(result, options); }
  catch (error) { if (error.code?.startsWith('INVALID_') && !error.exitCode) error.exitCode = 2; errorOutput(error, options); }
}
module.exports = { main, dispatch, dataFor, adapterFor };
