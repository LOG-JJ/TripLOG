# 하단 여행 아이콘의 실제 그림 정렬 수정

2026-11-01 · Asia/Seoul

사용자가 [실제 캡처](user-reference.png)로 여행 아이콘만 위로 올라가 보인다고 재지적했다. 직전 수정은 선택 배경과 밑줄 예외를 제거했고, 검증은 같은 DOM 칸 크기를 확인하는 데 그쳤다. 이 기록은 실제 glyph 영역의 크기 차이를 추가로 확인하고 보정한 후속 결과다.

## 원인과 수정

- 제공 캡처의 캐리어 그림은 y26~60, 높이 35px였다. 집은 y29~57 / 29px, 달력은 y28~57 / 30px였다. 다섯 레이블은 모두 y70~85로 같았다. 원본 이미지 픽셀 기준이며 사용자 화면의 CSS 배율을 추정해 적용한 값이 아니다. [측정](../../tmp/20261101-nav-optical-alignment/reference-paint-bounds.json).
- 기존 Phosphor 캐리어 glyph는 em 전체를 쓰고, 집·달력은 내부 여백이 있다. 모두 font-size 24px / 24×24px 칸이어도 실제 그림 높이는 캐리어 24 CSS px, 집·달력 20 CSS px의 font metric이었다. DOM 사각형 비교만으로는 차이를 검출할 수 없었다.
- 공통 24×24px 아이콘 칸 안에서 캐리어를 20px로 표시하고 grid 중앙 배치했다. 버튼·레이블·선택 배경·밑줄의 공통 배치는 바꾸지 않았다. 새 아이콘·라이브러리·화면 디자인은 추가하지 않았다.

## 실제 렌더링 검증

[수정 전/후 2배 확대 비교](alignment-comparison.png), [수정 후 선택 상태](after-390-1.png), [비선택 상태](inactive-travel-390.png).

같은 fixture·폰트·상태에서 캡처한 실제 이미지의 어두운 픽셀 영역을 측정했다. 판정은 max(R,G,B)<180이며 아이콘/레이블의 실제 위치 주변만 검사해 배경·밑줄을 제외했다. [픽셀 측정값](../../tmp/20261101-nav-optical-alignment/relocated-20261104/paint-bounds.json), [수정 전 DOM/font metric](../../tmp/20261101-nav-optical-alignment/relocated-20261104/before.json), [수정 후 DOM/font metric](../../tmp/20261101-nav-optical-alignment/relocated-20261104/after.json).

| 조건 | 수정 전 캐리어 그림 | 수정 후 캐리어 그림 | 비교 대상 |
| --- | --- | --- | --- |
| 390px, DPR 1 | 상단 10px, 하단 34px, 높이 24px | 상단 13px, 하단 32px, 높이 19px | 집·달력 모두 상단 13px, 하단 32px, 높이 19px |
| 1440px, DPR 1.5 | 상단 10.67px, 높이 23.33px | 상단 13.33px, 높이 19.33px | 집 상단 13.33px, 높이 18.67px; 달력 상단 12px, 높이 20px |

표의 위치는 하단바 캡처 안의 CSS 좌표로 정규화했다. DPR 1.5의 래스터 경계에는 안티앨리어싱 차이가 있으나 캐리어가 위로 돌출되는 현상은 사라졌다. 집 대비 캐리어 상단 차이 0.75 CSS px 이하, 캐리어 높이가 다른 아이콘 최대 높이+0.75px 이하, 다섯 레이블 하단 차이 0.75px 이하를 실제 픽셀 검사로 통과했다. 글자의 DOM 위치와 실제 하단은 수정 전/후 동일하다.

## 회귀 검사와 빌드

- `trip-navigation-browser-regression.js`에 Canvas `measureText`의 actualBoundingBoxAscent/Descent 기반 glyph 높이 검사를 추가했다. DOM 칸이 같아도 캐리어가 더 큰 원래 상태를 이 검사가 검출한다.
- 해당 브라우저 회귀 통과: 320/390/844/1280px, 하단 5개 메뉴, 아이콘 칸/글자 행/중앙 위치/실제 glyph 높이, 선택 배경·밑줄, 직접 진입·Back/Forward·리포트 탭/PDF·미저장 일정 보존·여행 탭·영수증/정산을 확인했다. [실행 결과](verification.json).
- `dev test --suite source --json`, `dev build --json` 및 수정 파일의 `git diff --check` 통과. 실제 브라우저 오류/예상하지 못한 콘솔 오류는 없다.

Edge/Playwright의 독립 예시 여행으로 검증했다. 사용자 브라우저 저장소나 운영 데이터를 변경하지 않았으며, 로컬 소스와 빌드에만 반영했다. 운영 배포는 수행하지 않았다. 원본·보존본 SHA256은 [capture-provenance.json](capture-provenance.json)에 기록했다.
