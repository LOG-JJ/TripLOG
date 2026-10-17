# 후속 대표 도시 그림의 외형 보강

2026-10-17. 생성 전 텍스트 설명을 보강했으며 사진은 생성 입력으로 첨부하지 않았다. 원래 계획의 소재·도시는 유지한다.

- 더밸리 Wallblake House: [현지 숙박업체의 시설 소개 사진](https://www.carimar.com/destination/anguilla-history)을 보조 자료로 사용했다. 낮은 석조 기단 위의 흰 목조 층, 급경사 어두운 지붕, 덧문과 외부 계단을 표현한다. 역사적 사실은 기존 관광청 출처를 유지한다.
- 누크 Katuaq: [문화센터 자체 설명](https://katuaq.gl/en/about-katuaq)은 목재·유리의 완만한 물결 모양 외벽을 설명한다. 낮고 넓은 현대 건물로 한정한다.
- 조지타운: [케이맨 국립박물관 공식 사진](https://www.museum.ky/museumbuilding)을 검색 결과에서 확인했다. 본문 직접 가져오기는 404였으므로 사진에서 확인 가능한 흰 목조 외벽·붉은 지붕·녹색 덧문·베란다와 계단만 보강했다.
- 가라판: [NPS의 기념공원 시설 설명](https://www.nps.gov/amme/planyourvisit/placestogo.htm)과 [ABMC 2024 복원 사진](https://www.abmc.gov/wordpress-uploads/20240913-Saipan-Memorial-03-2048x1536.jpg)을 확인했다. ABMC 사진은 브라우저에서 직접 보았다. 카리용은 지붕 없는 붉은 직사각 탑이며 위쪽 루버·열린 벨 구간, 낮은 곡선 벽과 별도 화강암 기념주를 가진다.

변경한 8개 프롬프트의 변경 전·후 SHA256은 `prompt-refinement-root-coverage.json`에 기록했다.

## 생피에르 생성 후 교정

처음 생성한 두 등대는 굵고 완전한 흰 탑과 인접 관리인 집으로 표현되어 실제 Pointe aux Canons와 달랐다. 기존 [공식 관광청 일정](https://en.spm-tourisme.fr/saint-pierre-between-land-and-sea/)은 도시와 등대 소재의 관계를 확인한다. 외형은 [현지 Eléa Guided Tours의 현장 사진](https://www.eleaguidedtours.com/saint-pierre)을 브라우저에서 직접 보아 보강했다. 가늘고 단면이 각진 흰 탑의 중간에 넓은 붉은 가로 띠가 한 개 있으며, 낮고 긴 방파제 끝에 홀로 서 있다. 큰 관리인 집이나 언덕은 없애고 뒤쪽 시가지는 물 건너 작게 표현한다. 사진은 생성 입력으로 제공하지 않고 독립 T2I로 두 장을 교체한다.

## 가라판 생성 후 교정

첫 생성에서는 탑의 개방 구간이 지면부터 상단까지 길게 뻗고 여러 종을 사다리처럼 배치했다. 위에서 직접 확인한 ABMC 공식 사진에서는 탑 하부 대부분이 막힌 붉은 기둥이며 짧은 종 개방 구간은 상부에만 있다. PC·모바일 두 장을 해당 구조로 구체화하여 다시 T2I 생성한다. 이전 두 장과 호출 기록은 `revisions/root-coverage-r2/`에 보존한다.
