# TripLOG CLI 사용법

TripLOG CLI는 여행 데이터 관리와 프로젝트 실행·검증·배포를 터미널에서 수행합니다. Node.js 24 이상을 사용하며, 웹앱과 같은 동기화 API, 일정 순서, 예약, 비용 및 리포트 모델을 사용합니다.

## 실행

```powershell
npm ci
npm run cli -- --help
npm run cli -- dev doctor
```

프로젝트 경로 밖에서도 `triplog` 명령을 쓰려면 이 저장소에서 `npm link`를 한 번 실행합니다. 전역 등록 없이 `node bin/triplog.js`로도 실행할 수 있습니다. 개발 명령은 실행 위치와 관계없이 이 CLI가 설치된 TripLOG 저장소에서 실행됩니다.

자동화에서는 `triplog … --json`, `node bin/triplog.js … --json` 또는 npm 안내 문구를 생략하는 `npm run --silent cli -- … --json`을 사용합니다. 성공은 `{"ok":true,"data":…}`, 실패는 `{"ok":false,"error":{"code":…,"message":…,"details":…}}` 형태의 JSON 한 개입니다. 실행 로그는 stderr로 출력합니다.

## 대화형 터미널

프로젝트 폴더의 `TripLOG.cmd`를 더블클릭하거나 PowerShell / Windows Terminal에서 다음 명령을 사용합니다. 최초 준비에는 위의 `npm ci`가 필요합니다.

```powershell
npm run terminal
npm run terminal:demo
npm run terminal -- --store "C:\여행\backup.json"
npm run terminal -- --profile staging
npm run terminal -- --plain
npm run terminal -- --no-color
```

`triplog ui`도 같은 화면을 실행합니다. 인자 없이 `triplog`를 실행하면 실제 터미널에서 메뉴가 열리고, 파이프·자동화 환경에서는 도움말을 반환합니다. UI 명령은 실제 TTY 입출력이 필요하며 `--json`과 함께 사용할 수 없습니다.

처음 실행하면 **클라우드 로그인 / 백업 JSON 열기 / 새 여행 파일 만들기 / 예시로 둘러보기**를 고릅니다. 클라우드는 기존 TripLOG 이메일·비밀번호 로그인과 권한을 사용합니다. 여행은 이름으로 선택하므로 ID를 입력하지 않아도 됩니다. 초대 링크 참여는 시작 화면이나 연결 설정에서 선택할 수 있습니다. 최근 연결·선택한 여행은 CLI 설정 폴더의 `terminal.json`에 보관하며, 체험 모드는 최근 연결을 덮어쓰지 않습니다.

| 메뉴 | 주요 작업 |
| --- | --- |
| 1 여행 개요 | 여행 선택·추가·수정·보관·복원, 공유·멤버 관리 |
| 2 일정 | 추가·수정·삭제, 순서 이동, 완료·잠금, 티켓 첨부 |
| 3 지출 | 추가·수정·삭제, 원화·외화 환산, 합계 |
| 4 예약 | 숙소·교통·입장권 등록, 원본 항목 수정, 일정 연결 |
| 5 준비물 | 추가·수정·삭제·체크·순서 이동 |
| 6 동행인·정산 | 동행인 관리, 정산 미리보기·확정, 분담 설정 JSON |
| 7 메모·댓글 | 공동 메모 읽기·쓰기, 댓글 추가·삭제 |
| 8 백업·리포트 | JSON 백업·복원, PDF·CSV·ICS·HTML, 이력·요청 재시도 |
| 9 개발 도구 | 환경 진단, 미리보기, 테스트, 빌드, 배포 계획·실행·상태 |
| 0 연결 설정 | 로그인·로그아웃, 프로필·JSON 연결, 초대 참여, 도움말 |

| 키 | 동작 |
| --- | --- |
| ↑ / ↓, Enter | 항목 이동·선택 |
| Tab | 메뉴·본문 전환; 입력 중에는 다음 필드 |
| Shift+Tab | 입력 중 이전 필드 |
| Esc | 이전 화면·입력 취소; 읽기 작업 취소 |
| A / S / D / R | 여행 선택 / 일정 추가 / 지출 추가 / 새로고침 |
| 1~9, 0 | 메뉴 바로가기 |
| / | 목록 이름 검색 |
| Ctrl+S 또는 F10 | 입력 검증 후 실행 전 확인 |
| ← / → | 선택형 필드 변경·문자 커서 이동·확인 버튼 선택 |
| Ctrl+J / Ctrl+U | 줄바꿈 / 현재 필드 지우기 |
| PgUp / PgDn | 긴 확인 내용·결과·로그 스크롤 |
| Q / Ctrl+C | 종료; 개발 작업 실행 중 Ctrl+C는 해당 작업 중단 |

