# 삭제 UI 최종 생성 프롬프트

생성 방식: T2I. 입력 이미지: 없음. 기존 목업이나 스크린샷을 입력으로 사용하지 않습니다. 각 보드의 모든 상태가 구현 대상이며, 원본은 반환 경로와 SHA256으로 확인합니다.

## 01-records — 일정·지출·예약

```text
Design a compact Korean deletion-confirmation UI mockup board for the existing TripLOG travel planner. Show four separate state mockups in a 2 by 2 layout, each at a 390px mobile viewport scale. Each state has a small centered white dialog about 342px wide and only as tall as its content, over a lightly dimmed travel-app background. Preserve the app's plain white surface, dark ink outline, restrained offset shadow, rounded corners and Pretendard-like Korean sans-serif type. Use a left-aligned 18px bold question, a 14px target name when supplied, and a short 14px gray consequence when supplied. Keep the buttons side by side at 44px tall: neutral white '취소' on the left, muted red with white text for the action on the right. The content and buttons stay close together with 20px padding. Each of the following four states must have its own complete distinct dialog. Render the supplied Korean text.

State 1: question "일정을 삭제할까요?"; target "오사카성 산책"; action "삭제".
State 2: question "일정을 삭제할까요?"; target "공항에서 숙소로"; consequence "연결된 지출도 함께 삭제돼요."; action "삭제".
State 3: question "지출을 삭제할까요?"; target "저녁 식사 · 38,000원"; consequence "연결된 일정은 유지돼요."; action "삭제".
State 4: question "예약을 삭제할까요?"; target "난바 호텔 · 2박"; consequence "연결된 일정과 지출은 유지돼요."; action "삭제".
```

## 02-trips-history — 여행·저장 기록·초안

```text
Design a compact Korean deletion-confirmation UI mockup board for the existing TripLOG travel planner. Show four separate state mockups in a 2 by 2 layout, each at a 390px mobile viewport scale. Each state has a small centered white dialog about 342px wide and only as tall as its content, over a lightly dimmed travel-app background. Preserve the app's plain white surface, dark ink outline, restrained offset shadow, rounded corners and Pretendard-like Korean sans-serif type. Use a left-aligned 18px bold question, a 14px target name when supplied, and a short 14px gray consequence when supplied. Keep the buttons side by side at 44px tall: neutral white '취소' on the left, muted red with white text for the action on the right. The content and buttons stay close together with 20px padding. Each of the following four states must have its own complete distinct dialog. Render the supplied Korean text.

State 1: question "여행을 삭제할까요?"; target "오사카·교토 여행"; consequence "이 기기의 목록에서만 삭제돼요.
복구 기록에서 다시 열 수 있어요."; action "삭제".
State 2: question "공유 여행을 보관할까요?"; target "가족 제주 여행"; consequence "모든 멤버가 읽기 전용으로 바뀌어요.
복구 기록에서 다시 열 수 있어요."; action "보관".
State 3: question "저장 기록을 삭제할까요?"; target "오사카·교토 여행 · 10.17 저장"; consequence "현재 여행은 유지돼요."; action "삭제".
State 4: question "초안을 삭제할까요?"; target "작성 중인 일정"; consequence "아직 저장하지 않은 내용이 지워져요."; action "삭제".
```

## 03-packing-people — 준비물·댓글·정산 멤버

```text
Design a compact Korean deletion-confirmation UI mockup board for the existing TripLOG travel planner. Show four separate state mockups in a 2 by 2 layout, each at a 390px mobile viewport scale. Each state has a small centered white dialog about 342px wide and only as tall as its content, over a lightly dimmed travel-app background. Preserve the app's plain white surface, dark ink outline, restrained offset shadow, rounded corners and Pretendard-like Korean sans-serif type. Use a left-aligned 18px bold question, a 14px target name when supplied, and a short 14px gray consequence when supplied. Keep the buttons side by side at 44px tall: neutral white '취소' on the left, muted red with white text for the action on the right. The content and buttons stay close together with 20px padding. Each of the following four states must have its own complete distinct dialog. Render the supplied Korean text.

State 1: question "준비물을 삭제할까요?"; target "여권"; action "삭제".
State 2: question "기본 목록으로 바꿀까요?"; consequence "추가한 준비물과 체크 상태가 사라져요."; action "초기화".
State 3: question "댓글을 삭제할까요?"; target "내일 9시에 로비에서 만나요."; consequence "동행에게도 삭제돼요."; action "삭제".
State 4: question "정산 멤버를 삭제할까요?"; target "민수"; consequence "추가 지출과 분담 설정도 삭제돼요."; action "삭제".
```

## 04-sharing-settings — 공유·설정

```text
Design a compact Korean deletion-confirmation UI mockup board for the existing TripLOG travel planner. Show four separate state mockups in a 2 by 2 layout, each at a 390px mobile viewport scale. Each state has a small centered white dialog about 342px wide and only as tall as its content, over a lightly dimmed travel-app background. Preserve the app's plain white surface, dark ink outline, restrained offset shadow, rounded corners and Pretendard-like Korean sans-serif type. Use a left-aligned 18px bold question, a 14px target name when supplied, and a short 14px gray consequence when supplied. Keep the buttons side by side at 44px tall: neutral white '취소' on the left, muted red with white text for the action on the right. The content and buttons stay close together with 20px padding. Each of the following four states must have its own complete distinct dialog. Render the supplied Korean text.

State 1: question "멤버를 내보낼까요?"; target "지은"; consequence "여행 접근 권한을 해제해요.
이미 받은 사본은 남아 있어요."; action "내보내기".
State 2: question "공유 여행에서 나갈까요?"; target "가족 제주 여행"; consequence "미전송 내용과 복구 사본은 기기에 남아요."; action "나가기".
State 3: question "지도 API 키를 삭제할까요?"; target "Google 지도"; consequence "Google 좌표 검색이 꺼져요."; action "삭제".
State 4: question "저장 기록을 초기화할까요?"; consequence "저장 기록은 모두 삭제돼요.
기존 여행을 남기고 새 여행을 만들어요."; action "초기화".
```

## 05-inline-removal — 입력 중 첨부·이동 구간 제거

```text
Design two separate compact Korean TripLOG editing UI mockups side by side, each at a 390px mobile viewport scale. Preserve the existing travel planner's white surfaces, dark ink thin outlines, rounded corners, yellow save action and Pretendard-like Korean sans-serif text. These are inline removals inside an editor. First mockup: a section titled '예약 증빙', one file row '호텔 예약.pdf', a small red text action '첨부 제거', concise helper '일정 저장 시 반영돼요.', and a bottom '일정 저장' button. Second mockup: an editor titled '이동 구간', two compact rows '도보 · 10분' and '지하철 · 25분', a small red text action '구간 삭제' in each row's options, concise helper '저장 시 반영돼요.', and a bottom '이동 저장' button. Keep readable 14px body text, compact spacing and 44px touch targets. Show the editor states without an additional confirmation dialog. Render the supplied Korean text.
```
