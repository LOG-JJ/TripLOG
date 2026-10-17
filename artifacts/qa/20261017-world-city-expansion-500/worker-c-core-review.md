# Worker C — 해외 확장 핵심 50개 도시 검증

검증일: 2026-10-17. 범위는 `generation-assignments.json`의 `core.worker-c` 50개 도시이며, 국가·지역 coverage 10개 도시는 이 문서의 집계에 포함하지 않는다.

## 완료 결과

- 최종 실행 자산 100장: 도시별 PC 800×480 한 장, 모바일 480×600 한 장.
- 모두 독립적인 built-in `image_gen` T2I 호출로 생성했다. 이미지 입력은 전부 `[]`이며 참조 사진은 사실 확인에만 사용했다.
- 호출이 반환한 정확한 PNG 경로에서 원본을 보존했고, 도구 원본·프로젝트 보존본의 SHA256 일치를 100장 모두 확인했다. 최신 파일 검색은 사용하지 않았다.
- 최종 WebP 100장의 해시, 크기, 알파 범위 0–255, 프롬프트 본문·파일·메타데이터·SHA256 일치를 확인했다. 최종 100개의 호출 원본 경로는 서로 다르다.
- 최종 WebP 합계: 10,468,772 bytes. 개별 기록은 [기술 검증 JSON](worker-c-core-technical-validation.json)에 있다.
- 9개 전체 연락판에서 PC·모바일 쌍의 주 피사체, 중요한 윤곽, 색감, 배경 투명성과 잘림을 검토했다. 보정 후 변경된 연락판을 다시 확인했다.

## 보정 이력

9개 도시의 14개 최종 자산을 교체했다. 18회 추가 생성 결과를 거쳤으며 교체 전 원본·프롬프트·메타데이터·실행 WebP는 삭제 전에 복사하고 SHA256으로 대조했다. 기록은 [visual-r1](../../design/20261017-world-city-expansion-500/revisions/worker-c-visual-r1/manifest.json), [frame-r2](../../design/20261017-world-city-expansion-500/revisions/worker-c-frame-r2/manifest.json), [생루이 마지막 구도·색상 보정](../../design/20261017-world-city-expansion-500/revisions/worker-c-flat-r3/sn-saint-louis-senegal-mobile/revision.json)에 있다.

| 도시 | 보정 범위 | 확인 내용과 최종 조치 |
|---|---|---|
| 헤이그 | 모바일 | 시계탑 꼭대기와 우측 날개의 여유를 확보했다. 정원 연못 자체는 공식 정원 설명에 등장하므로 유지했다. |
| 바티칸 | PC·모바일 | 돔 위 십자가의 여유와 성당 본체 양 끝의 식별을 개선했다. 광장과 주변 건물은 지지 경관으로 유지했다. |
| 모나코 | 모바일 | 궁전 우측 탑과 건물 날개가 프레임 안에 들어오도록 다시 구성했다. |
| 카디프 | PC·모바일 | 현재 남아 있지 않은 계단 아래 문루·성벽을 제거했다. 잔디 언덕 위의 다각형 shell keep와 직접 연결된 계단을 표현했다. |
| 개성 | PC | 문루가 2층으로 생성된 오류를 단층 목조 누각·단일 팔작지붕으로 수정했다. |
| 로밤바 | PC·모바일 | 거대한 폐쇄형 돔 건물을 실제 낮은 육각 개방 파빌리온, 큰 아치, 작은 낮은 돔과 중앙 동상으로 바꿨다. |
| 생루이 | PC·모바일 | 교각 아래 강물이 빠진 첫 생성본을 교체했다. 세네갈강 수면을 명시하고 다리 양 끝이 보이도록 수정했다. 모바일 중간 결과의 푸른 안개와 반투명 전체 도색도 마지막 T2I 생성으로 교체했다. |
| 은자메나 | PC·모바일 | 돔·기둥식 현관을 실제 박물관의 낮은 직사각 평지붕, 깊게 들어간 두 개의 유리 출입부와 중앙 석재 기둥으로 바꿨다. 이후 전체 건물 구도를 한 번 더 조정했다. |
| 쿠칭 | 모바일 | 다리의 양쪽 주탑·케이블과 곡선 상판을 더 잘 보이도록 구성했다. 배경 주의회 건물은 작게 줄였다. |

메데인 모바일의 첫 호출은 도구가 실패를 반환했다. 실패 응답과 변경 전 요청을 [별도 기록](../../design/20261017-world-city-expansion-500/revisions/worker-c-content-clarification/co-medellin-mobile-failed-attempt.json)에 남기고, 공공 조각 광장의 청동 말 조각을 명시한 독립 T2I 요청으로 완료했다. 말레는 생성 전에 공식 사진을 확인해 금요일 모스크와 미나레트 형태를 명확히 했다.

## 사실 확인 근거

- [Cardiff Castle — Norman Keep](https://www.cardiffcastle.com/visit/see-do/norman-keep/) 및 [현재 사진](https://www.cardiffcastle.com/app/uploads/2022/05/Norman-Keep-850x480-1.jpg): 아래쪽 문루는 철거되었으며 현존하는 keep와 잔디 언덕·계단 형상을 확인했다.
- [UNESCO ICOMOS 개성 평가서](https://whc.unesco.org/document/122862): Nam Gate의 상부가 3×2칸 단층 목조 누각임을 확인했다.
- [Eswatini Tourism Authority — Lobamba](https://www.thekingdomofeswatini.com/central-eswatini/lobamba/) 및 [공식 사진](https://www.thekingdomofeswatini.com/wp-content/uploads/2018/02/1aaSwaziland-Jonathan-Ramael-Royal-Museum.jpg): King Sobhuza II Memorial Park의 낮고 개방된 육각 파빌리온을 확인했다.
- [German Archaeological Institute 현장 보고](https://www.dainst.blog/entangled-africa/bericht_2022_11/) 및 [현장 사진](https://www.dainst.blog/wp-content/uploads/2022/11/IMG_20220628_094338690_HDR-scaled-2.jpg): 차드 국립박물관의 현대적인 평지붕과 유리 입구 형태를 확인했다. 기존 대사관 관광 자료는 시설 확인에 쓰였고 건물 외형 교정은 이 현장 사진을 따랐다.
- [UNESCO — Island of Saint-Louis](https://whc.unesco.org/en/list/956/): 강 위의 Faidherbe Bridge와 섬 시가지 모티프를 확인했다.
- [Peace Palace 정원 안내](https://www.vredespaleis.nl/peace-palace/architecture/garden-design-mawson/?lang=en): 정원 연못은 존재하는 요소다.

## 대표 연락판과 검증 범위

[서유럽·카디프 보정](worker-c-core-representative-1.png), [쿠칭·말레·은자메나](worker-c-core-representative-6.png), [로밤바·서아프리카](worker-c-core-representative-7.png), [생루이·오세아니아](worker-c-core-representative-8.png).

이 검토는 작은 여행 헤더 삽화의 식별 가능한 특징과 출처에 근거한 주요 형태를 다뤘다. 각 건물의 창문 수·정확한 비례·모든 배경 건물을 건축 도면 수준으로 검증한 것은 아니다. 실제 페이지의 반응형 헤더 검증과 최종 카탈로그 통합은 상위 작업에서 이어진다.