입력 중 `Q`, `S`, 숫자 등은 그대로 문자로 들어갑니다. 비밀번호는 가려서 표시하며 명령 인자로 전달하거나 설정 파일에 저장하지 않습니다. 붙여넣기는 지원 터미널의 bracketed paste를 구분해 데이터로만 처리합니다. 한글·이모지 단위의 커서 이동과 삭제를 지원하고, 종료할 때 커서·줄바꿈·원래 화면·입력 모드를 복구합니다.

저장 전에는 실제 변경 항목을 확인하며 기본 선택은 **돌아가서 수정**입니다. 파일 모드에서는 확인 후 선택한 JSON 원본을 원자적으로 갱신합니다. 명령형 CLI의 `--in-place`에 해당하는 동작입니다. 입력·확인 이후 다른 프로그램이나 동행인이 같은 내용을 변경하면 파일 해시·서버 버전으로 충돌을 확인합니다. 서버의 미전송·비공개 데이터 범위는 아래 CLI 규칙과 같습니다.

`--demo`는 실행마다 별도 예시 여행 파일을 `artifacts/tmp/<실행 묶음>/terminal-demo/`에 생성합니다. 예시에서 저장한 내용은 그 파일에만 남습니다. 백업·리포트의 기본 출력은 `artifacts/tmp/<실행 묶음>/terminal-exports/`이며 입력창에서 원하는 보관 경로로 바꿀 수 있습니다. `--demo`와 실제 여행 연결 옵션은 함께 지정할 수 없습니다.

화면은 120열 × 38행을 기준으로 구성했습니다. 80열에서는 압축된 2개 패널, 60열에서는 현재 패널 하나를 표시합니다. 최소 60열 × 20행보다 작아지면 창 확대 안내를 표시하고 작성 중인 값은 유지합니다. 터미널의 고정폭 글꼴을 사용하세요. 색상은 `--no-color` 또는 `NO_COLOR` 환경변수로 끌 수 있습니다. 스크린 리더·단순 터미널은 `--plain` 번호 메뉴를 사용하며 `TERM=dumb`에서도 이 모드가 자동 적용됩니다. 번호 메뉴에서 `m`은 전체 메뉴, `b`는 이전, `q`는 종료, 입력 중 `:back`은 취소입니다. 번호 메뉴의 비밀번호 입력은 제공하지 않으므로 기본 TUI 또는 `triplog auth login`에서 먼저 로그인합니다.

개발 명령은 이 저장소에서 실행하고 로그를 화면에 표시합니다. 미리보기·테스트 실행 중 `Esc` 또는 `Ctrl+C`로 시작한 하위 프로세스 트리를 중단합니다. 배포 메뉴도 파일 목록과 커밋 메시지를 확인한 뒤 기존 CLI의 검증·커밋·푸시 절차를 실행합니다. 배포 완료 여부는 별도 운영 상태 확인 결과를 따릅니다.

구현은 `cli/tui/`, 생성 목업·프롬프트는 `artifacts/design/20261018-terminal/`, 대표 검증 화면은 `artifacts/qa/20261018-terminal/`에 있습니다. `npm run test:terminal`은 데이터 흐름과 입력·복구를 검사하고, `npm run test:terminal:visual`은 같은 ANSI 출력을 xterm으로 렌더링합니다. xterm 패키지는 검증용 개발 의존성이며 실제 TUI는 Node 내장 모듈로 동작합니다.

## 로그인과 연결

```powershell
triplog auth login --email me@example.com
triplog auth status
triplog auth logout
triplog config show
```

비밀번호는 터미널에서 숨김 입력합니다. Windows 로그인 세션은 현재 Windows 사용자에게 묶인 DPAPI로 암호화해 `%LOCALAPPDATA%\TripLOG\cli\sessions`에 저장합니다. 프로젝트 파일이나 Git에 인증 토큰을 저장하지 않습니다. 로그아웃은 이 CLI 세션을 대상으로 하며 웹앱 전체 세션을 로그아웃시키지 않습니다. 서버 세션 폐기 여부는 `remoteSessionRevoked`로 구분합니다.

