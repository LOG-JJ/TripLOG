# 국내 시 단위 전수 보강

2026-10-17. 기존 순천 그림의 짙은 손그림 외곽선과 밝은 면색을 기준으로 국내 목적지의 전용 삽화를 보강했다. PC는 800×480, 모바일은 480×600 투명 WebP이며 각 구도를 독립적으로 생성했다.

| 항목 | 결과 |
| --- | ---: |
| 공식 시 단위 대상 | 85곳 |
| 종전 광주 도시권 및 기존 군·섬·제주도 전체 권역 보존 | 10곳 |
| 국내 전용 그림 연결 대상 | 95곳 |
| 기존 그림 유지 | 15쌍·30장 |
| 신규 제작 | 80쌍·160장 |
| 전체 국내·해외 목적지 | 395곳 |
| 공통 테마 포함 활성 이미지 | 810개 |

국내 시 단위 목록은 [공식 명부](official-city-roster.json), [도시별 체크리스트](city-checklist.md), [실행 명세](city-plan.json)로 대조한다. [처음 작성한 계획](plan.md)의 수량·범위를 유지했다. 군 전체 확장은 포함하지 않으며 기존에 등록된 군·섬 목적지는 모두 유지했다.

전남광주통합특별시의 그림은 광역의 산·강·해안을 표현한 편집 삽화다. 특정 한 지점에서 보이는 실제 전경을 주장하지 않는다. 나머지 소재와 확인 근거는 체크리스트, `subject-review.md`, 작업별 프롬프트 및 검토 기록에 남겼다.

## 제작·원본 보존

모든 최종 생성은 **T2I**, 이미지 입력 **없음**, 투명 배경 요청으로 실행했다. 이전 목업이나 다른 도시 생성 이미지를 입력으로 사용하지 않았다.

- `jobs/*.json`, `jobs/*.prompt.txt`: 실제 호출에 사용한 최종 프롬프트와 인수.
- `assets-original/*.png`: 해당 호출이 반환한 정확한 PNG의 보존본.
- `assets-original/*.json`: 반환 원본 경로, 저장 경로, 원본·저장본 SHA256, 호출 시작 시각, 입력 이미지 없음 기록.
- `assets-original/*.asset.json`: WebP 변환 규격·해시·용량 기록. `prepared-pending-visual-qa`는 저장 당시 변환 단계의 상태이며 최종 검증 결과는 아래 QA 보고서를 따른다.
- `pilot-attempts/`, `revisions/`: 미선택 시안과 교정 이전 파일·프롬프트·해시 이력.
- 실행 자산: `src/assets/trip-scenes/cities/v5/`.

원본은 생성 도구 반환 경로를 직접 지정해 복사했고 최신 파일 검색으로 선택하지 않았다. 저장본의 해시를 원본과 대조했다. 기존 국내 15쌍의 파일은 유지했다.

## 앱 연결

`src/app/data/destination-scenes.js`에 95개 국내 목적지와 정확한 행정명·영문 별칭을 등록했다. `src/app/shared/destination-scenes.js`는 국가를 먼저 확인하고 정확한 별칭으로 그림을 선택한다.

경기 광주·종전 광주 도시권·전남광주통합특별시, 제주도·제주시·서귀포시는 서로 다른 목적지다. `광주` 단독 입력이나 복수 도시는 공통 그림을 사용한다. 여행 제목으로 도시를 추측하거나 저장된 여행 정보를 변경하지 않는다.

현재 화면에 필요한 한 장만 요청하는 동작, 48개 파일 캐시 한도와 미캐시 오프라인의 공통 그림 대체 동작을 유지한다. 이 폴더의 원본·프롬프트·검증 자료는 배포 파일에 포함하지 않는다.

## 검증 자료

- [최종 검증 보고서](../../qa/20261017-domestic-city-expansion/README.md)
- [원본·출력 해시 및 규격 감사](../../qa/20261017-domestic-city-expansion/asset-audit.json)
- [국내 전체 그림 비교 1](../../qa/20261017-domestic-city-expansion/assets-contact-01.png)
- [국내 전체 그림 비교 2](../../qa/20261017-domestic-city-expansion/assets-contact-02.png)
- [국내 전체 그림 비교 3](../../qa/20261017-domestic-city-expansion/assets-contact-03.png)
- [국내 전체 그림 비교 4](../../qa/20261017-domestic-city-expansion/assets-contact-04.png)
- [국내 전체 그림 비교 5](../../qa/20261017-domestic-city-expansion/assets-contact-05.png)
- [국내 전체 그림 비교 6](../../qa/20261017-domestic-city-expansion/assets-contact-06.png)

커밋·푸시와 운영 자동 배포는 이번 로컬 제작·구현 범위에서 실행하지 않았다.
