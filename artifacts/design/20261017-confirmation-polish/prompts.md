# 최종 T2I 프롬프트

생성 방식: built-in image_gen. 입력 이미지 없음. 각각 한 번 생성.

## 01 — Confirmation system

```text
Create a refined, compact confirmation dialog design board for TripLOG, an existing Korean travel planner. Show four clearly readable component close-ups in a 2 by 2 layout, each designed for a 390px mobile viewport with a 342px-wide dialog. Match the existing app's white surfaces, dark navy ink #0b1020, lemon yellow #fff05a, soft pink #f7afc7, and Pretendard-style Korean sans-serif typography.

Use a white dialog with a thin dark outline, 16px rounded corners, a precise small offset shadow, and 20px padding. Place one small outlined action icon in a pale rounded square beside the left-aligned title and message column. Use an 18px bold question, a 14px semibold target, and a concise 14px gray consequence. Keep every dialog only as tall as its content. Place two equal-width, 44px-tall buttons below: a white outlined “취소” button and a clear action button with dark text, a dark outline, and a small offset shadow. Destructive actions use the app's soft pink; the recoverable archive action uses lemon yellow. Keep all text and controls suitable for native HTML/CSS implementation.

Render these four complete states:
1. Trash icon. “일정을 삭제할까요?” Target “오사카성 산책”. Buttons “취소”, “삭제”.
2. Trash icon. “일정을 삭제할까요?” Target “공항에서 숙소로”. Consequence “연결된 지출도 함께 삭제돼요.” Buttons “취소”, “삭제”.
3. Archive icon. “공유 여행을 보관할까요?” Target “가족 제주 여행”. Consequence “모든 멤버가 읽기 전용으로 바뀌어요.\n복구 기록에서 다시 열 수 있어요.” Buttons “취소”, “보관”.
4. Reset icon. “저장 기록을 초기화할까요?” Consequence “저장 기록은 모두 삭제돼요.\n기존 여행을 남기고 새 여행을 만들어요.” Buttons “취소”, “초기화”.

Use a quiet neutral presentation background around the component close-ups. Keep the supplied copy and compact hierarchy.
```

## 02 — Inline removal

```text
Create a coordinated TripLOG UI detail board with two readable mobile editor close-ups, each designed at a 390px viewport scale. Match the existing Korean travel planner's white surfaces, dark navy ink #0b1020, lemon yellow #fff05a, sky blue #bce6fb, soft pink #f7afc7, thin dark outlines, restrained offset shadows, rounded controls, and Pretendard-style typography. Refine the inline removal controls with clear alignment, readable text and at least 44px touch targets.

Left detail: the existing attachment section. Label “예약 증빙 (JPG·PNG·GIF·WebP·PDF, 최대 1.5MB)”. One aligned row containing a sky-blue “파일 선택” button, filename “호텔 예약.pdf”, and a soft-pink outlined “첨부 제거” button with a small trash icon. Below the row, show the concise helper “일정 저장 시 반영돼요.” Keep the filename readable on narrow screens.

Right detail: the existing transit segment options popover. Show label “노선명 (선택)”, an input with placeholder “노선명 입력 (선택)”, then a full-width pale-pink rounded removal button with a small trash icon and text “구간 삭제”. Below it, show “저장 시 반영돼요.” Use 14px control text and 12px helper text.

These actions remove an item from the unsaved editor. Present the inline controls directly, with their save-related helper text. Keep the supplied copy and existing content structure.
```