자동화나 Windows 이외의 환경에서는 비밀 저장소가 제공하는 사용자 액세스 토큰을 `TRIPLOG_ACCESS_TOKEN` 환경변수로 전달합니다. 환경변수 인증은 세션 파일을 만들지 않으며 토큰 갱신은 호출자가 담당합니다. 토큰을 명령 인자나 문서에 입력하지 마세요. 현재 영구 로그인 저장은 Windows를 지원합니다.

환경변수 토큰 모드에서는 `auth login/logout` 대신 호출 환경의 토큰을 설정·해제합니다. CLI가 상위 셸의 환경변수를 지우거나 외부 토큰을 폐기했다고 표시하지 않습니다.

기본 연결은 웹앱의 `src/app/data/service-config.js`와 공유합니다. 별도 프로젝트는 프로필을 사용합니다.

```powershell
triplog config set --profile staging --url https://YOUR_PROJECT.supabase.co --key sb_publishable_YOUR_KEY
triplog auth login --profile staging
triplog trip list --profile staging
```

`--profile` 기본값은 `default`입니다. `TRIPLOG_URL`, `TRIPLOG_PUBLISHABLE_KEY`는 실행 시 설정을 덮어씁니다. 공개용 publishable/anon 키만 받으며 service-role 키는 받지 않습니다. 세션과 변경 기록은 프로젝트·계정 경계를 확인합니다. 테스트 및 격리 실행에서는 `TRIPLOG_CLI_HOME`으로 설정 디렉터리를 분리할 수 있습니다.

## 데이터 원본과 저장

| 모드 | 선택 | 조회 범위와 저장 방식 |
| --- | --- | --- |
| 서버 | 기본값 또는 `--source cloud` | 로그인한 사용자가 접근 가능한 서버 데이터. 서버 확인 후 저장 성공을 출력 |
| 파일 | `--source file --store backup.json` 또는 `--store backup.json` | 앱 백업·단일 여행 JSON. 새 파일 저장 또는 명시적 원본 변경 |

서버 모드는 브라우저 IndexedDB에 직접 접근하지 않습니다. 미전송 변경, 기기 초안, 공유하지 않는 일정·지출은 앱에서 JSON을 내보내 파일 모드로 다룰 수 있습니다. 서버 내보내기는 `scope: cloud-synchronized`, `localOnlyDataIncluded: false`로 표시합니다.

기존 파일을 수정할 때는 `--out new.json` 또는 `--in-place`가 필요합니다. `--out`의 파일이 이미 있으면 `--overwrite`를 추가해야 합니다. 같은 입력 파일을 `--out`으로 지정해 원본 변경을 우회할 수 없습니다. 쓰기는 임시 파일과 원자적 교체, 잠금, 읽은 파일의 해시 비교를 사용합니다. 파일에 저장했다고 서버 동기화가 완료된 것은 아닙니다.

```powershell
triplog trip list --store backup.json
triplog expense add --store backup.json --trip TRIP_ID --date 2026-11-07 --category 식비 --description 점심 --amount 18000 --out updated.json
triplog packing check --store updated.json --trip TRIP_ID --id PACKING_ID --in-place
```

항목 추가·수정·삭제, 보관·복원 등 데이터 변경은 `--dry-run`으로 전송할 변경을 먼저 확인할 수 있습니다. 읽기·내보내기 명령에 `--dry-run`을 붙이면 잘못된 옵션으로 거부합니다. 대화형 확인창 없이 명령에 지정한 작업을 실행합니다.

## 여행과 항목

```powershell
triplog trip list
triplog trip list --query 순천 --json
triplog trip show --trip TRIP_ID
triplog trip create --name "순천 여행" --start 2026-11-07 --end 2026-11-09 --city 순천
triplog trip update --trip TRIP_ID --name "가족 순천 여행"
triplog trip archive --trip TRIP_ID
triplog trip list --archived
triplog trip restore --trip TRIP_ID
```

