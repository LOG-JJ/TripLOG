# TripLOG 보안 관리

## 점검 명령

`npm run security:check`는 Git 추적 파일과 Git에서 제외되지 않은 새 파일을 검사합니다. 인식하는 비공개 키·서비스 역할 JWT·토큰 형식과 민감한 파일명, 배포 파일 경계, 앱 HTML·JavaScript의 인라인 이벤트 속성을 검사하며 비밀 값은 출력하지 않습니다. 모든 비밀·개인정보·로직 취약점을 탐지하는 검사는 아닙니다. 소스 검사에도 포함됩니다.

`npm run security:audit`는 위 검사 뒤 잠금 파일의 npm 취약점 감사를 실행합니다. 레지스트리 연결이 필요하며 감사 당시 알려진 의존성 취약점만 확인합니다. 직접 보관한 OCR·폰트·지도 라이브러리의 라이선스·SHA256과 공급망 검토는 별도로 유지합니다.

`npm run build`도 보안 검사를 먼저 실행합니다. Git 추적 여부와 관계없이 실제 배포 목록의 텍스트도 검사하므로, 무시된 로컬 파일이 배포 목록에 들어와 검사를 우회하지 않게 합니다.

## 인증과 데이터 경계

- `src/app/data/service-config.js`의 Supabase publishable 키는 공개 클라이언트 설정입니다. `service_role`·secret 키는 브라우저나 Git에 넣지 않습니다.
- Edge는 사용자 bearer 토큰을 검증한 뒤 서비스 역할 클라이언트를 만들고, 여행·작업별 권한과 입력 크기·타입을 검사합니다. DB의 서비스 역할 전용 함수와 RLS도 함께 유지합니다.
- CLI 프로필은 HTTPS 또는 loopback 테스트 주소를 사용합니다. Windows 저장형 세션은 DPAPI로 보호하고, 토큰·비밀번호를 프로세스 인자나 로그에 넣지 않습니다.
- 테스트에는 격리 fixture와 `TRIPLOG_CLI_HOME`을 사용합니다. 운영 인증·DB·저장소를 초기화하지 않습니다.

## 브라우저 실행 정책

`_headers`의 CSP는 같은 출처의 스크립트와 필요한 Google Maps 스크립트 출처만 허용합니다. 인라인 스크립트·이벤트 핸들러와 문자열 JavaScript 평가는 허용하지 않습니다. OCR의 WebAssembly에는 `wasm-unsafe-eval`, 로컬 OCR Worker에는 `worker-src 'self' blob:`을 사용합니다. 이 WebAssembly 허용은 JavaScript `unsafe-eval`과 다릅니다. [MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)를 참고합니다.

임베디드 객체는 차단하고, base URL과 폼 제출은 같은 출처로 제한하며, 다른 페이지의 앱 프레이밍은 차단합니다. 리포트 출력은 같은 출처의 base URL을 사용할 수 있습니다. 정책의 목적과 방어 범위는 [OWASP CSP 지침](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)을 참고합니다. 지도·사용자 설정 서버의 통신까지 제한하는 `connect-src` 정책은 이번 범위에 포함하지 않습니다.

진입·복구 스크립트는 `src/entry/`에서 로드합니다. 로그인 SDK의 재시도도 `/vendor/supabase-js-2.107.0.min.js`를 사용하며 외부 CDN으로 전환하지 않습니다. 새 외부 스크립트가 필요하면 CSP·공급망·브라우저 회귀 검사를 함께 검토합니다.

미리보기 서버는 `_headers`의 전역 보안 헤더를 적용합니다. 합성 데이터 미리보기는 fixture 주입을 위한 자체 정책을 사용할 수 있으며 운영 배포 목록에서 제외됩니다.

## 배포 파일과 로컬 미리보기

`scripts/app-assets.js`가 빌드와 오프라인 캐시의 배포 목록을 소유합니다. `src/app`·`src/entry`는 JavaScript, `src/styles`는 CSS, 자산은 허용한 이미지·폰트·OCR 형식과 라이선스만 포함합니다. 예상하지 않은 파일·숨김 경로·심볼릭 링크가 실행 폴더에 들어오면 빌드를 실패시킵니다.

루트의 공개 주소가 필요한 로더·기본 스타일·복구 HTML·매니페스트·아이콘은 같은 목록에서 소스 경로를 명시합니다. 배포와 미리보기는 원래 공개 주소에 연결하고, 보안 검사는 해당 소스 파일을 읽습니다.

미리보기는 이 배포 목록의 공개 파일만 제공하며, loopback Host·GET/HEAD만 허용합니다. 파일을 읽기 전에 실제 경로도 확인합니다. 임시 파일·QA·문서·테스트·CLI·Supabase 서버 코드는 웹으로 제공하지 않습니다. `.gitignore`는 로컬 `.env`, 개인 키·인증서와 DPAPI 세션 파일을 제외합니다.

## 점검의 한계

저장소 점검과 격리 테스트로 운영 환경의 실제 RLS·마이그레이션 적용 상태, Edge 설정, HTTPS 응답 헤더까지 확인할 수는 없습니다. 배포 뒤에는 해당 서비스의 결과와 실제 응답을 별도로 확인합니다. 외부 지도·Google API·실제 계정 인증·모든 OCR 언어 조합도 격리 테스트와 별도 통합 확인이 필요합니다.
