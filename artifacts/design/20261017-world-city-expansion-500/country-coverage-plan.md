# 해외 500개 확장 이후 국가·지역 최소 도시 보완 기준

기준일: 2026-10-17. 이 문서는 기존 해외 300개·국내 95개 상태의 읽기 전용 조사 결과다. 런타임 코드와 이미지에는 손대지 않았다. 같은 폴더의 `country-inventory.json`이 전체 250개 코드, 분류, 기존 목적지, 정확한 누락 코드 집합과 검증 입력의 기준이다.

## 현재 범위와 집계

| 기준 | 현재 충족 | 전체 대상 | 누락 |
| --- | ---: | ---: | ---: |
| 해외 catalog 목적지 수 | 300 | 1차 목표 약 500 | 약 200개 추가 |
| 해외 국가코드 전체 연결 | 92 | 국가 선택 목록 249 | 157 |
| 첫 국가코드에 속하는 독립 목적지 | 91 | 국가 선택 목록 249 | 158 |
| UN 회원국·옵서버 국가의 독립 목적지 | 85 | 한국 제외 194 | 109 |
| UN 회원국·옵서버 국가의 실제 도시·정착지 | 83 | 한국 제외 194 | 111 |
| 앱의 필수 해외 국가·유인 지역의 실제 도시·정착지 | 86 | 242 | 156 |

마지막 두 행은 기존 `city`·`town`과 아래 명시적 도시권 예외를 사용한다. 전체 연결 수 92에는 `il-jerusalem.countryCodes = ['IL', 'PS']`를 통해 잡히는 PS가 포함된다. PS에는 첫 코드가 PS인 독립 도시가 없으므로 국가별 최소 요건을 충족하지 않는다. 베들레헴 등 별도 PS 목적지를 추가한다. 공유 코드 배열은 검색 호환 관계이며 영유권이나 도시 소속을 판정하는 자료로 사용하지 않는다.

현재 `city`·`town`만으로 충족하는 해외 코드 수는 83개다. 기존 `region`인 싱가포르·홍콩·마카오의 실제 도시권을 승인된 예외로 포함하면 86개다. 괌·사이판·보라보라 섬, 몰디브 국가/군도, 바간 광역 항목은 그대로 유지하면서 별도 도시·정착지를 보완한다.

## 국가와 별도 지역의 기준