목록에는 서버 ID인 `id`와 앱 내부 ID인 `appTripId`를 함께 표시합니다. `--trip`에는 둘 중 하나를 사용할 수 있으며 여행 이름으로 수정 대상을 추정하지 않습니다. 항목에는 `--id`를 사용합니다. 보관은 서버의 archive 기능이며 영구 삭제가 아닙니다.

| 영역 | 명령 | 주요 입력 |
| --- | --- | --- |
| 일정 | `itinerary list/show/add/update/remove/move/complete/lock` | `--date`, `--time`, `--end-time`, `--place`, `--location`, `--memo`, `--trans`, `--duration`, `--cost`, `--sync-expense true` |
| 지출 | `expense list/show/add/update/remove/summary` | `--date`, `--category`, `--description`, `--amount`, `--payer`, `--payment-method card\|cash` |
| 준비물 | `packing list/show/add/update/remove/move/check` | `--name`, `--checked true\|false` |
| 동행인 | `companion list/show/add/update/remove` | `--name`, `--individual-spent` |
| 예약 | `reservation list/show/add/update/remove/link` | `--type transport\|stay\|activity\|other`, `--title`, `--date`, `--end-date`, `--reference` |

조회는 `--query`로 검색하고 일정·지출·예약 목록은 `--date`로 필터링할 수 있습니다. 준비물 `check`, 일정 `complete/lock`은 `--unchecked`로 해제합니다. `move --id ITEM_ID --target OTHER_ID --placement before|after`는 순서를 바꿉니다. 일정 이동은 같은 날짜 안에서 지원하며 시간을 바꾸지 않습니다.

일정의 `--cost`, `--duration`은 원화 비용과 분 단위 이동 시간입니다. `--sync-expense true`로 연결한 교통 지출은 일정 변경·삭제와 함께 한 서버 요청에 포함됩니다. 연결 지출의 금액·날짜는 `itinerary update`로 수정합니다. 독립 지출을 삭제하면 해당 일정의 지출 연결을 해제합니다.

결제자는 `leader` 또는 `companion:동행인ID`입니다. 지출이나 직접 입력 분담금이 남은 동행인을 지우려면 먼저 결제자·분담금을 옮깁니다. 사전구매 일자는 `__pretrip__`입니다.

```powershell
triplog expense add --trip TRIP_ID --date 2026-11-07 --category 식비 --description 라멘 --mode overseas --currency JPY --foreign-amount 1200 --exchange-rate 950 --exchange-base 100
```

외화 환산은 `외화 금액 × 환율 ÷ 기준 단위`를 반올림한 원화 정수입니다. 원화 금액까지 입력하면 환산 값과의 일치를 확인합니다. 현재 웹앱 입력·서버 명령·정산 규약에 맞춰 신규 음수 지출은 거부합니다. 기존 파일에 있는 음수 환불은 목록·리포트와 파일 백업 복원에서 보존합니다. 환불이 포함된 정산 확정은 현재 서버 정산 모델의 제한을 따릅니다.

예약 목록의 `manual:`은 직접 등록한 예약, `entry:`는 지출에서 파생된 예약, `plan:`은 일정에서 파생된 예약입니다. 직접 등록한 예약은 원래 ID 또는 `manual:ID`로 수정합니다. 파생 예약 수정은 원본 지출·일정 명령을 사용합니다. `reservation link --id entry:EXPENSE_ID`도 지원합니다. 숙소 예약은 숙박 날짜마다 일정을 만들고, 같은 예약을 다시 저장할 때 기존 일정 ID와 날짜별 수정 내용을 보존합니다.

복잡한 이동 구간, 호텔·항공권 정보, 영수증 메타데이터, 분담 설정은 JSON으로 입력합니다.

```powershell
triplog schema itinerary
triplog itinerary update --trip TRIP_ID --id ITEM_ID --file itinerary-input.json --dry-run
Get-Content -Raw expense-input.json | triplog expense add --trip TRIP_ID --file -
```

`--file`의 JSON은 수정할 필드만 담습니다. `id`, 서버 권한, 생성 시각, 내부 연결 ID는 직접 수정하지 않습니다. 잘못된 옵션, 지원하지 않는 필드, 잘못된 날짜·금액은 저장 전에 거부합니다.

## 정산과 내보내기

