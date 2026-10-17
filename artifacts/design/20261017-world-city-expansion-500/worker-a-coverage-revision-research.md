# Worker A 보완 단계 재생성 근거

2026-10-17에 산후안과 콕번타운의 PC·모바일 쌍을 각각 새 T2I 호출로 보완했다. 이미지 입력은 사용하지 않았다. 최종 프롬프트는 해당 `jobs/*.prompt.txt`와 JSON에 기록되어 있고, 이전 프롬프트·원본·WebP는 `revisions/worker-a-coverage-r2-framing-and-museum/`에 SHA256과 함께 보존했다.

산후안의 최초 이미지는 모로 요새의 주 성벽이 화면 오른쪽에서 잘렸다. 최종 프롬프트는 성벽 끝과 돔형 초소까지 프레임 안에 넣는 넓은 구도, 오른쪽 투명 여백, 아래쪽 잔디 진입로를 명시한다.

콕번타운의 최초 이미지는 Guinep House를 일반적인 회색 지붕 주택으로 표현했고 두 방향의 지붕 구성도 달랐다. [박물관의 Guinep House 소개](https://www.tcmuseum.org/about-the-museum/guinep-house/)에서 실제 박물관 건물, 흰 석회암 구조, 이름의 근원이 되는 guinep 나무와 증축 이력을 확인했다. [Visit Turks and Caicos의 Grand Turk 소개와 현장 사진](https://www.visittci.com/grand-turk/about)은 흰 벽, 붉은 금속 지붕, 녹색 셔터와 베란다를 보여준다. 이 특징을 텍스트로 명시해 두 방향의 건물 정체성을 맞췄다.

보완 결과는 실제 헤더 320·390·1440px에서 검사했다. 산후안 성벽과 모든 주요 초소, 콕번타운 박물관 지붕과 벽이 완전히 보이며, 실제 그림이 카드 오른쪽과 아래쪽에 연결된다.
