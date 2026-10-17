# 국내 도시 삽화 생성 작업 사용법

승인된 city-plan.json에서 artworkAction=create인 80개 목적지를 PC·모바일 독립 구도로 준비한 160개 T2I 작업입니다.

## 작업과 호출

- 전체 순서: job-manifest.json
- 도시별 영어 소재: motifs-en.json
- 개별 작업: jobs/<도시 ID>-landscape.json 또는 jobs/<도시 ID>-mobile.json
- 호출에 보낼 최종 영문 프롬프트: jobs/<작업 ID>.prompt.txt
- 각 작업의 callArguments를 image_gen에 그대로 전달합니다.
- transparent_background=true를 유지합니다. referenced_image_paths와 num_last_images_to_include는 모두 생략합니다.
- 파일럿은 인천·수원·보성·울릉도 각 PC/모바일 8개이며 manifest 앞부분에 배치되어 있습니다.
- PC는 800×480, 모바일은 480×600입니다. 같은 목적지의 두 그림은 동일한 소재·팔레트·선 특성을 사용하되 각 방향에 맞춰 따로 생성합니다.

공통 스타일은 짙은 남색의 굵고 일정한 외곽선, 넓고 둥근 단순 형태, 작은 파스텔 팔레트, 매우 적은 색연필 강조, 최소 음영입니다. 세밀한 건축 해칭·사실적인 수면 반사·수채화 번짐·사진형 표현을 사용하지 않습니다. 왼쪽은 유기적인 투명 외곽과 조용한 좌상단을 유지하고 그림의 바닥·물·식생은 오른쪽과 하단에 닿게 합니다.

## 정확한 생성 원본 저장

호출 직전의 시간과 해당 호출이 반환한 정확한 원본 PNG 절대 경로를 기록합니다. 생성 폴더 전체 또는 최신 파일 검색으로 원본을 선택하지 않습니다.

프로젝트 루트에서 실행하는 예시:

    python artifacts/tmp/20261017-domestic-city-expansion/save-exact-city-image.py --job kr-incheon-landscape --source 'C:/Users/.../generated_images/.../exec-EXACT.png' --started-at '2026-10-17T14:00:00+09:00' --tool-call-id 'exec-EXACT'

예시 경로·시간은 실제 호출 결과로 바꿉니다. jobs/*.json의 prompt와 해당 prompt.txt는 그 호출의 최종 프롬프트와 일치해야 합니다. 다른 프롬프트로 만든 파일럿 시도는 이 작업에 저장하지 않고 별도의 시도 기록으로 보존합니다.

도우미 출력:

1. assets-original/<작업 ID>.png — 도구 원본과 바이트가 같은 보존본
2. assets-original/<작업 ID>.json — 정확한 도구 원본 경로·SHA256·최종 프롬프트·T2I·빈 이미지 입력·시작 시각 기록
3. src/assets/trip-scenes/cities/v5/<도시 ID>[-mobile].webp — 정확한 목표 규격의 실행 자산
4. assets-original/<작업 ID>.asset.json — 변환·트림·출력 크기·해시·용량 기록
5. assets-original/_source-claims/<원본 SHA256>.json — 동일 원본을 서로 다른 작업에 할당하지 못하도록 하는 기록

원본은 변경하지 않습니다. 실행용 변환은 왼쪽·위 투명 영역을 유지하면서 완전히 투명한 오른쪽·아래 여백만 제거한 뒤 기존 준비 도구와 같은 비율 유지·우하단 기준 fit을 적용합니다. WebP는 alpha를 유지하고 품질 90으로 기록합니다.

원본에 투명 픽셀이 없거나 이미지가 비어 있으면 원본과 생성 기록은 보존하고 실행 자산 승격은 중단합니다. 변환 완료 상태는 prepared-pending-visual-qa이며, 주피사체 잘림·빈 공간·실제 화면 크기별 연결은 후속 화면 검증으로 판단합니다.

## 동시 작업

서로 다른 작업은 병렬 저장할 수 있습니다. 작업별 잠금 파일과 원본 SHA256별 독점 기록을 사용하고 공유 진행 파일을 덮어쓰지 않습니다. 같은 작업의 같은 원본 저장은 재시도할 수 있으나, 다른 원본이나 다른 프롬프트로 기존 파일을 덮어쓰지 않습니다. 중단 후 남은 잠금은 해당 프로세스가 끝난 것을 확인한 뒤 처리합니다.

## 준비 검증

check-save-helper.py는 격리된 임시 폴더의 합성 RGBA 이미지로 다음을 확인합니다: 원본 바이트·SHA256 보존, 800×480/480×600 출력, alpha 보존, 우하단 투명여백만 제거, 병렬 저장, 동일 작업 재시도, 다른 작업의 동일 원본 거부, 투명성이 없는 원본 보존과 실행 자산 차단, 원자적 독점 저장. 실제 프로젝트 실행 자산을 생성하지 않습니다.