```powershell
triplog settlement preview --trip TRIP_ID
triplog settlement show --trip TRIP_ID
triplog settlement update --trip TRIP_ID --file settlement-input.json
triplog settlement finalize --trip TRIP_ID
triplog report export --trip TRIP_ID --format pdf --out report.pdf
triplog report export --trip TRIP_ID --format csv --out expenses.csv
triplog report export --trip TRIP_ID --type itinerary --format csv --out itinerary.csv
triplog report export --trip TRIP_ID --format ics --timezone Asia/Seoul --out itinerary.ics
```

정산은 기존 서버 계산 모델을 사용합니다. 서버 확정에는 미리보기의 source hash와 고유 요청 ID를 전달해 중간 변경을 검사합니다. 파일 모드 확정은 파일의 `cliSettlements`에 기록합니다. 세부 분담은 `itemSplits`의 `current:지출ID`를 키로 `{"mode":"custom","shares":{"leader":9000,"companion:ID":9000}}` 형태로 설정하며 합계가 해당 지출과 같아야 합니다.

리포트 형식은 `json`, `csv`, `html`, `pdf`, `ics`입니다. `--type full|expense|itinerary`와 `--date YYYY-MM-DD`를 사용할 수 있습니다. 기본 CSV는 지출 목록이고 `--type itinerary`는 일정 목록입니다. HTML/PDF는 기존 포켓노트 모델에 전체 지출 표를 포함합니다. PDF 생성은 설치된 Edge(Windows) 또는 Playwright Chromium을 사용합니다. 외부 요청 없이 저장된 데이터와 앱의 한글 글꼴로 렌더링합니다.

## 백업과 변경 이력

```powershell
triplog backup export --out backup.json
triplog backup export --trip TRIP_ID --out one-trip.json
triplog backup import --file backup.json --dry-run
triplog backup import --file backup.json
triplog history list --trip TRIP_ID
triplog history restore --trip TRIP_ID --sequence 12
```

가져오기는 새 여행 ID를 발급합니다. 기존 여행 전체를 덮어쓰지 않습니다. 서버 백업은 공동 메모·댓글과 내려받을 수 있는 첨부파일 원본을 포함합니다. 첨부파일을 가져오지 못하면 `missingAttachments`로 표시하며 그런 파일의 서버 복원은 원본 보완을 요구합니다.

서버로 가져올 때 계정·멤버·초대 권한과 이전 미전송 큐를 재생하지 않습니다. 기기 초안·이전 복구 큐·보관 이력은 원본 백업에 남습니다. 파일 모드 가져오기는 이력과 `importedRecovery`도 보존합니다. 비공개 데이터를 공유 상태로 바꾸어 업로드하지 않으며 해당 데이터는 파일 모드에서 복원합니다. 여러 여행 중 일부만 생성된 뒤 실패하면 오류의 `importedTrips`와 요청 ID를 확인합니다. 전체 가져오기를 다시 실행하면 새 여행이 추가됩니다.

서버 변경 이력 복원은 기존 `restore-change` API의 최신 상태 검사를 사용합니다. 파일 모드에서는 최근 CLI 변경 100건을 기록하며 `history restore --id HISTORY_ID`로 현재 상태와 일치하는 변경부터 복원합니다.

## 공동 편집과 첨부파일

```powershell
triplog member list --trip TRIP_ID
triplog member set --trip TRIP_ID --user USER_ID --role viewer
triplog invite create --trip TRIP_ID --role editor
triplog invite resolve --token INVITE_TOKEN
triplog invite accept --token INVITE_TOKEN
triplog invite revoke --trip TRIP_ID --id INVITE_ID
triplog note show --trip TRIP_ID
triplog note append --trip TRIP_ID --text "예약 시간을 확인했습니다."
triplog note set --trip TRIP_ID --file note.txt
triplog comment add --trip TRIP_ID --target ITEM_ID --text "이 일정에서 만나요."
triplog attachment upload --trip TRIP_ID --id ITEM_ID --file ticket.pdf
triplog attachment download --trip TRIP_ID --id ITEM_ID --out ticket-copy.pdf
```

공동 메모는 기존 Yjs 문서에 변경을 추가합니다. 첨부파일은 일정에 연결하며 PDF·PNG·JPEG·GIF·WebP, 최대 1.5 MiB입니다. 업로드와 일정 연결은 별도 서버 단계이므로 실패 시 요청 기록으로 어느 단계까지 완료됐는지 확인합니다. 초대 토큰은 URL을 가진 사람의 접근에 쓰이므로 로그 공유 범위를 확인하세요.

