'use strict';
const { EventEmitter } = require('node:events');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs/promises');
const Domain = require('../../src/app/domain/commands');
const Companion = require('../../src/app/features/travel-companion/model');
const { readJson } = require('../lib/files');
const { TerminalService, scopeKey, cleanPath } = require('./service');
const { fieldsFor, valuesFor, collect, text, select, yesNo } = require('./forms');
const { visibleFields, sections } = require('./render');
const { graphemes } = require('./screen');
const { Job } = require('./job');
const labels = { trip: '여행', itinerary: '일정', expense: '지출', reservation: '예약', packing: '준비물', companion: '동행인', settlement: '정산' };
class Controller extends EventEmitter {
  constructor(options = {}, { service = new TerminalService(), jobFactory = spec => new Job(spec) } = {}) {
    super(); this.options = options; this.service = service; this.jobFactory = jobFactory; this.stack = []; this.version = 0; this.tasks = new AsyncLocalStorage();
    this.state = { context: { source: options.store ? 'file' : options.source || 'cloud', profile: options.profile || 'default', ...(options.store ? { store: cleanPath(options.store) } : {}), ...(options.trip ? { trip: options.trip } : {}) }, demo: false, trip: null, trips: [], navIndex: 0, section: 0, focus: 'content', view: { type: 'home', title: '여행 개요', choices: [], index: 0 }, busy: false, notice: '연결하거나 예시 여행으로 시작하세요.', noticeTone: 'info', closed: false };
    this.home();
  }
  changed() { if (!this.state.closed && !this.tasks.getStore()?.cancelled) this.emit('change', this.state); }
  notice(message, tone = 'info') { if (this.tasks.getStore()?.cancelled) return; this.state.notice = message; this.state.noticeTone = tone; this.changed(); }
  show(view, { push = true } = {}) { if (this.tasks.getStore()?.cancelled || this.state.closed) return; if (push) this.stack.push(this.state.view); this.state.view = { index: 0, ...view }; this.state.focus = 'content'; this.changed(); }
  menu(title, choices, subtitle = '', extra = {}) { this.show({ type: 'choices', title, choices, subtitle, ...extra }); }
  back() {
    const view = this.state.view;
    if (view.type === 'form') for (const field of view.fields.filter(field => field.type === 'password')) view.values[field.key] = '';
    if (this.stack.length) { this.state.view = this.stack.pop(); this.state.focus = 'content'; }
    else this.state.focus = 'menu';
    this.changed();
  }
  async task(fn, { write = false } = {}) {
    if (this.state.busy || this.state.closed) return;
    const token = { cancelled: false }; this.activeTask = token; this.state.busy = true; this.writing = write; this.changed();
    try { const result = await this.tasks.run(token, fn); if (token.cancelled || this.state.closed) return; return result; }
    catch (error) { if (!token.cancelled && !this.state.closed) this.error(error); }
    finally { if (this.activeTask === token) { this.activeTask = null; this.state.busy = false; this.writing = false; this.changed(); } }
  }
  error(error) {
    const lines = [error.message || String(error)];
    if (error.code) lines.unshift(`상태: ${error.code}`);
    if (error.details?.journalId) lines.push(`요청 기록: ${error.details.journalId}`, '응답이 불명확하면 새로 저장하지 말고 요청 기록에서 재시도하세요.');
    if (error.details?.conflicts) lines.push('다른 변경과 겹쳤습니다. 최신 내용을 확인한 뒤 다시 입력해 주세요.');
    this.show({ type: 'result', title: '작업을 완료하지 못했습니다', error: true, lines });
    this.notice(lines[0], 'error');
  }
  async init() {
    if (this.options.demo) return this.task(async () => { await this.connect(await this.service.demo()); });
    await this.task(async () => {
      const saved = await this.service.preferences();
      if (this.tasks.getStore()?.cancelled) return;
      const context = !this.options.store && !this.options.source && !this.options.profile && saved && ['file', 'cloud'].includes(saved.source) ? { ...this.state.context, ...saved, ...(this.options.trip ? { trip: this.options.trip } : {}) } : this.state.context;
      try { await this.connect(context); }
      catch (error) { if (this.tasks.getStore()?.cancelled) return; if (['AUTH_REQUIRED', 'NOT_FOUND'].includes(error.code)) { this.state.context = { ...context, trip: undefined }; this.state.trip = null; this.state.record = null; this.state.trips = []; this.home(); this.notice('로그인, 백업 파일 열기, 예시 체험 중 선택하세요.'); } else throw error; }
    });
  }
  async connect(context) {
    if (this.tasks.getStore()?.cancelled || this.state.closed) return;
    const next = { profile: 'default', ...context }, trips = await this.service.call(next, 'trip', 'list');
    if (this.tasks.getStore()?.cancelled || this.state.closed) return;
    if (!next.trip && trips.length === 1) next.trip = trips[0].id;
    const record = next.trip ? await this.service.call(next, 'trip', 'show') : null;
    if (this.tasks.getStore()?.cancelled || this.state.closed) return;
    await this.service.remember(next);
    if (this.tasks.getStore()?.cancelled || this.state.closed) return;
    this.version++; this.state.context = next; this.state.demo = Boolean(next.demo); this.state.trip = record?.snapshot || null; this.state.record = record; this.state.trips = trips; this.stack = [];
    this.home(); this.notice(context.demo ? '체험 모드입니다. 실제 계정에 연결하지 않습니다.' : this.state.trip ? `${this.state.trip.tripName} 여행을 선택했습니다.` : '연결했습니다. 여행을 선택해 주세요.');
  }
  async refreshTrips(archived = false) {
    const key = scopeKey(this.state.context), trips = await this.service.call(this.state.context, 'trip', 'list', archived ? { archived: true } : {});
    if (key !== scopeKey(this.state.context) || this.tasks.getStore()?.cancelled) return;
    this.state.trips = trips;
    if (!this.state.context.trip && trips.length === 1) this.state.context.trip = trips[0].id;
  }
  async refreshTrip() {
    const key = scopeKey(this.state.context), result = await this.service.call(this.state.context, 'trip', 'show');
    if (key === scopeKey(this.state.context) && !this.tasks.getStore()?.cancelled) { this.state.trip = result.snapshot; this.state.record = result; }
  }
  home() {
    if (this.tasks.getStore()?.cancelled || this.state.closed) return;
    this.state.section = this.state.navIndex = 0;
    const choices = this.state.trip ? [
      { label: '[A] 여행 선택', run: () => this.pickTrip() }, { label: '[S] 일정 추가', run: () => this.domainForm('itinerary', 'add') }, { label: '[D] 지출 추가', run: () => this.domainForm('expense', 'add') },
      { label: '새 여행 만들기', run: () => this.domainForm('trip', 'create') }, { label: '여행 정보 수정', run: () => this.domainForm('trip', 'update') },
      { label: this.state.record?.archivedAt ? '여행 복원' : '여행 보관', danger: !this.state.record?.archivedAt, run: () => this.prepare({ kind: 'control', control: this.state.record?.archivedAt ? 'restore' : 'archive', label: this.state.record?.archivedAt ? '여행 복원' : '여행 보관', data: {} }) },
      { label: '공유 · 멤버 관리', run: () => this.collaboration() }, { label: '보관된 여행', run: () => this.pickTrip(true) },
    ] : [
      { label: '클라우드 로그인', detail: '기존 TripLOG 계정으로 연결', run: () => this.loginForm() },
      { label: '백업 JSON 열기', detail: '기기에 저장된 여행을 메뉴로 관리', run: () => this.fileForm() },
      { label: '새 여행 파일 만들기', detail: '계정 없이 JSON 파일에서 시작', run: () => this.fileForm(true) },
      { label: '예시로 둘러보기', detail: '실제 데이터와 분리된 체험 모드', run: () => this.task(async () => this.connect(await this.service.demo())) },
      { label: '개발 도구', detail: '실행 · 테스트 · 빌드 · 배포 계획', run: () => this.activate(8) },
      { label: '여행 목록 다시 불러오기', run: () => this.pickTrip() },
      { label: '초대 링크로 참여', run: () => this.inviteForm() },
    ];
    this.show({ type: 'home', title: '여행 개요', choices, subtitle: this.state.trip ? '' : '시작 방법을 선택하세요. 명령어를 입력하지 않아도 됩니다.' }, { push: false });
  }
  async activate(index) {
    if (this.state.busy) return;
    this.stack = []; this.state.navIndex = this.state.section = index; this.state.focus = 'content';
    if (index === 0) { this.home(); return; }
    if (index === 9) { this.connectionMenu(); return; }
    if (index === 8) { this.development(); return; }
    if (!this.state.trip) { this.notice('먼저 여행을 선택해 주세요.'); await this.pickTrip(); return; }
    if ([1, 2, 3, 4].includes(index)) return this.collection(['', 'itinerary', 'expense', 'reservation', 'packing'][index]);
    if (index === 5) this.menu('동행인 · 정산', [
      { label: '동행인 목록', run: () => this.collection('companion') }, { label: '동행인 추가', run: () => this.domainForm('companion', 'add') },
      { label: '정산 미리보기', run: () => this.readResult('정산 미리보기', 'settlement', 'preview') },
      { label: '정산 확정', run: () => this.prepare({ kind: 'finalize', label: '정산 확정' }) },
      { label: '정산 대표 이름 변경', run: () => this.form('대표 이름', [text('leaderName', '표시할 이름', true, this.state.trip.settlement?.leaderName || '여행 대표')], data => this.prepare({ kind: 'domain', group: 'settlement', action: 'update', data, label: '대표 이름 변경' })) },
      { label: '분담 설정 JSON 적용', run: () => this.jsonForm('settlement', 'update') },
    ]);
    if (index === 6) this.notesMenu();
    if (index === 7) this.backupMenu();
  }
  async pickTrip(archived = false) {
    return this.task(async () => {
      await this.refreshTrips(archived);
      const rows = this.state.trips.filter(row => !archived || row.archived);
      this.menu(archived ? '보관된 여행' : '여행 선택', [
        ...rows.map(row => ({ label: row.name || '이름 없는 여행', detail: `${row.startDate || ''} ~ ${row.endDate || ''} · ${row.city || ''}${row.archived ? ' · 보관됨' : ''}`, run: () => this.task(async () => {
          await this.connect({ ...this.state.context, trip: row.id });
        }) })),
        { label: '+ 새 여행 만들기', run: () => this.domainForm('trip', 'create') },
      ], '이름으로 고르면 ID는 자동으로 연결됩니다.', { searchable: true });
    });
  }
  async collection(kind) {
    return this.task(async () => {
      const rows = await this.service.call(this.state.context, kind, 'list');
      const choices = [{ label: `+ ${labels[kind]} 추가`, run: () => this.domainForm(kind, 'add') }];
      if (kind === 'expense') choices.push({ label: '지출 합계 보기', run: () => this.readResult('지출 합계', 'expense', 'summary') });
      for (const row of rows) choices.push({ label: `${kind === 'packing' ? row.checked ? '[완료] ' : '[  ] ' : ''}${row.place || row.description || row.title || row.name || row.id}`, detail: `${row.date || ''}${row.time ? ' ' + row.time : ''}${row.amount !== undefined ? ' · ' + Number(row.amount).toLocaleString('ko-KR') + '원' : ''}`, run: () => this.itemMenu(kind, row, rows) });
      choices.push({ label: '고급 JSON 입력', run: () => this.jsonForm(kind, 'add') });
      this.menu(`${labels[kind]} 목록`, choices, `${this.state.trip.tripName} · ${rows.length}개`, { searchable: true });
    });
  }
  itemMenu(kind, row, rows) {
    const manualId = kind === 'reservation' ? row.sourceId || row.id.replace(/^manual:/, '') : row.id;
    const derived = kind === 'reservation' && row.source !== 'manual';
    const choices = [{ label: '상세 보기', run: () => this.result(`${labels[kind]} 상세`, row) }];
    if (derived) choices.push({ label: '원본 항목 수정', run: () => this.domainForm(row.source === 'entry' ? 'expense' : 'itinerary', 'update', { id: row.sourceId }) });
    else choices.push({ label: '수정', run: () => this.domainForm(kind, 'update', { id: manualId }) });
    if (kind === 'packing') choices.push({ label: row.checked ? '준비 완료 해제' : '준비 완료 표시', run: () => this.prepare({ kind: 'domain', group: kind, action: 'check', label: '준비물 상태 변경', options: { id: row.id, checked: !row.checked } }) });
    if (kind === 'itinerary') {
      for (const [action, key, label] of [['complete', 'completedItineraryIds', '일정 완료'], ['lock', 'lockedItineraryIds', '일정 잠금']]) { const checked = !(this.state.trip.travelCompanion?.[key] || []).includes(row.id); choices.push({ label: label + (checked ? ' 표시' : ' 해제'), run: () => this.prepare({ kind: 'domain', group: kind, action, label, options: { id: row.id, checked } }) }); }
      choices.push({ label: '첨부파일 올리기', run: () => this.form('티켓 첨부', [text('file', 'PDF / 이미지 파일 경로', true)], data => this.prepare({ kind: 'attachment', group: 'attachment', action: 'upload', label: '티켓 첨부', options: { id: row.id, file: cleanPath(data.file) } })) });
      if (row.voucherFile) choices.push({ label: '첨부파일 저장', run: () => this.exportForm('attachment', 'download', { id: row.id }, '첨부파일 저장', row.voucherFileName?.split('.').pop() || 'pdf') });
    }
    if (kind === 'itinerary' || kind === 'packing') choices.push({ label: '순서 이동', run: () => this.menu('어느 항목으로 이동할까요?', rows.filter(other => other.id !== row.id && (kind !== 'itinerary' || other.date === row.date)).map(other => ({ label: other.place || other.name, run: () => this.form('이동 위치', [select('placement', '위치', [['before', '선택한 항목 앞'], ['after', '선택한 항목 뒤']])], data => this.prepare({ kind: 'domain', group: kind, action: 'move', label: '순서 이동', options: { id: row.id, target: other.id, placement: data.placement } })) }))) });
    if (kind === 'reservation') choices.push({ label: '일정에 연결', run: () => this.prepare({ kind: 'domain', group: kind, action: 'link', label: '예약을 일정에 연결', options: { id: row.id } }) });
    if (!derived) choices.push({ label: '삭제', danger: true, run: () => this.prepare({ kind: 'domain', group: kind, action: 'remove', label: `${labels[kind]} 삭제`, options: { id: manualId } }) });
    this.menu(row.place || row.description || row.title || row.name, choices);
  }
  async domainForm(kind, action, options = {}) {
    return this.task(async () => {
      let captured, row = {}, trip = this.state.trip;
      if (!(kind === 'trip' && action === 'create')) { captured = await this.service.capture(this.state.context); trip = captured.record.snapshot; row = kind === 'trip' ? trip : action === 'update' ? Domain.find(trip, kind, options.id) : {}; }
      const fields = fieldsFor(kind, trip, row), initial = valuesFor(fields);
      this.form(`${labels[kind]} ${['add', 'create'].includes(action) ? '추가' : '수정'}`, fields, data => {
        if (kind === 'expense' && data.mode === 'overseas' && data.foreignAmount !== undefined) data.amount = Math.round(data.foreignAmount * data.exchangeRate / data.exchangeBase);
        if (action === 'update') data = Object.fromEntries(Object.entries(data).filter(([key]) => String(data[key]) !== initial[key] || !Object.hasOwn(row, key) && data[key] !== ''));
        return this.prepare({ kind: 'domain', group: kind, action, data, options, captured, label: `${labels[kind]} ${['add', 'create'].includes(action) ? '추가' : '수정'}` });
      });
    });
  }
  form(title, fields, submit, extra = {}) { this.show({ type: 'form', title, fields, values: valuesFor(fields), submit, ...extra }); }
  async submitForm() {
    const view = this.state.view; if (view.type !== 'form' || this.state.busy) return;
    try { const data = collect(view.fields, view.values); view.error = ''; await view.submit(data); }
    catch (error) { view.error = error.message; this.changed(); }
  }
  async prepare(spec) {
    return this.task(async () => {
      const prepared = await this.service.prepare(this.state.context, spec);
      this.show({ type: 'confirm', title: '실행 전 확인', subtitle: `${this.state.trip?.tripName || '새 여행'} · ${spec.label}`, summary: prepared.summary, choices: [
        { label: '돌아가서 수정', run: () => this.back() },
        { label: '확인하고 실행', run: () => this.task(async () => {
          if (prepared.scope !== scopeKey(this.state.context)) throw new Error('여행 또는 연결이 바뀌었습니다. 다시 확인해 주세요.');
          const result = await prepared.execute();
          if (spec.group === 'trip' && spec.action === 'create') this.state.context.trip = result.tripId || prepared.preview.snapshot.id;
          if (spec.group === 'invite' && spec.action === 'accept' && result.tripId) this.state.context.trip = result.tripId;
          const loggedOut = spec.group === 'auth' && spec.action === 'logout';
          let followUp = '';
          if (loggedOut || spec.control === 'leave') { delete this.state.context.trip; this.state.trip = null; this.state.record = null; this.state.trips = []; }
          if (!loggedOut) {
            try { await this.refreshTrips(); if (this.state.context.trip) await this.refreshTrip(); }
            catch (_) { followUp = '저장은 완료했습니다. R로 최신 화면을 다시 불러와 주세요.'; }
          }
          try { await this.service.remember(this.state.context); } catch (_) { followUp ||= '작업은 완료됐습니다. 최근 연결 설정은 저장하지 못했습니다.'; }
          this.stack = []; this.result('작업 완료', result); this.state.view.onBack = () => this.activate(this.state.section); this.notice(followUp || '완료했습니다. Enter로 메뉴에 돌아갑니다.');
        }, { write: true }) },
      ] });
    });
  }
  result(title, data) {
    let lines;
    if (typeof data === 'string') lines = data.split('\n');
    else if (data?.text !== undefined) lines = data.text.split('\n');
    else if (data?.calculation) { const c = data.calculation; lines = [`총 지출  ${Number(c.total).toLocaleString('ko-KR')}원`, '', ...c.members.map(person => `${person.name} · 결제 ${person.paid.toLocaleString('ko-KR')}원 / 분담 ${person.owed.toLocaleString('ko-KR')}원`), '', '송금 안내', ...c.transfers.map(item => `${c.members.find(person => person.key === item.from)?.name || item.from} → ${c.members.find(person => person.key === item.to)?.name || item.to}  ${item.amount.toLocaleString('ko-KR')}원`)]; }
    else if (data?.checks) lines = data.checks.map(row => `${row.ok ? '[확인]' : row.required === false ? '[선택]' : '[점검]'} ${row.name}  ${row.version || row.paths?.join(', ') || (row.ok ? '사용 가능' : '설치를 확인해 주세요.')}`);
    else if (data?.status === 'saved' || data?.status === 'applied' || data?.status === 'unchanged') lines = [data.status === 'saved' ? '선택한 파일에 저장했습니다.' : data.status === 'unchanged' ? '변경할 내용이 없습니다.' : '서버에 저장했습니다.', ...(data.file ? ['저장 파일: ' + data.file] : []), ...(data.journalId ? ['요청 기록: ' + data.journalId] : [])];
    else if (data?.url && data?.token) lines = ['초대 링크를 만들었습니다.', '', data.url, '', '터미널에서 링크를 선택해 복사할 수 있습니다.'];
    else if (data?.file) lines = ['파일을 저장했습니다.', '', data.file, ...(data.missingAttachments?.length ? [`첨부파일 ${data.missingAttachments.length}개를 받지 못했습니다. 백업 내용을 확인해 주세요.`] : [])];
    else if (data?.total !== undefined && data?.count !== undefined) lines = [`누적 지출  ${Number(data.total).toLocaleString('ko-KR')}원`, `지출 기록  ${data.count}건`, `사전구매  ${Number(data.pretrip || 0).toLocaleString('ko-KR')}원`, `여행 중 지출  ${Number(data.during || 0).toLocaleString('ko-KR')}원`];
    else if (data?.place || data?.description || data?.title || data?.name) {
      const names = { place: '장소', description: '내용', title: '이름', name: '이름', date: '날짜', time: '시작', endTime: '종료', location: '주소', amount: '금액', category: '분류', note: '메모', memo: '메모', reference: '예약번호', checked: '준비 완료', individualSpent: '별도 지출', from: '출발', to: '도착', endDate: '종료일' };
      lines = Object.entries(names).filter(([key]) => data[key] !== undefined && data[key] !== '').map(([key, label]) => `${label}: ${typeof data[key] === 'boolean' ? data[key] ? '예' : '아니요' : data[key]}`);
      if (data.voucherFile) lines.push('첨부파일: ' + (data.voucherFileName || '있음'));
    } else lines = JSON.stringify(data ?? {}, null, 2).split('\n');
    this.show({ type: 'result', title, lines, scroll: 0 });
  }
  readResult(title, group, action, options) { return this.task(async () => this.result(title, await this.service.call(this.state.context, group, action, options))); }
  jsonForm(group, action, options = {}) { this.form(`${labels[group] || group} JSON 입력`, [text('file', '입력 JSON 파일 경로', true)], async values => { const data = await readJson(cleanPath(values.file)); return this.prepare({ kind: 'domain', group, action, data: Domain.input(group, data), options, label: 'JSON 입력 적용' }); }, { subtitle: `JSON 필드 목록: triplog schema ${group}` }); }
  notesMenu() {
    this.menu('메모 · 댓글', [
      { label: '공동 메모 읽기', run: () => this.readResult('공동 메모', 'note', 'show') },
      ...[['append', '메모 이어 쓰기'], ['set', '메모 새로 쓰기']].map(([action, label]) => ({ label, run: () => this.form(label, [text('text', '내용 (Ctrl+J 줄바꿈)', action === 'append')], data => this.prepare({ kind: 'document', group: 'note', action, text: data.text, label })) })),
      { label: '메모 파일 불러오기', run: () => this.form('텍스트 파일로 메모 쓰기', [text('file', '텍스트 파일 경로', true)], async data => this.prepare({ kind: 'document', group: 'note', action: 'set', text: await fs.readFile(cleanPath(data.file), 'utf8'), label: '메모 파일 적용' })) },
      { label: '댓글 목록', run: () => this.task(async () => this.menu('댓글', (await this.service.call(this.state.context, 'comment', 'list')).map(row => ({ label: row.body, detail: row.createdAt || '', run: () => this.menu('댓글 작업', [{ label: '전체 내용', run: () => this.result('댓글', row.body) }, { label: '댓글 삭제', danger: true, run: () => this.prepare({ kind: 'document', group: 'comment', action: 'remove', options: { id: row.id }, label: '댓글 삭제' }) }]) })), '', { searchable: true })) },
      { label: '댓글 추가', run: () => this.form('댓글 추가', [select('target', '대상', [['', '여행 전체'], ...(this.state.trip.itineraryItems || []).map(item => [item.id, item.place])]), text('text', '내용', true)], data => this.prepare({ kind: 'document', group: 'comment', action: 'add', text: data.text, options: { target: data.target }, label: '댓글 추가' })) },
    ]);
  }
  exportForm(group, action, options, label, extension) {
    this.form(label, [text('out', '저장 경로', true, this.service.outputPath(this.state.trip, extension)), yesNo('overwrite', '같은 이름의 파일 덮어쓰기')], data => this.prepare({ kind: 'command', group, action, label, options: { ...options, out: cleanPath(data.out), overwrite: data.overwrite } }));
  }
  backupMenu() {
    this.menu('백업 · 리포트', [
      { label: '현재 여행 JSON 백업', run: () => this.exportForm('backup', 'export', {}, 'JSON 백업', 'json') },
      { label: 'JSON 백업 가져오기', run: () => this.form('새 여행으로 복원', [text('file', '백업 JSON 파일 경로', true)], data => this.prepare({ kind: 'command', group: 'backup', action: 'import', label: '백업을 새 여행으로 복원', preview: true, write: true, options: { file: cleanPath(data.file) } })) },
      ...[['pdf', 'PDF 리포트'], ['csv', '지출 CSV'], ['ics', '일정 캘린더 ICS'], ['html', '오프라인 HTML'], ['json', '리포트 JSON']].map(([format, label]) => ({ label, run: () => this.exportForm('report', 'export', { format }, label, format) })),
      { label: '변경 이력 · 복원', run: () => this.task(async () => {
        const result = await this.service.call(this.state.context, 'history', 'list'), rows = result.history || result;
        this.menu('변경 이력', rows.map(row => ({ label: `${row.sequence || row.id?.slice(0, 8)} · ${row.label || '여행 변경'}`, detail: row.created_at || row.createdAt || '', run: () => this.menu('변경 이력', [{ label: '변경 내용', run: () => this.result('변경 내용', row) }, { label: '이 변경 복원', run: () => this.prepare({ kind: 'control', control: 'restore-change', data: this.state.context.source === 'file' ? { id: row.id } : { sequence: row.sequence }, label: '변경 이력 복원' }) }]) })), '최근 변경부터 확인하고 복원하세요.');
      }) },
      { label: '서버 요청 기록 · 재시도', run: () => this.task(async () => this.menu('요청 기록', (await this.service.call(this.state.context, 'operation', 'list')).map(row => ({ label: `${row.status} · ${row.label}`, detail: row.createdAt, run: () => this.menu('요청 작업', [{ label: '요청 상세', run: () => this.readResult('요청 상세', 'operation', 'show', { id: row.id }) }, { label: '동일 요청 재시도', run: () => this.prepare({ kind: 'command', group: 'operation', action: 'retry', label: '동일 요청 재시도', options: { id: row.id } }) }]) })))) },
    ]);
  }
  collaboration() {
    this.menu('공유 · 멤버', [
      { label: '멤버 관리', run: () => this.task(async () => this.menu('멤버', (await this.service.call(this.state.context, 'member', 'list')).members.map(row => ({ label: `${row.display_name || '멤버'} · ${row.role}`, run: () => this.menu('멤버 권한', [
        ...[['viewer', '조회 전용'], ['editor', '편집 허용'], ['remove', '멤버에서 제거']].map(([role, label]) => ({ label, run: () => this.prepare({ kind: 'control', control: 'member', data: { userId: row.user_id, role }, label }) })),
        { label: '소유권 이전', run: () => this.prepare({ kind: 'control', control: 'transfer-owner', data: { userId: row.user_id }, label: '여행 소유권 이전' }) },
      ]) })))) },
      { label: '초대 링크 만들기', run: () => this.form('초대 권한', [select('role', '초대할 권한', [['viewer', '조회 전용'], ['editor', '편집 허용']])], data => this.prepare({ kind: 'control', control: 'invite', data, label: '초대 링크 생성' })) },
      { label: '초대 코드로 참여', run: () => this.inviteForm() },
      { label: '공유 범위', run: () => this.task(async () => { const captured = await this.service.capture(this.state.context), privacy = { shareItinerary: true, shareExpenses: true, showMemberEmail: false, allowInviteRequests: true, ...captured.record.privacy }; this.form('공유 범위', [yesNo('shareItinerary', '일정 공유', privacy.shareItinerary), yesNo('shareExpenses', '지출 공유', privacy.shareExpenses), yesNo('showMemberEmail', '이메일 표시', privacy.showMemberEmail), yesNo('allowInviteRequests', '초대 요청 허용', privacy.allowInviteRequests)], data => this.prepare({ kind: 'control', control: 'privacy', data, captured, label: '공유 범위 변경' })); }) },
      { label: '내 표시 이름', run: () => this.form('표시 이름', [text('displayName', '이름', true)], data => this.prepare({ kind: 'control', control: 'profile', data, label: '표시 이름 변경' })) },
      { label: '공유 여행 나가기', danger: true, run: () => this.prepare({ kind: 'control', control: 'leave', data: {}, label: '공유 여행 탈퇴' }) },
    ], '클라우드 여행에서 권한에 맞춰 실행합니다.');
  }
  inviteForm() {
    this.form('여행 초대 참여', [text('token', '초대 링크 또는 코드', true)], data => {
      let token = data.token.trim();
      if (/^https?:\/\//i.test(token)) token = new URL(token).searchParams.get('invite') || '';
      return this.prepare({ kind: 'command', group: 'invite', action: 'accept', label: '여행 초대 수락', preview: true, options: { token } });
    }, { subtitle: '먼저 클라우드 계정으로 로그인해 주세요.' });
  }
  connectionMenu() {
    this.menu('연결 설정', [
      { label: '클라우드 로그인', run: () => this.loginForm() }, { label: '백업 JSON 열기', run: () => this.fileForm() }, { label: '새 여행 파일 만들기', run: () => this.fileForm(true) },
      { label: '예시 체험 시작', run: () => this.task(async () => this.connect(await this.service.demo())) },
      { label: '클라우드 프로필 선택', run: () => this.form('프로필 선택', [text('profile', '프로필 이름', true, 'default')], data => this.task(async () => this.connect({ source: 'cloud', profile: data.profile }))) },
      { label: '연결 정보 보기', run: () => this.readResult('연결 정보', 'config', 'show') },
      { label: '연결 정보 변경', run: () => this.form('Supabase 연결', [text('profile', '프로필 이름', true, this.state.context.profile), text('url', '프로젝트 HTTPS URL', true), text('key', 'Publishable 키', true)], data => this.task(async () => { await this.service.call({ profile: data.profile }, 'config', 'set', { url: data.url, key: data.key }); await this.connect({ source: 'cloud', profile: data.profile }); }, { write: true })) },
      { label: '로그인 상태', run: () => this.readResult('로그인 상태', 'auth', 'status') },
      { label: '초대 링크로 참여', run: () => this.inviteForm() },
      { label: '로그아웃', run: () => this.prepare({ kind: 'command', group: 'auth', action: 'logout', label: 'CLI 세션 로그아웃' }) },
      { label: '도움말', run: () => this.help() },
    ], this.state.context.store || `프로필: ${this.state.context.profile}`);
  }
  loginForm() {
    this.form('TripLOG 로그인', [text('profile', '프로필', true, this.state.context.profile || 'default'), text('email', '이메일', true), text('password', '비밀번호', true, '', { type: 'password' })], data => this.task(async () => {
      const form = this.state.view;
      try { await this.service.login({ profile: data.profile }, data.email, data.password); await this.connect({ source: 'cloud', profile: data.profile }); }
      finally { data.password = ''; form.values.password = ''; }
    }, { write: true }), { submitLabel: '로그인', subtitle: '비밀번호는 화면·명령 인자·설정 파일에 남기지 않습니다.' });
  }
  fileForm(create = false) {
    this.form(create ? '새 여행 파일' : 'JSON 백업 열기', [text('store', 'JSON 파일 경로', true, create ? this.service.outputPath(null, 'json') : '')], data => this.task(async () => {
      const store = cleanPath(data.store);
      if (create) {
        if (await fs.stat(store).catch(() => null)) throw new Error('이미 있는 파일입니다. 백업 JSON 열기를 사용해 주세요.');
        if (this.tasks.getStore()?.cancelled) return;
        this.version++; this.state.context = { source: 'file', profile: 'default', store }; this.state.demo = false; this.state.trip = null; this.state.trips = []; this.stack = []; this.state.busy = false; this.home(); await this.domainForm('trip', 'create');
      } else await this.connect({ source: 'file', profile: 'default', store });
    }), { submitLabel: create ? '여행 정보 입력' : '파일 열기' });
  }
  development() {
    this.menu('개발 도구', [
      { label: '환경 진단', detail: 'Node · npm · Git · 브라우저', run: () => this.readResult('환경 진단', 'dev', 'doctor') },
      { label: '로컬 미리보기 시작', detail: '중단하면 서버 프로세스도 함께 종료', run: () => this.form('미리보기 포트', [text('port', '포트', true, '18080')], values => this.startJob('로컬 미리보기', ['dev', 'serve', '--port', values.port], { server: true })) },
      { label: '테스트 실행', run: () => this.menu('실행할 테스트', [['cli', 'CLI'], ['terminal', '터미널 UI'], ['source', '소스 검사'], ['sync', '동기화'], ['browser', '브라우저 전체'], ['all', '전체 단위 테스트'], ['edge', 'Edge Function']].map(([suite, label]) => ({ label, run: () => this.startJob(label, ['dev', 'test', '--suite', suite]) }))) },
      { label: '빌드', run: () => this.startJob('배포 파일 빌드', ['dev', 'build']) },
      { label: '산출물 검사', run: () => this.startJob('산출물 검사', ['dev', 'artifacts']) },
      { label: '배포 계획 확인', run: () => this.deployForm(false) }, { label: '배포 실행', detail: '파일 범위 확인 후 커밋·푸시', run: () => this.deployForm(true) },
      { label: '운영 반영 상태', run: () => this.task(async () => this.result('운영 반영 상태', await this.service.call(this.state.context, 'dev', 'deploy', {}, 'status'))) },
    ], '현재 TripLOG 저장소에서 기존 CLI 명령을 실행합니다.');
  }
  deployForm(execute) {
    this.form(execute ? '배포 범위 입력' : '배포 계획', [text('files', '파일 경로 (한 줄에 하나, Ctrl+J 줄바꿈)', true), ...(execute ? [text('message', '커밋 메시지', true)] : [])], data => this.task(async () => {
      const files = data.files.split(/\r?\n/).map(line => line.trim()).filter(Boolean), plan = await this.service.call(this.state.context, 'dev', 'deploy', { files }, 'plan');
      if (!execute || plan.blockers.length) { this.result(plan.blockers.length ? '배포 선행 조건' : '배포 계획', plan); return; }
      this.show({ type: 'confirm', title: '커밋 · 푸시 확인', subtitle: 'origin/main으로 배포합니다.', summary: `커밋 메시지: ${data.message}\n\n포함 파일\n${files.join('\n')}\n\n테스트와 빌드 후 커밋·푸시를 실행합니다.`, choices: [{ label: '취소', run: () => this.back() }, { label: '검증 후 배포', run: () => this.startJob('배포 실행', ['dev', 'deploy', 'run', ...files.flatMap(file => ['--files', file]), '--message', data.message]) }] });
    }));
  }
  startJob(label, args, extra = {}) {
    if (this.job) return;
    this.job = this.jobFactory({ args });
    this.show({ type: 'job', title: label, lines: [], running: true, ...extra }); const view = this.state.view;
    this.job.on('line', line => { view.lines.push(line); if (view.lines.length > 2000) view.lines.shift(); view.scroll = undefined; this.changed(); });
    this.job.once('done', result => { view.running = false; view.result = result; view.subtitle = result.cancelled ? '작업을 중단했습니다. Enter로 메뉴로 돌아갑니다.' : result.code === 0 ? '작업이 완료됐습니다. Enter로 돌아갑니다.' : `종료 코드 ${result.code} · 출력 내용을 확인하세요.`; view.error = !result.cancelled && result.code !== 0; this.job = null; this.changed(); });
    this.job.start();
  }
  help() { this.result('터미널 도움말', ['방향키: 메뉴·항목 선택 / Enter: 열기', 'Tab: 왼쪽 메뉴와 본문 전환 / Esc: 이전 화면', '1~9, 0: 영역 바로가기 / A: 여행 선택', 'S: 일정 추가 / D: 지출 추가 / R: 새로고침', '/: 목록 검색 / Q: 종료', '', '입력: Enter/Tab으로 다음 항목, Ctrl+S로 확인', '선택형 항목: ←→ / Ctrl+J: 줄바꿈', '입력 중 Q는 글자로 입력됩니다.', '', '저장은 변경 미리보기 후 실행합니다.', '서버 모드는 브라우저 미전송·비공개 데이터를 읽지 않습니다.', '파일 모드는 선택한 JSON 원본에 저장합니다.', '체험 모드는 별도 예시 파일만 수정합니다.']); }
  filteredChoices() { const view = this.state.view; return (view.choices || []).filter(row => !view.query || `${row.label} ${row.detail || ''}`.toLowerCase().includes(view.query.toLowerCase())); }
  scrollView(name) {
    const view = this.state.view, range = this.scrollRange?.view === view ? this.scrollRange : {};
    const maximum = range.max ?? (view.lines || [view.summary || '']).reduce((total, line) => total + String(line).length + 1, 0);
    const current = Math.min(view.scroll ?? (view.type === 'job' ? maximum : 0), maximum);
    view.scroll = Math.max(0, Math.min(maximum, current + (name.includes('up') ? -1 : 1) * (name.startsWith('page') ? range.page || 10 : 1)));
    this.changed();
  }
  async key(character, key = {}) {
    if (this.state.closed) return;
    const view = this.state.view, name = key.name;
    if (this.job && ['escape'].includes(name) || this.job && key.ctrl && name === 'c') { await this.job.cancel(); return; }
    if (key.ctrl && name === 'c') { this.close(); return; }
    if (this.state.busy) { if (name === 'escape' && !this.writing) { if (this.activeTask) this.activeTask.cancelled = true; this.activeTask = null; this.version++; this.state.busy = false; this.writing = false; this.notice('화면 작업을 취소했습니다.'); } return; }
    if (name === 'escape') { if (view.searching) { view.searching = false; view.query = ''; } else if (view.onBack) view.onBack(); else this.back(); this.changed(); return; }
    if (view.type === 'job') { if (!view.running && name === 'return') this.back(); else if (['up', 'down', 'pageup', 'pagedown'].includes(name)) this.scrollView(name); return; }
    if (view.type === 'form' && this.state.focus === 'content') return this.formKey(character, key);
    if (view.searching) { if (name === 'return') view.searching = false; else if (name === 'backspace') view.query = graphemes(view.query).slice(0, -1).join(''); else if (character && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(character)) view.query += character; view.index = 0; this.changed(); return; }
    if (name === 'tab') { this.state.focus = this.state.focus === 'menu' ? 'content' : 'menu'; this.changed(); return; }
    if (character === 'q' || character === 'Q') { this.close(); return; }
    if (character === '?') { this.help(); return; }
    if (/^[0-9]$/.test(character || '')) return this.activate(character === '0' ? 9 : Number(character) - 1);
    if (character?.toLowerCase() === 'a') return this.pickTrip();
    if (character?.toLowerCase() === 's' && this.state.trip) return this.domainForm('itinerary', 'add');
    if (character?.toLowerCase() === 'd' && this.state.trip) return this.domainForm('expense', 'add');
    if (character?.toLowerCase() === 'r') return this.task(async () => { await this.refreshTrips(); if (this.state.context.trip) await this.refreshTrip(); this.home(); this.notice('최신 내용을 불러왔습니다.'); });
    if (this.state.focus === 'menu') { if (name === 'up') this.state.navIndex = (this.state.navIndex + 9) % 10; if (name === 'down') this.state.navIndex = (this.state.navIndex + 1) % 10; if (name === 'return' || name === 'right') return this.activate(this.state.navIndex); this.changed(); return; }
    if (view.type === 'result') { if (name === 'return') { if (view.onBack) view.onBack(); else this.back(); } else if (['up', 'down', 'pageup', 'pagedown'].includes(name)) this.scrollView(name); this.changed(); return; }
    if (view.type === 'confirm' && ['pageup', 'pagedown'].includes(name)) { this.scrollView(name); return; }
    if (character === '/' && view.searchable) { view.searching = true; view.query = ''; this.changed(); return; }
    const choices = this.filteredChoices();
    if (['up', 'left'].includes(name)) view.index = Math.max(0, view.index - 1);
    if (['down', 'right'].includes(name)) view.index = Math.min(Math.max(0, choices.length - 1), view.index + 1);
    if (name === 'home') view.index = 0;
    if (name === 'end') view.index = Math.max(0, choices.length - 1);
    if (name === 'return') { const choice = choices[view.index]; if (choice) await choice.run(); }
    this.changed();
  }
  async formKey(character, key) {
    const view = this.state.view, fields = visibleFields(view), name = key.name;
    if (key.ctrl && name === 's' || name === 'f10') return this.submitForm();
    if (name === 'tab' && key.shift) view.index = Math.max(0, view.index - 1);
    else if (name === 'tab' || name === 'down') view.index = Math.min(fields.length, view.index + 1);
    else if (name === 'up') view.index = Math.max(0, view.index - 1);
    else if (name === 'return') { if (view.index >= fields.length) return this.submitForm(); view.index++; }
    else {
      const field = fields[view.index]; if (!field) return;
      if (field.type === 'select') {
        if (['left', 'right', 'space'].includes(name)) { const index = field.options.findIndex(option => String(option.value) === view.values[field.key]); view.values[field.key] = String(field.options[(index + (name === 'left' ? -1 : 1) + field.options.length) % field.options.length].value); }
      } else {
        view.cursors ||= {}; const parts = graphemes(view.values[field.key]); let cursor = Math.min(view.cursors[field.key] ?? parts.length, parts.length);
        if (name === 'backspace' && cursor > 0) { parts.splice(cursor - 1, 1); cursor--; }
        else if (name === 'delete') parts.splice(cursor, 1);
        else if (name === 'left') cursor = Math.max(0, cursor - 1);
        else if (name === 'right') cursor = Math.min(parts.length, cursor + 1);
        else if (name === 'home') cursor = 0;
        else if (name === 'end') cursor = parts.length;
        else if (key.ctrl && name === 'u') { parts.splice(0); cursor = 0; }
        else if (key.ctrl && name === 'j' && field.type !== 'password') { parts.splice(cursor, 0, '\n'); cursor++; }
        else if (character && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(character) && view.values[field.key].length < (field.type === 'password' ? 1024 : 100000)) { const inserted = graphemes(character); parts.splice(cursor, 0, ...inserted); cursor += inserted.length; }
        view.values[field.key] = parts.join(''); view.cursors[field.key] = cursor;
      }
    }
    view.error = ''; this.changed();
  }
  paste(value) {
    const view = this.state.view; if (this.state.busy || view.type !== 'form' || this.state.focus !== 'content') return;
    const field = visibleFields(view)[view.index]; if (!field || field.type === 'select') return;
    const text = String(value).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, '');
    const inserted = graphemes(field.type === 'password' ? text.replaceAll('\n', '') : text), parts = graphemes(view.values[field.key]);
    view.cursors ||= {}; const cursor = Math.min(view.cursors[field.key] ?? parts.length, parts.length);
    parts.splice(cursor, 0, ...inserted); view.values[field.key] = parts.join('').slice(0, field.type === 'password' ? 1024 : 100000); view.cursors[field.key] = cursor + inserted.length; this.changed();
  }
  close() { if (this.state.closed) return; this.state.closed = true; this.version++; if (this.job) this.job.cancel().catch(() => {}); this.emit('close', { pendingWrite: Boolean(this.writing) }); }
}
module.exports = { Controller };
