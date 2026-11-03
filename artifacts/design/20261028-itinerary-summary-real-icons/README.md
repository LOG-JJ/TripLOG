# 실제 소분류 아이콘을 참조한 일정 요약 이미지 목업

- 2026-10-28, built-in image_gen으로 독립 생성한 세 안. 표시 순서는 calendar-badge, color-journey, five-day-index.
- 사용자가 현재 프로젝트 아이콘 사용 및 이미지 생성 목업을 명시적으로 요청해 자산 참조 이미지를 입력함.
- project-icon-reference.png는 기존 src/assets/noto-emoji SVG 12개를 직접 래스터화한 입력. 원본 자산 경로·해시는 icon-sources.json에 기록.
- 기존 UI 캡처나 과거 생성 목업은 입력하지 않음. 연쇄 I2I 없음.
- HTML UI 목업·앱 소스·여행 데이터·배포는 변경하지 않음.
- 각 최종 프롬프트, 생성 도구 원본 경로, 저장본 SHA256과 입력 이미지 해시는 generation.json 참조.
- 실제 구현에서는 이미지 생성 결과의 아이콘을 잘라 쓰지 않고 프로젝트의 원본 SVG를 사용해야 함.
- 선택 대기.
