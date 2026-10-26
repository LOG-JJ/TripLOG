# 일정 테마 세부 분류 목업

- 날짜: 2026-10-26 (Asia/Seoul)
- 생성 방식: built-in Image Gen, T2I 1회
- 이미지 입력: 없음
- 호출 원본: `C:/Users/tbdk5/.codex/generated_images/01a176f0-4333-7d43-9eea-f7e278df0b94/exec-baa49016-7920-4717-a992-a80b25dc5164.png`
- 저장본: [theme-subtype-concept.png](theme-subtype-concept.png)
- 원본·저장본 SHA256: `624EB2CC911E320DE87E5C83E37B31FF4FBA4F0B6D3049729F6C71C63E9A5D3A`
- 기존 파일 덮어쓰기: 없음

## 최종 프롬프트

Create a mobile UI concept for the Korean TripLOG itinerary editor at 390 × 844. Preserve the existing white form, dark text and borders, and yellow primary action. Show a place field, then a row with “테마” set to “맛집” and “세부 분류” set to “카페”, followed by start and end times, notes, and a “저장” button. Show the open subtype selector anchored to its field, with readable options “자동”, “식당”, “카페”, “베이커리”, “바”, simple icons, and a clear selected state. Prioritize readable Korean text, compact spacing, and touch targets.

## 구현 기준

테마와 세부 분류를 나란히 배치하고 기존 폼·시간 입력·저장 버튼을 재사용한다. 세부 분류는 선택 사항이다. 작은 화면에서도 메뉴 항목을 읽을 수 있도록 메뉴를 필드보다 넓게 표시하고 화면 안으로 위치를 보정한다. 명소의 긴 목록은 메뉴 내부에서 스크롤한다.
