# 일정 계획 화면

선택한 목업 1안을 기본 타임라인, 2안을 일정 추가·수정 창으로 연결했습니다.
흰 바탕, 검은 외곽선, 노란 선택 상태와 주요 버튼, 하늘색 보조 버튼을 두 테마에 동일하게 적용합니다.

- `src/styles/itinerary.css`: 일정 화면의 색상, 글꼴, 간격, 모바일·데스크톱 레이아웃.
- `src/app/features/itinerary/itinerary-render.js`: 날짜 선택, 타임라인, 접을 수 있는 이동 정보.
- `src/app/features/itinerary/itinerary-workspace.js`: 지도 편집 창, 메뉴, 초점 복원, 지도 위치 선택.
- `src/app/features/itinerary/itinerary-form.js`: 기존 일정 데이터와 지출 연결을 유지하는 저장 경로.

모바일에서는 지도와 입력 패널을 위아래로, 700px 이상에서는 나란히 표시합니다.
저장 버튼은 편집 창 하단에 따로 배치해 입력 항목을 가리지 않게 했습니다.
지도 핀 선택은 입력 중인 장소만 바꾸며 새 일정 추가를 기존 일정 수정으로 전환하지 않습니다.
여행 변경이나 편집 창 닫기 시 진행 중인 검색 결과를 폐기합니다.
동선 확인 중 기존 좌표를 다시 사용할 때는 출처와 정확도 정보를 보존해 새로고침 후 좌표가 사라지지 않게 했습니다.
이 동작은 `node tests/coordinate-cache-regression.js`로 검증합니다.

실제 지도의 장소·도로는 OpenStreetMap을 사용합니다. 목업의 사진 자리는 확인된 좌표의 지도 썸네일로 표시하며,
실제 사진이 없는 장소에 임의의 사진을 붙이지 않습니다. 지도 앱의 길찾기 링크와 기존 경로 계산을 유지합니다.
지도는 현재 화면에 필요한 타일만 요청하며 출처 표시와 브라우저 캐시를 유지합니다.
[OpenStreetMap 타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/)

아이콘은 로컬에 포함한 Phosphor 2.1.1, 글꼴은 기존 Pretendard를 사용합니다.
로고는 선택한 목업을 기준으로 만든 이미지 자산입니다.

구현 및 회귀 검증 기록은 프로젝트 루트의 `../design-qa.md`에 남깁니다.