1. **국가 기본 집합: UN 회원국 193 + 비회원 옵서버 국가 2 = 195개.** 대한민국 KR은 국내 95개 중 실제 도시가 있으므로 기존 국내 커버리지로 충족한다. 해외 국가 기본 대상은 194개다. UN 공식 회원국 HTML의 193개 명칭을 M49 alpha-2 코드와 전수 대조했으며 명칭 차이는 대응표로 정규화했다. 옵서버 국가는 VA와 PS다. [UN 현재 회원국 안내](https://research.un.org/en/unmembers/intro), [UN 현재 회원국 명부](https://research.un.org/en/unmembers/currentmembers), [옵서버 국가](https://research.un.org/en/unmembers/observers).
2. **앱에서 별도 선택하는 TW·XK: 2개 추가 필수 대상.** 현재 앱 코드를 그대로 보존한다. TW·XK를 UN 회원국으로 세지 않으며 앱 목적지 선택을 위한 별도 범주로 둔다. XK는 ISO의 공식 부여 코드가 아니라 사용자 지정 코드라는 점을 메타데이터에 기록한다. [ISO 코드의 범위](https://www.iso.org/iso-3166-country-codes.html), [EU의 국가·지역 코드 및 XK 설명](https://op.europa.eu/en/web/eu-vocabularies/countries-and-territories), [EU Council의 XKX 설명](https://www.consilium.europa.eu/prado/en/prado-documents/xkx/index.html).
3. **별도 선택 가능한 유인 지역 46개도 보완한다.** 일반 속령·특별행정구 등 43개, 자유연합 자치국 CK·NU 2개, 분쟁지역 EH 1개로 구분한다. CK·NU를 일반 속령으로 합치지 않는다. EH는 국가 기본 집합과 별도로 표시하며 최종 지위에 관한 주장을 추가하지 않는다. [UN M49 국가·지역 코드](https://unstats.un.org/unsd/methodology/m49/overview/), [뉴질랜드 총독부 CK·NU 설명](https://gg.govt.nz/publications/niue-and-cook-islands), [UN 서사하라 분류](https://www.un.org/dppa/decolonization/en/nsgt/western-sahara).
4. **도시를 요구하지 않는 7개 코드**는 별도 예외 집합에 둔다. AQ·BV·GS·HM·IO·TF·UM이다. 모두 단순히 무인이라고 표현하지 않는다. 연구·보전·군사 인력이 있는 지역과 일반적인 상주 관광도시가 없는 지역을 구분한다. 지역 이름이나 공통 풍경으로 처리할 수 있으나 허구의 도시나 수도를 만들지 않는다. 여행지 기록을 위한 분류이므로 국가별 일시적인 입국 제한이나 여행 경보로 국가 자체를 누락시키지 않는다.

따라서 해외 최소 도시·정착지 필수 집합은 **194 + 2 + 46 = 242개**이며 국내 KR까지 합치면 243개다. 앱 선택 목록 250개는 243개 필수 대상과 7개 도시 예외로 빠짐없이 분할한다. 이 분류는 앱의 목적지 커버리지 기준이며 국제법상 주권 인정 목록을 새로 만드는 작업이 아니다.

## 도시를 요구하지 않는 지역의 근거

| 코드 | 구분과 처리 | 공식 근거 |
| --- | --- | --- |
| AQ | 남극의 연구기지·계절 인력을 일반 관광도시로 만들지 않는다. 남극 지역 또는 공통 풍경 예외로 처리한다. | [Australian Antarctic Program 인구·연구기지](https://www.antarctica.gov.au/about-antarctica/people-in-antarctica/how-many/) |
| BV | 부베섬은 자연보호구역이며 일반 도시가 없다. | [Norwegian Polar Institute](https://npolar.no/en/themes/bouvetoya/), [연구기관의 무인도 기술](https://brage.npolar.no/npolar-xmlui/bitstream/handle/11250/173650/Skrifter175.pdf?isAllowed=y&sequence=1) |
| GS | 사우스조지아 정부가 영구 거주민이 없음을 명시한다. 방문지·연구기지와 상주 도시를 구분한다. | [정부 FAQ](https://gov.gs/frequently-asked-questions/) |
| HM | 허드·맥도널드 제도의 무인 자연보호구역과 과거 연구기지 유적을 도시로 취급하지 않는다. | [Australian Antarctic Program](https://www.antarctica.gov.au/news/2003/climate-change-answers-from-living-laboratory-in-southern-ocean/), [2026년 현장 연구](https://www.antarctica.gov.au/news/2026/heard-island-and-mcdonald-islands-campaign-delivers-key-objectives/) |
| IO | 군사시설·행정 관련 제한 접근 지역이다. 현재 공식 안내가 관광 목적지가 아님을 명시한다. 단순 무인 판정 대신 일반 관광도시 부재 예외로 둔다. | [BIOT 정부 방문 안내](https://www.biot.gov.io/visiting/) |
| TF | TAAF는 영구 인구가 없고 과학·기술·군사 인력이 순환 근무한다. 연구기지를 일반 도시로 바꾸지 않는다. | [TAAF 정부 소개](https://taaf.fr/collectivites/presentation/) |
| UM | 미국령 군소제도의 무인 섬 및 제한 인구의 군사·보전 시설을 일반 도시로 합성하지 않는다. | [미국 노동부 감사보고서의 영토 구분](https://www.oig.dol.gov/public/reports/oa/2025/05-25-002-06-001.pdf), [Census 정의](https://www2.census.gov/programs-surveys/decennial/2020/technical-documentation/island-areas-tech-docs/demographic_profile/2020-iac-dpsf-technical-documentation.pdf) |

SJ는 코드명에 얀마웬섬이 포함돼도 스발바르의 실제 정착지 롱위에아르뷔엔이 있으므로 포함한다. CK·NU·PN·TK·WF 등 인구가 작은 지역도 도시의 행정 명칭을 강제하지 않고 실제 마을·정착지를 선택한다. [스발바르 정부의 롱위에아르뷔엔 안내](https://www.sysselmesteren.no/publikasjoner/brosjyrer/longyearbyen---fra-company-town-til-moderne-by/).

## 이름이 도시형이 아닌 실제 정착권역 예외

| 국가코드 | 허용 목적지 ID | 허용 kind | 범위와 근거 |
| --- | --- | --- | --- |
| SG | `sg-singapore` | `region` | 도시국가 싱가포르의 실제 도시권. [싱가포르 외교부](https://www.mfa.gov.sg/about-singapore/) |
| HK | `hk-hong-kong` | `region` | 기존 앱이 지역형으로 분류한 홍콩의 실제 도시권. [홍콩 관광청 도시·동네 안내](https://www.discoverhongkong.com/eng/neighbourhoods.html) |
| MO | `mo-macau` | `region` | 기존 마카오 도시 목적지를 유지한다. [마카오 정부 관광청 도시 소개](https://media.macaotourism.gov.mo/uploads/mgto_events_festivals/icogfm-city-info-macao-2026.pdf) |
| NR | `nr-yaren` | `region` | 추가 예정인 야렌은 정부 중심 정착 구역이다. UNCTAD는 공식 수도가 없고 의회가 야렌에서 열린다고 설명한다. 기존 사실을 맞추기 위해 `city`로 강제 변환하지 않는다. [UNCTAD 국가 프로필](https://dgff2021.unctad.org/nauru/) |

위 예외는 **국가코드 + 정확한 목적지 ID + kind**를 함께 고정한다. 같은 국가의 다른 섬이나 광역권을 자동으로 도시로 인정하지 않는다. 새 예외가 필요하면 공식 정착지 근거와 정확한 ID를 검토해 이 목록에 추가한다.

## 두 단계 반영 절차

1. 기존 해외 300개와 국내 95개 ID·별칭·이미지 경로를 스냅샷으로 고정한다.
2. 병렬 선정한 관광 목적지 약 200개를 중복 검사해 1차 확장한다. 여기에는 실제 도시 외에 관광 섬·지역이 포함될 수 있으므로 목적지 수와 국가별 도시 충족 수를 별도로 계산한다.
3. **합쳐진 1차 catalog**에서 `sets.requiredOverseasCodes`를 기준으로 다시 누락을 산출한다. 아래 156개는 300개 상태의 기준선이며 1차 확장 후 잔여 목록으로 그대로 재사용하지 않는다.
4. 남은 각 국가·유인 지역에 실제 도시·마을·정착지 하나를 추가한다. 같은 도시를 여러 국가에 보조 코드로 연결해 누락을 지우지 않는다.
5. 2차 보완으로 500개를 넘을 수 있다. 최종 목표는 숫자 500에 맞추기 위한 삭제가 아니라 약 500개 확장과 국가·유인 지역 최소 커버리지의 동시 충족이다.
6. 국가별 대표 fixture를 최종 도시에서 고르고, 국가명·별칭·이미지·브라우저 검증을 완료한다. 기존 데이터의 도시 문자열이나 국가코드를 일괄 치환하지 않는다.

## 독립 fixture 설계

`country-inventory.json`의 `sets`는 catalog에서 역으로 추출한 목록이 아니라 공식 명부와 기존 국가 선택 목록을 대조해 만든 기준이다. 테스트가 현 구현의 누락을 그대로 정답으로 받아들이지 않도록 정적 fixture로 복사한다.

필수 fixture 값:

- `coreAllCountryCodes`: UN 193 + VA·PS = 195. `coreOverseasCodes`: 위 집합에서 KR을 제외한 194.
- `additionalAppJurisdictions`: TW·XK. `inhabitedAdditionalAreaCodes`: 46.
- `requiredOverseasCodes`: 242. `requiredAllCodes`: KR 포함 243.
- `noOrdinaryTourismCityCodes`: 7. 이 집합은 `requiredAllCodes`와 서로 겹치지 않고 둘의 합집합은 국가 선택 목록 250개와 같다.
- `settlementExceptions`: SG·HK·MO·NR의 ID·kind 한정 허용표.
- 국가별 `appNameKo`, `appNameEn`을 정적 입력으로 보존한다. 현재 395개 목적지의 두 국가 표시명 입력은 모두 매칭됐지만 새 국가에는 기존 수동 별칭 목록 확장이 필요하다.

기본 검증 의사코드:

```js
function qualifies(entry, code) {
  if (entry.countryCodes[0] !== code) return false;
  if (['city', 'town'].includes(entry.kind)) return true;
  return settlementExceptions.some(x =>
    x.code === code && x.destinationId === entry.id && x.kind === entry.kind);
}

for (const code of requiredAllCodes) {
  const representative = catalog.find(entry => qualifies(entry, code));
  assert(representative, `${code}: an actual city or settlement is required`);
  assert(representative.dedicated);
  assertFileExists(representative.src);
  assertFileExists(representative.mobileSrc);
  const labels = countryLabels[code];
  for (const trip of [
    { countryCode: code },
    { countryCode: code.toLowerCase() },
    { country: labels.ko },
    { country: labels.en },
  ]) {
    const actual = resolve({ ...trip, city: representative.canonicalInput });
    assert.equal(actual.destinationId, representative.id);
    assert.equal(actual.dedicated, true);
  }
}
```

추가로 대표 도시의 한글·영문 alias를 교차 검사하고, 동일 이름이 여러 국가에 있을 때 국가코드 필터가 정확히 동작하는지 확인한다. 국가 미지정·잘못된 명시 국가·여러 도시 입력은 기존 unknown/ambiguous/multiple 계약을 유지해야 한다. `IL,PS` 같은 보조 관계만으로 PS의 최소 국가 요건을 통과시키면 실패하도록 명시 검사를 둔다.

반복 가능한 검증은 기존 `tests/destination-scenes-regression.js`에 연결할 수 있다. 도시는 최소 한 대표를 국가별로 검사하되 자산 존재와 크기·투명도·고유성은 최종 신규 자산 전수 검사로 별도 수행한다. 실제 헤더는 기존 브라우저 회귀 도구로 선택된 이미지, 320·390·599·1440px 배치, 텍스트 간섭과 그림 하단 연결을 검사한다. `npm run test:source`, 관련 회귀 테스트, `npm run artifacts:check` 이후 전체 통합 단계에서 `npm test`와 `npm run build`를 실행한다.

## 300개 기준선의 정확한 누락 목록

아래 표는 `country-inventory.json`에서 자동 작성하며, 직접 국가 목적지가 있는지와 실제 도시·정착지가 있는지를 구분한다. 국가 이름은 현재 앱의 표시명이다.

### UN 회원국·옵서버 국가: 도시·정착지 누락 111개

| 코드 | 앱 표시명 | 현재 독립 목적지 | 보완 이유 |
| --- | --- | --- | --- |
| AD | 안도라 | 없음 | 직접 목적지 없음 |
| AF | 아프가니스탄 | 없음 | 직접 목적지 없음 |
| AG | 앤티가 바부다 | 없음 | 직접 목적지 없음 |
| AL | 알바니아 | 없음 | 직접 목적지 없음 |
| AM | 아르메니아 | 없음 | 직접 목적지 없음 |
| AO | 앙골라 | 없음 | 직접 목적지 없음 |
| BB | 바베이도스 | 없음 | 직접 목적지 없음 |
| BD | 방글라데시 | 없음 | 직접 목적지 없음 |
| BF | 부르키나파소 | 없음 | 직접 목적지 없음 |
| BI | 부룬디 | 없음 | 직접 목적지 없음 |
| BJ | 베냉 | 없음 | 직접 목적지 없음 |
| BN | 브루나이 | 없음 | 직접 목적지 없음 |
| BO | 볼리비아 | 없음 | 직접 목적지 없음 |
| BS | 바하마 | 없음 | 직접 목적지 없음 |
| BW | 보츠와나 | 없음 | 직접 목적지 없음 |
| BY | 벨라루스 | 없음 | 직접 목적지 없음 |
| BZ | 벨리즈 | 없음 | 직접 목적지 없음 |
| CD | 콩고민주공화국 | 없음 | 직접 목적지 없음 |
| CF | 중앙 아프리카 공화국 | 없음 | 직접 목적지 없음 |
| CG | 콩고공화국 | 없음 | 직접 목적지 없음 |
| CI | 코트디부아르 | 없음 | 직접 목적지 없음 |
| CM | 카메룬 | 없음 | 직접 목적지 없음 |
| CV | 카보베르데 | 없음 | 직접 목적지 없음 |
| CY | 키프로스 | 없음 | 직접 목적지 없음 |
| DJ | 지부티 | 없음 | 직접 목적지 없음 |
| DM | 도미니카 | 없음 | 직접 목적지 없음 |
| DO | 도미니카 공화국 | 없음 | 직접 목적지 없음 |
| DZ | 알제리 | 없음 | 직접 목적지 없음 |
| ER | 에리트리아 | 없음 | 직접 목적지 없음 |
| ET | 에티오피아 | 없음 | 직접 목적지 없음 |
| FM | 미크로네시아 | 없음 | 직접 목적지 없음 |
| GA | 가봉 | 없음 | 직접 목적지 없음 |
| GD | 그레나다 | 없음 | 직접 목적지 없음 |
| GH | 가나 | 없음 | 직접 목적지 없음 |
| GM | 감비아 | 없음 | 직접 목적지 없음 |
| GN | 기니 | 없음 | 직접 목적지 없음 |
| GQ | 적도 기니 | 없음 | 직접 목적지 없음 |
| GT | 과테말라 | 없음 | 직접 목적지 없음 |
| GW | 기니비사우 | 없음 | 직접 목적지 없음 |
| GY | 가이아나 | 없음 | 직접 목적지 없음 |
| HN | 온두라스 | 없음 | 직접 목적지 없음 |
| HT | 아이티 | 없음 | 직접 목적지 없음 |
| IQ | 이라크 | 없음 | 직접 목적지 없음 |
| IR | 이란 | 없음 | 직접 목적지 없음 |
| JM | 자메이카 | 없음 | 직접 목적지 없음 |
| KG | 키르기스스탄 | 없음 | 직접 목적지 없음 |
| KI | 키리바시 | 없음 | 직접 목적지 없음 |
| KM | 코모로 | 없음 | 직접 목적지 없음 |
| KN | 세인트키츠 네비스 | 없음 | 직접 목적지 없음 |
| KP | 북한 | 없음 | 직접 목적지 없음 |
| KZ | 카자흐스탄 | 없음 | 직접 목적지 없음 |
| LB | 레바논 | 없음 | 직접 목적지 없음 |
| LC | 세인트루시아 | 없음 | 직접 목적지 없음 |
| LI | 리히텐슈타인 | 없음 | 직접 목적지 없음 |
| LR | 라이베리아 | 없음 | 직접 목적지 없음 |
| LS | 레소토 | 없음 | 직접 목적지 없음 |
| LU | 룩셈부르크 | 없음 | 직접 목적지 없음 |
| LY | 리비아 | 없음 | 직접 목적지 없음 |
| MC | 모나코 | 없음 | 직접 목적지 없음 |
| MD | 몰도바 | 없음 | 직접 목적지 없음 |
| MG | 마다가스카르 | 없음 | 직접 목적지 없음 |
| MH | 마셜 제도 | 없음 | 직접 목적지 없음 |
| MK | 북마케도니아 | 없음 | 직접 목적지 없음 |
| ML | 말리 | 없음 | 직접 목적지 없음 |
| MM | 미얀마 | 바간 (region) | 광역·섬만 있음 |
| MR | 모리타니 | 없음 | 직접 목적지 없음 |
| MU | 모리셔스 | 없음 | 직접 목적지 없음 |
| MV | 몰디브 | 몰디브 (region) | 광역·섬만 있음 |
| MW | 말라위 | 없음 | 직접 목적지 없음 |
| MZ | 모잠비크 | 없음 | 직접 목적지 없음 |
| NE | 니제르 | 없음 | 직접 목적지 없음 |
| NG | 나이지리아 | 없음 | 직접 목적지 없음 |
| NI | 니카라과 | 없음 | 직접 목적지 없음 |
| NR | 나우루 | 없음 | 직접 목적지 없음 |
| PG | 파푸아뉴기니 | 없음 | 직접 목적지 없음 |
| PK | 파키스탄 | 없음 | 직접 목적지 없음 |
| PS | 팔레스타인 | 없음 | 보조 국가코드만 있음 |
| PW | 팔라우 | 없음 | 직접 목적지 없음 |
| PY | 파라과이 | 없음 | 직접 목적지 없음 |
| RW | 르완다 | 없음 | 직접 목적지 없음 |
| SB | 솔로몬 제도 | 없음 | 직접 목적지 없음 |
| SC | 세이셸 | 없음 | 직접 목적지 없음 |
| SD | 수단 | 없음 | 직접 목적지 없음 |
| SL | 시에라리온 | 없음 | 직접 목적지 없음 |
| SM | 산마리노 | 없음 | 직접 목적지 없음 |
| SN | 세네갈 | 없음 | 직접 목적지 없음 |
| SO | 소말리아 | 없음 | 직접 목적지 없음 |
| SR | 수리남 | 없음 | 직접 목적지 없음 |
| SS | 남수단 | 없음 | 직접 목적지 없음 |
| ST | 상투메 프린시페 | 없음 | 직접 목적지 없음 |
| SV | 엘살바도르 | 없음 | 직접 목적지 없음 |
| SY | 시리아 | 없음 | 직접 목적지 없음 |
| SZ | 에스와티니 | 없음 | 직접 목적지 없음 |
| TD | 차드 | 없음 | 직접 목적지 없음 |
| TG | 토고 | 없음 | 직접 목적지 없음 |
| TJ | 타지키스탄 | 없음 | 직접 목적지 없음 |
| TL | 동티모르 | 없음 | 직접 목적지 없음 |
| TM | 투르크메니스탄 | 없음 | 직접 목적지 없음 |
| TO | 통가 | 없음 | 직접 목적지 없음 |
| TT | 트리니다드 토바고 | 없음 | 직접 목적지 없음 |
| TV | 투발루 | 없음 | 직접 목적지 없음 |
| UA | 우크라이나 | 없음 | 직접 목적지 없음 |
| UG | 우간다 | 없음 | 직접 목적지 없음 |
| UY | 우루과이 | 없음 | 직접 목적지 없음 |
| VA | 바티칸 시국 | 없음 | 직접 목적지 없음 |
| VC | 세인트빈센트그레나딘 | 없음 | 직접 목적지 없음 |
| VE | 베네수엘라 | 없음 | 직접 목적지 없음 |
| VU | 바누아투 | 없음 | 직접 목적지 없음 |
| WS | 사모아 | 없음 | 직접 목적지 없음 |
| YE | 예멘 | 없음 | 직접 목적지 없음 |
| ZM | 잠비아 | 없음 | 직접 목적지 없음 |

### 별도 앱 관할: 코소보 1개

| 코드 | 앱 표시명 | 현재 독립 목적지 | 보완 이유 |
| --- | --- | --- | --- |
| XK | 코소보 | 없음 | 직접 목적지 없음 |

### 유인 별도 지역: 도시·정착지 누락 44개

| 코드 | 앱 표시명 | 현재 독립 목적지 | 보완 이유 |
| --- | --- | --- | --- |
| AI | 앵귈라 | 없음 | 직접 목적지 없음 |
| AS | 아메리칸 사모아 | 없음 | 직접 목적지 없음 |
| AW | 아루바 | 없음 | 직접 목적지 없음 |
| AX | 올란드 제도 | 없음 | 직접 목적지 없음 |
| BL | 생바르텔레미 | 없음 | 직접 목적지 없음 |
| BM | 버뮤다 | 없음 | 직접 목적지 없음 |
| BQ | 네덜란드령 카리브 | 없음 | 직접 목적지 없음 |
| CC | 코코스 제도 | 없음 | 직접 목적지 없음 |
| CK | 쿡 제도 | 없음 | 직접 목적지 없음 |
| CW | 퀴라소 | 없음 | 직접 목적지 없음 |
| CX | 크리스마스섬 | 없음 | 직접 목적지 없음 |
| EH | 서사하라 | 없음 | 직접 목적지 없음 |
| FK | 포클랜드 제도 | 없음 | 직접 목적지 없음 |
| FO | 페로 제도 | 없음 | 직접 목적지 없음 |
| GF | 프랑스령 기아나 | 없음 | 직접 목적지 없음 |
| GG | 건지 | 없음 | 직접 목적지 없음 |
| GI | 지브롤터 | 없음 | 직접 목적지 없음 |
| GL | 그린란드 | 없음 | 직접 목적지 없음 |
| GP | 과들루프 | 없음 | 직접 목적지 없음 |
| GU | 괌 | 괌 (island) | 광역·섬만 있음 |
| IM | 맨섬 | 없음 | 직접 목적지 없음 |
| JE | 저지 | 없음 | 직접 목적지 없음 |
| KY | 케이맨 제도 | 없음 | 직접 목적지 없음 |
| MF | 생마르탱 | 없음 | 직접 목적지 없음 |
| MP | 북마리아나제도 | 사이판 (island) | 광역·섬만 있음 |
| MQ | 마르티니크 | 없음 | 직접 목적지 없음 |
| MS | 몬트세라트 | 없음 | 직접 목적지 없음 |
| NC | 뉴칼레도니아 | 없음 | 직접 목적지 없음 |
| NF | 노퍽섬 | 없음 | 직접 목적지 없음 |
| NU | 니우에 | 없음 | 직접 목적지 없음 |
| PF | 프랑스령 폴리네시아 | 보라보라 (island) | 광역·섬만 있음 |
| PM | 생피에르 미클롱 | 없음 | 직접 목적지 없음 |
| PN | 핏케언 제도 | 없음 | 직접 목적지 없음 |
| PR | 푸에르토리코 | 없음 | 직접 목적지 없음 |
| RE | 레위니옹 | 없음 | 직접 목적지 없음 |
| SH | 세인트헬레나 | 없음 | 직접 목적지 없음 |
| SJ | 스발바르제도-얀마웬섬 | 없음 | 직접 목적지 없음 |
| SX | 신트마르턴 | 없음 | 직접 목적지 없음 |
| TC | 터크스 케이커스 제도 | 없음 | 직접 목적지 없음 |
| TK | 토켈라우 | 없음 | 직접 목적지 없음 |
| VG | 영국령 버진아일랜드 | 없음 | 직접 목적지 없음 |
| VI | 미국령 버진아일랜드 | 없음 | 직접 목적지 없음 |
| WF | 왈리스-푸투나 제도 | 없음 | 직접 목적지 없음 |
| YT | 마요트 | 없음 | 직접 목적지 없음 |