여행 공유 설정은 `trip privacy --trip TRIP_ID`로 조회하고 `--file privacy.json`으로 변경합니다. JSON에는 변경할 `shareItinerary`, `shareExpenses`, `showMemberEmail`, `allowInviteRequests` boolean 필드만 넣습니다. 소유권 이전은 `trip transfer --user USER_ID`, 멤버 탈퇴는 `trip leave`, 표시 이름은 `member profile --name`을 사용합니다.

## 충돌과 재시도

```powershell
triplog operation list
triplog operation show --id OPERATION_ID
triplog operation retry --id OPERATION_ID
```

서버 변경 전에 요청 내용과 ID를 사용자 설정 영역의 `operations`에 기록합니다. 응답을 받지 못하면 `REQUEST_UNCERTAIN`과 요청 ID를 반환합니다. 재시도 가능한 요청만 동일한 ID·내용으로 재전송하며 이미 반영된 요청은 다시 적용하지 않습니다. 초대 생성 등 중복 방지가 없는 제어 명령은 무조건 재전송하지 않습니다.

필드 충돌은 `CONFLICT`와 현재 서버 값을 포함한 상세 정보로 반환합니다. 요청 ID를 재사용해 다른 내용을 보내거나 자동으로 최신 값을 덮어쓰지 않습니다. 최신 여행을 읽고 의도한 변경을 새 명령으로 실행합니다. 요청 기록에는 여행 내용이 포함되므로 Git에 추가하지 않습니다.

| 종료 코드 | 의미 |
| --- | --- |
| 0 | 성공 또는 변경 없음 |
| 2 | 명령·입력 검증 오류 |
| 3 | 여행·항목·파일 없음 |
| 4 | 인증 또는 권한 오류 |
| 5 | 수정 충돌, 파일 변경, 배포 범위 충돌 |
| 6 | 통신 실패 또는 서버 반영 결과 불명확 |
| 8 | 해당 환경·원본에서 지원하지 않는 기능 |
| 그 외 | 내부 오류 또는 하위 개발 명령의 종료 코드 |

## 개발과 배포

```powershell
triplog dev doctor
triplog dev serve --port 18080
triplog dev test --suite source
triplog dev test --suite cli
triplog dev test --suite sync
triplog dev test --suite browser
triplog dev test --suite edge
triplog dev build
triplog dev artifacts
```

`dev serve`는 로컬 미리보기이며 Ctrl+C로 종료합니다. 테스트·빌드는 `package.json`의 기존 명령을 실행하고 종료 코드를 전달합니다. Edge Function 검사는 Deno가 필요합니다. 테스트 출력은 `scripts/helpers/artifact-output.js`와 `TRIPLOG_ARTIFACT_RUN`을 사용합니다.

```powershell
triplog dev deploy plan --files cli/index.js --files README.md
triplog dev deploy run --files cli/index.js --files README.md --message "Add TripLOG CLI"
triplog dev deploy status
```

배포는 `origin = LOG-JJ/TripLOG`, `main` 브랜치를 확인한 뒤 Git 커밋·푸시로 연결된 자동 배포를 시작합니다. 파일은 `--files`를 반복해 명시합니다. 선택하지 않은 변경, 관련 없는 staged 파일, 기존 미푸시 커밋이 있으면 먼저 정리하도록 중단합니다. 원격은 fetch 후 fast-forward로 반영하며 분기된 이력을 자동 재작성하지 않습니다.

전체 단위·CLI 검사, 브라우저 검사, 서버 파일 변경 시 Edge 검사를 통과한 뒤 빌드합니다. 빌드가 만든 `Travel.html`, `sw.js`, 공용 모델 등도 포함합니다. 작업 중 새로 생긴 범위 밖 변경은 자동 커밋하지 않습니다. push 성공과 자동 배포 완료를 분리하며 운영 HTML과 서비스 워커의 빌드 지문이 커밋의 지문과 맞아야 `automaticDeployment: verified`로 표시합니다. 배포가 진행 중이거나 확인할 수 없으면 `unverified`입니다.

이 명령은 Supabase DB 마이그레이션이나 Edge Function 자체를 배포하지 않습니다. 해당 운영 반영은 별도 작업으로 수행합니다.
