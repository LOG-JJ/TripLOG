'use strict';
const { parseArgs } = require('node:util');
const { fail } = require('./errors');
const booleans = ['help', 'version', 'json', 'dry-run', 'overwrite', 'in-place', 'archived', 'unchecked', 'demo', 'plain', 'no-color'];
const strings = ['profile', 'source', 'store', 'trip', 'id', 'file', 'data', 'out', 'query', 'email', 'url', 'key', 'name', 'country', 'country-code', 'city', 'mode', 'start', 'end', 'date', 'time', 'end-time', 'place', 'location', 'category', 'description', 'amount', 'foreign-amount', 'currency', 'exchange-rate', 'exchange-base', 'payment-date', 'payment-method', 'payer', 'note', 'memo', 'theme', 'theme-subtype', 'trans', 'duration', 'cost', 'sync-expense', 'individual-spent', 'checked', 'target', 'placement', 'type', 'title', 'reference', 'end-date', 'arrival-date', 'transport-kind', 'from', 'to', 'text', 'role', 'user', 'token', 'sequence', 'format', 'timezone', 'suite', 'port', 'message'];
const camel = name => name.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
function parse(argv) {
  let parsed;
  try { parsed = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { ...Object.fromEntries(booleans.map(key => [key, { type: 'boolean', ...(key === 'help' ? { short: 'h' } : {}) }])), ...Object.fromEntries(strings.map(key => [key, { type: 'string' }])), files: { type: 'string', multiple: true } } }); }
  catch (error) { fail('USAGE', error.message); }
  const options = Object.fromEntries(Object.entries(parsed.values).map(([key, value]) => [camel(key), value]));
  if (options.file && options.data) fail('USAGE', '--file과 --data는 함께 사용할 수 없습니다.');
  if (options.source && !['cloud', 'file'].includes(options.source)) fail('USAGE', '--source는 cloud 또는 file입니다.');
  if (options.source === 'cloud' && options.store) fail('USAGE', '--store는 file 모드에서만 사용합니다.');
  if (options.out && options.inPlace) fail('USAGE', '--out과 --in-place 중 하나만 사용해 주세요.');
  return { options, positionals: parsed.positionals };
}
const commands = {
  ui: [],
  auth: ['login', 'status', 'logout'], config: ['show', 'set'],
  trip: ['list', 'show', 'create', 'update', 'archive', 'restore', 'privacy', 'transfer', 'leave'],
  itinerary: ['list', 'show', 'add', 'update', 'remove', 'move', 'complete', 'lock'],
  expense: ['list', 'show', 'add', 'update', 'remove', 'summary'],
  packing: ['list', 'show', 'add', 'update', 'remove', 'move', 'check'],
  companion: ['list', 'show', 'add', 'update', 'remove'],
  reservation: ['list', 'show', 'add', 'update', 'remove', 'link'],
  settlement: ['show', 'update', 'preview', 'finalize'],
  report: ['show', 'export'], backup: ['export', 'import'], history: ['list', 'restore'],
  member: ['list', 'set', 'remove', 'profile'], invite: ['create', 'revoke', 'resolve', 'accept'],
  note: ['show', 'append', 'set'], comment: ['list', 'add', 'remove'], attachment: ['upload', 'download'],
  operation: ['list', 'show', 'retry'], dev: ['serve', 'test', 'build', 'doctor', 'artifacts', 'deploy'], schema: [],
};
function validateOptions(group, action, subaction, options) {
  const allowed = new Set(['json', 'profile', 'help', 'version']);
  const add = text => text.split(' ').filter(Boolean).forEach(key => allowed.add(key));
  if (group === 'ui') { add('source store trip demo plain noColor'); if (options.json) fail('USAGE', 'ui는 대화형 화면입니다. JSON 출력은 개별 CLI 명령을 사용해 주세요.'); if (options.demo && (options.store || options.source || options.trip)) fail('USAGE', '--demo는 실제 여행 연결 옵션과 함께 사용할 수 없습니다.'); }
  else if (group === 'schema') { /* only common options */ }
  else if (group === 'auth') { if (action === 'login') add('email'); }
  else if (group === 'config') { if (action === 'set') add('url key'); }
  else if (group === 'dev') {
    if (action === 'serve') add('port');
    if (action === 'test') add('suite dryRun');
    if (['build', 'artifacts'].includes(action)) add('dryRun');
    if (action === 'deploy' && subaction !== 'status') add('files message dryRun');
  } else {
    add('source store trip');
    const write = ['create', 'add', 'update', 'remove', 'move', 'check', 'complete', 'lock', 'link', 'archive', 'restore', 'transfer', 'leave', 'privacy', 'finalize', 'set', 'append', 'revoke', 'accept', 'profile', 'import', 'upload'].includes(action);
    if (write) add('dryRun out overwrite inPlace');
    if (['show', 'update', 'remove', 'move', 'check', 'complete', 'lock', 'link', 'revoke', 'retry', 'restore', 'upload', 'download'].includes(action)) add('id');
    if (action === 'list') add('query');
    if (['itinerary', 'expense', 'reservation'].includes(group) && action === 'list' || group === 'expense' && action === 'summary') add('date');
    if (action === 'move') add('target placement');
    if (['check', 'complete', 'lock'].includes(action)) add('checked unchecked');
    if (group === 'trip') {
      if (action === 'list') add('archived');
      if (['create', 'update'].includes(action)) add('file data name country countryCode city mode start end currency exchangeRate exchangeBase');
      if (action === 'privacy') add('file data');
      if (action === 'transfer') add('user');
    }
    if (['add', 'update'].includes(action)) {
      if (['itinerary', 'expense', 'packing', 'companion', 'reservation', 'settlement'].includes(group)) add('file data');
      if (group === 'itinerary') add('date time endTime place location theme themeSubtype memo trans duration cost syncExpense');
      if (group === 'expense') add('date category description amount note mode currency foreignAmount exchangeRate exchangeBase paymentDate paymentMethod payer');
      if (group === 'packing') add('name checked');
      if (group === 'companion') add('name individualSpent');
      if (group === 'reservation') add('type title date endDate time endTime arrivalDate transportKind from to reference location note url');
    }
    if (group === 'report') add('format type date timezone out overwrite');
    if (group === 'backup') { if (action === 'export') add('out overwrite'); else add('file'); }
    if (group === 'history' && action === 'restore') add('sequence');
    if (group === 'member') { if (['set', 'remove'].includes(action)) add('user'); if (action === 'set') add('role'); if (action === 'profile') add('name'); }
    if (group === 'invite') { if (action === 'create') add('role'); if (['resolve', 'accept'].includes(action)) add('token'); }
    if (group === 'note' && action !== 'show') add('text file');
    if (group === 'comment' && action === 'add') add('text file target');
    if (group === 'attachment') { if (action === 'upload') add('file'); else add('out overwrite'); }
  }
  for (const key of Object.keys(options)) if (!allowed.has(key)) fail('USAGE', `${group} ${action}에서 사용할 수 없는 옵션: --${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`);
}
function help(group) {
  if (group === 'ui') return [
    'TripLOG 대화형 터미널', '', '실행: npm run terminal 또는 triplog ui', '체험: npm run terminal:demo', '',
    '  --demo              별도 예시 여행으로 시작', '  --store <JSON>      파일에서 여행 열기', '  --profile <이름>    클라우드 연결 프로필', '  --trip <ID>         시작할 여행', '  --plain             번호 입력 메뉴', '  --no-color          색상 끄기', '',
    '방향키 이동 · Enter 선택 · Tab 패널 · Esc 뒤로 · Q 종료', '입력: Ctrl+S/F10 확인 · Ctrl+J 줄바꿈 · Shift+Tab 이전 필드', '확인 화면: PgUp/PgDn 내용 스크롤 · ←→ 실행/취소 선택', '',
    '120열 × 38행 권장, 최소 60열 × 20행. 실제 터미널에서 실행하세요.', '파일 모드는 실행 전 확인 후 선택한 JSON 원본에 저장합니다.', '사용 안내: docs/cli.md#대화형-터미널',
  ].join('\n');
  const lines = ['TripLOG CLI — 여행 데이터와 개발 작업', '', '사용: triplog <영역> <명령> [옵션]', '또는 npm run cli -- <영역> <명령> [옵션]', ''];
  for (const [name, actions] of Object.entries(commands)) if (!group || name === group) lines.push(`${name.padEnd(14)} ${actions.join(' | ') || (name === 'ui' ? '대화형 터미널 메뉴 (--demo 체험, --plain 번호 메뉴)' : '<trip|itinerary|expense|packing|companion|reservation|settlement>')}`);
  lines.push('', '공통 옵션:', '  --json                        기계가 읽을 수 있는 JSON 출력', '  --profile <이름>               연결 프로필 (기본 default)', '  --source cloud|file            데이터 원본 (기본 cloud, --store 사용 시 file)', '  --trip <ID> --id <항목ID>       변경할 여행·항목을 명시', '  --file <JSON|-> / --data <JSON> 복잡한 입력; -는 표준입력', '  --dry-run                      변경 내용 확인 (데이터 저장 안 함)', '  --store <JSON>                 파일 모드 입력', '  --out <새파일> / --in-place     파일 모드 저장 대상', '  --overwrite                    명시한 출력 파일 덮어쓰기', '', '기본 입력: --name --start --end --country --country-code --city --mode', '일정: --date --time --end-time --place --memo --trans --duration --cost --sync-expense true|false', '지출: --date --category --description --amount --currency --foreign-amount --exchange-rate --exchange-base --payer', '기타: --checked true|false --target <ID> --placement before|after --text <내용>', '리포트: --format json|csv|html|pdf|ics --type full|expense|itinerary --out <파일>', '개발: dev test --suite all|source|sync|browser|edge|maps|order|print|offline|cli', '배포: dev deploy plan/run/status; run에는 --files <경로> (반복), --message <메시지>', '', 'triplog schema <영역>으로 JSON 필드를 확인할 수 있습니다.', '파일 모드는 원본을 자동 덮어쓰지 않습니다. 서버 모드는 브라우저의 미전송·비공개 데이터에 접근하지 않습니다.', '자동화 인증: TRIPLOG_ACCESS_TOKEN. 연결 설정: TRIPLOG_URL, TRIPLOG_PUBLISHABLE_KEY.', '사용 안내: docs/cli.md');
  return lines.join('\n');
}
module.exports = { parse, help, commands, validateOptions };
