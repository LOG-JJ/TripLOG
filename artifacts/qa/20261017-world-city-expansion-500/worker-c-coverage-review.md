# Worker C — 국가·지역 보강 10개 도시 검증

검증일: 2026-10-17. 범위는 `generation-assignments.json`의 `coverage.worker-c` 10개 도시다. 핵심 도시 50개는 [별도 문서](worker-c-core-review.md)에 기록했다.

## 결과

- 최종 20장: PC 800×480 10장, 모바일 480×600 10장. 실행 WebP 합계 2,116,800 bytes.
- 20개 모두 독립적인 built-in `image_gen` T2I 호출이며 이미지 입력은 없다.
- 각 호출에서 반환된 정확한 원본 PNG 경로와 프로젝트 보존본의 SHA256을 대조했다. 20장 모두 일치하고 원본 경로가 서로 다르다.
- 최종 프롬프트 본문·파일·해시·호출 인수·출처 메타데이터가 일치한다. WebP 해시, 크기, 알파 범위 0–255 검증도 통과했다.
- 알파 8 이상을 실제로 보이는 영역으로 계산했을 때, 최종 20장 모두 우측·하단 여백이 0px다.
- 두 연락판에서 도시별 PC·모바일의 핵심 모티프, 피사체 식별과 잘림, 배경 투명성과 팔레트를 비교했다.

[기술 검증 기록](worker-c-coverage-technical-validation.json) · [연락판 1](worker-c-coverage-contact-1.png) · [연락판 2](worker-c-coverage-contact-2.png)

## 사전 보강과 최종 모티프

| 도시 | 최종 확인한 주요 형태 | 출처 |
|---|---|---|
| 구스타비아 | 낮은 열린 석조 포대 폐허와 대포, 붉은 지붕 마을과 요트항 | [관광위원회 Fort Gustav III 설명](https://www.saintbarth-tourisme.com/en/fort-gustav-iii-2/), [현행 Discover](https://www.saintbarth-tourisme.com/discover) |
| 스탠리 | 회색 석조·붉은 벽돌 교회, 사각 시계탑과 붉은 지붕, 인접한 고래뼈 아치 | [관광청 Christ Church Cathedral](https://www.falklandislands.com/things-to-do/christ-church-cathedral-p673891), [Whalebone Arch](https://www.falklandislands.com/things-to-do/whalebone-arch-p673731) |
| 지브롤터 | 가파른 밝은 석회암 바위의 독특한 윤곽, 낮은 해안 시가지 | [관광청 Upper Rock 안내](https://www.visitgibraltar.gi/uploads/Leaflets/GNR_NatureReserve_8pp_NEW.pdf) |
| 세인트헬리어 | 바위섬 위 낮고 두꺼운 석조 성벽, 간조의 둑길과 얕은 바닷물 | [Visit Jersey Elizabeth Castle](https://www.jersey.com/things-to-do/attractions/listings/elizabeth-castle/) |
| 리틀베이 | 낮은 분홍색 박물관과 밝은 지붕, 검은 모래 해변·녹색 곶 | [정부 문화유산 안내서 p.26](https://www.gov.ms/wp-content/uploads/2020/07/Historic-Cultural-Sights.pdf), [Montserrat National Trust](https://montserratnationaltrust.ms/archeological-heritage/) |
| 롱위에아르뷔엔 | 붉은 목재 교회, 짙은 삼각 박공지붕, 가느다란 붉은 첨탑, 낮은 회색 별관, 나무 없는 북극 지형 | [Visit Svalbard 교회 사진](https://www.visitsvalbard.com/se-og-gjore/svalbard-kirke-p3500473) |
| 샬럿아말리에 | 붉은 낮은 요새와 평평한 성가퀴를 가진 사각 시계탑, 크림색 띠 | [USVI 관광청 Fort Christian](https://www.visitusvi.com/experience/must-see-historic-sites/) |
| 킹스턴(노퍽) | 조지안 석조 건물, 열린 잔디, 층을 이루는 수평 가지의 노퍽 소나무 | [노퍽 정부 문화유산](https://kingston.norfolkisland.gov.au/) |
| 하갓냐 | 밝은 정면의 큰 아치 창, 낮은 아케이드와 한쪽 사각 시계탑·작은 종탑 | [Guam Visitors Bureau 공식 갤러리](https://www.visitguam.com/listing/dulce-nombre-de-maria-cathedral-basilica/3688/) |
| 다클라 | 낮은 평지붕 시가지, 모래 반도와 청록색 석호, 작은 어선 | [관광청 Dakhla](https://www.visitmorocco.com/en/destinations/dakhla) |

스탠리, 저지, 스발바르, 샬럿아말리에, 괌은 공식 사진을 브라우저로 직접 확인했다. 리틀베이는 정부 PDF의 이미지 설명과 운영기관의 현재 분홍색 건물 안내를 대조했으며, PDF 화면 캡처는 도구에서 가져오지 못했다. 구스타비아의 현행 사진 CDN은 브라우저 정책으로 열리지 않았으므로 우회하지 않고 공식 텍스트로 확인되는 낮은 폐허·대포만 남겼다. 모든 사진은 사실 확인에만 사용했고 생성 도구에 이미지 입력으로 전달하지 않았다.

9개 도시 18개 job의 생성 전 보강 기록은 [사전 검토 manifest](../../design/20261017-world-city-expansion-500/revisions/worker-c-coverage-preflight/manifest.json)에 있다. 다클라는 처음에는 기존 프롬프트로 생성했다.

## 생성 후 보정

구스타비아 2장의 원본에는 근거가 불충분한 둥근 돔형 경비탑이 추가되어 있었다. 최종본은 낮은 열린 포대 폐허와 대포로 독립 T2I 재생성했다. 다클라 2장은 기존 낮은 시가지 모티프에 없는 큰 첨탑이 생겨, 저층 평지붕 건물·석호·어선으로 다시 생성했다. 변경 전 4장과 프롬프트·메타데이터·WebP는 SHA256 확인 후 [coverage-r1](../../design/20261017-world-city-expansion-500/revisions/worker-c-coverage-r1/manifest.json)에 보존했다.

구스타비아 모바일 최종 원본의 희미한 가장자리가 기본 알파 경계를 넓혀, WebP에서 알파 8 이상 기준 최대 6px 여백이 나타났다. 원본 PNG는 변경하지 않고 그 원본에서 다시 변환하면서 우측·하단을 맞췄다. 보정 전 실행 WebP와 메타데이터도 보존했으며, 최종 실제 경계는 0px다. [변환 기록](../../design/20261017-world-city-expansion-500/revisions/worker-c-coverage-visible-edge/bl-gustavia-mobile/revision.json).

이 검토는 여행 헤더 삽화의 식별 가능한 주요 특징과 구도를 검증했다. 모든 창문의 개수나 실제 지형의 정확한 거리를 건축 도면·지도 수준으로 검증하지는 않았다. 실제 페이지의 전체 반응형 헤더 검증과 카탈로그 통합은 상위 작업에서 수행한다.
