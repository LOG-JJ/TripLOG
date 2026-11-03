# 공통 하단바 아이콘 원본·재생성 기록

2026-11-01 · Asia/Seoul

사용자는 여행만 별도로 축소하는 보정을 거부하고 PC·모바일의 모든 아이콘·글자·간격을 공통으로 맞추도록 요청했다. 기존 집·달력·캐리어·지갑·차트 모양을 유지하면서 아이콘 폰트의 서로 다른 내장 여백을 제거했다. 새 디자인 이미지나 아이콘 모양을 생성하지 않았고 동일 원본의 표현 형식을 SVG로 바꿨다.

- 원본: 프로젝트에 포함된 `vendor/phosphor-2.1.1/Phosphor.woff2`. MIT 라이선스·고지: 같은 디렉터리의 `LICENSE`, `NOTICE.md`.
- 5개 모두 동일한 export를 사용한다. FontTools가 읽은 glyph path와 실제 path bounds를 그대로 사용해 tight viewBox로 내보낸다. 원본 path를 다시 그리거나 메뉴별 배율/이동 값을 지정하지 않는다.
- 실행용 원본: `src/assets/navigation/{house,calendar-blank,suitcase-rolling,wallet,chart-bar}.svg`. 실제 하단바에서 모두 참조한다.
- 렌더링: 같은 28×24px CSS mask/contain 영역, 색상은 공통 currentColor, 같은 24px 아이콘 행·4px 간격·16px 글자 행.
- 원본 및 산출물 SHA256·codepoint·glyph bounds: [icon-provenance.json](icon-provenance.json).

프로젝트 루트에서 `python artifacts/design/20261101-common-bottom-nav/export-icons.py`로 재생성한다. Python FontTools와 Node가 필요하다. 나란히 둔 `brotli.py`는 이미 설치된 Node의 Brotli 디코더를 사용하므로 추가 pip 모듈을 설치하지 않는다. 런타임과 npm 빌드는 Python을 실행하지 않고 보존된 SVG를 사용한다.

사용자가 요청한 기존 하단바의 일관성 수정이며 새 화면·버튼·아이콘 종류를 추가하지 않았다. [실제 PC·모바일 검증](../../qa/20261101-common-bottom-nav/README.md).
