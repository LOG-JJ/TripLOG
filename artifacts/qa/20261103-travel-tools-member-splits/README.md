# 선택한 여행 도구·멤버 분담·개요 배치 구현

2026-11-03. 선택 목업: [7개 도구와 상세 4장](../../design/20261103-travel-tools-selected-seven/README.md).

## 구현 결과

- 준비물 / 여행지 시간대 / 캘린더 파일 / 일출·일몰 / 한국↔현지 시간 / Wi-Fi QR / 단위 변환으로 메인과 상세 구현.
- 기존 여행 컨텍스트, 대화상자, `ex-button`, 드롭다운, 날짜·시간 입력, 준비물 저장 경로 재사용. 사진·추가 아이콘 상자·별도 외부 서비스 없음.
- 계산·표현·화면 제어를 `tools-model.js`, `tools-view.js`, `tools-workspace.js`로 분리. 태양·QR 라이브러리는 처음 필요한 상세를 열 때만 실행하는 로컬 번들 사용. Wi-Fi 정보는 창이 닫히면 제거.
- 일출·일몰은 내장 도시 중심 또는 기존 여행의 저장 좌표로 계산. 목업 예시 수치를 하드코딩하지 않음. 메인에는 도시 요약을 표시하고 실제 수치·그래프는 상세에서 계산.
- 보기 전용 역할을 포함한 모든 참여 멤버의 항목별 분담 편집 허용. 분담 전용 공통 저장은 원본 지출·결제자·여행 메타데이터를 유지. 계정 전환·원본 변경·금액 불일치·다른 멤버 쓰기와 충돌은 기존 저장 계약으로 확인.
- 멤버가 아닌 계정, 보기 전용 멤버의 일반 지출/설정 변경, 비공개 지출 쓰기를 허용하지 않음. 서버 함수의 멤버 확인은 유지.
- 개요 지출 구성: 3개=[3], 4개=[2,2], 5개=[3,2], 6개=[3,3]. 이름과 비율을 같은 행에 유지.

## 검증

Browser plugin not available. 저장소의 Playwright·Edge 격리 fixture 사용. 운영 여행/브라우저 저장소는 사용하지 않음.

| 실행 | 결과 |
| --- | --- |
| `node bin/triplog.js dev test --suite source --json` | 종료 코드 0, `ok: true` |
| `node tests/travel-tools-regression.js` | 날짜 넘김, DST 중복·결손, 30분 시차, 일출·일몰/극야·백야, 단위, Wi-Fi 이스케이프·길이·UTF-8 QR 통과 |
| `node tests/member-splits-regression.js` | 로컬 viewer 분담 저장, 계정 전환 거부, 격리 PostgreSQL 마이그레이션·저장·동일 요청 재시도·외부 계정/비공개 지출 거부 통과 |
| `node tests/sync-client-regression.js` | 동기화/오프라인/계정 전환/충돌 회귀 통과 |
| `node tests/travel-tools-browser-regression.js` | 7개 상세, 준비물/시간대 저장, 날짜 선택 ICS, QR 생성과 닫기 초기화, 단위/시간 변환, viewer 지출창 분담 저장, 개요 3~6개 배치 통과 |
| `node tests/settlement-ledger-browser-regression.js` | 공통 표 분담 저장·취소·실패·중복 방지·오래된 원본/멤버 검사·마이그레이션 회귀 통과 |
| `node bin/triplog.js dev build --json` | 종료 코드 0, `ok: true` |

도구 화면 320/390/1440px에서 가로 넘침 확인. 정산 기존 회귀는 320/390/760/851/1440px 포함. 최종 태양 SVG 높이 145px와 비밀번호 없는 QR 상태를 별도 짧은 렌더링 확인으로 검증. 페이지 오류 없음. 관련 검증을 선택했고 전체 테스트/브라우저 묶음을 반복 실행하지 않음.

## 대표 캡처

- [모바일 메인](tools-390.png), [PC 메인](tools-1440.png)
- [일출·일몰](sun-390.png), [Wi-Fi QR](wifi-390.png)
- [4개 항목 2×2](cost-4-390.png), [5개 항목 3+2](cost-5-390.png)
- [브라우저 결과](browser-verification.json)

## 반영 상태

로컬 구현·빌드 완료. Git 커밋·푸시·운영 배포·운영 여행 데이터 변경은 수행하지 않음. 운영의 보기 전용 멤버 분담 저장에는 `supabase/migrations/20261103090000_member_expense_splits.sql` 적용이 필요하며, 이 작업에서는 격리 DB에만 적용·검증함.

사용한 계산/인코딩 라이브러리의 원본: [SunCalc](https://github.com/mourner/suncalc), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator). Wi-Fi 데이터 형식은 [ZXing의 Wi-Fi payload 정의](https://github.com/zxing/zxing/wiki/Barcode-Contents#wi-fi-network-config-android-ios-11) 기준.
