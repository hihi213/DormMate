# DormMate 보안 검증 체크리스트
*용도: MVP 범위에서 보안·음성(부정) 흐름을 재현할 때 따라야 할 API 호출 순서와 검증 절차를 제공하는 실행 가이드다.*
*목적: `docs/mvp-scenario.md`에 정의된 부정(음성) 흐름과 보안 시나리오를 API 호출 순서대로 재현하기 위한 실행 가이드를 제공한다. 테스트 전 `docs/feature-inventory.md`, `docs/mvp-implementation-plan.md`, `docs/data-model.md`의 정책과 시드 데이터를 최신 상태로 동기화한다.*

> **실행 원칙**
> - 모든 호출은 HTTPS 환경과 정책에 맞는 도메인/포트를 사용한다.
> - 실패 케이스 검증 후에는 `audit_log`, `notification_dispatch_log`, 인증 서버 로그 등을 확인하고, 필요 시 초기 상태로 롤백한다.
> - Postman/자동화 스크립트는 `tools/testing/security/` 하위에서 관리하고, 여기 정의된 순서를 그대로 따른다.

---

## 1. 인증/세션 음성 시나리오

> **사전 준비**: `alice` 정상 계정, `disabled_user` 비활성 계정, `admin`으로 잠금 해제 가능.  
> **공통 헤더**: `Content-Type: application/json`

### A1. 로그인 실패 누적 잠금
- **Method & Path**: `POST /auth/login`
- **Body**
  ```json
  { "loginId": "alice", "password": "wrong-pass", "deviceId": "qa-lock-test" }
  ```
- **실행**: 동일 요청을 5회 연속 수행.
- **기대 결과**: 401 응답. 5회 이상 실패 시 계정 잠금 또는 지연 정책이 적용되어 추가 로그인 차단.
- **추가 검증**: `audit_log`에 `LOGIN_FAILED` 이벤트가 누적 기록되는지 확인.

### A2. 잠금 지속 여부 확인
- **Method & Path**: `POST /auth/login`
- **Body**
  ```json
  { "loginId": "alice", "password": "correct-pass", "deviceId": "qa-lock-test" }
  ```
- **기대 결과**: 423 또는 401 응답으로 잠금이 유지되고, 응답 메시지에 잠금 안내가 포함.
- **추가 검증**: 관리자 UI/DB에서 사용자 상태가 `LOCKED`로 표시되는지 확인.

### A3. 관리자 잠금 해제
- **Method & Path**: (관리자용) `PATCH /admin/users/{userId}/unlock`
- **Body**
  ```json
  { "reason": "security-test-reset" }
  ```
- **기대 결과**: 200 또는 204 응답. 계정 상태가 즉시 정상으로 전환.
- **추가 검증**: `audit_log`에 `LOGIN_UNLOCKED` 이벤트, 또는 관리자 작업 로그 확인.  
  > *주*: 실제 관리자 API 경로/페이로드는 구현 내용에 따라 확인 필요. 인가가 UI에서만 가능하다면 수동 조치로 대체.

### A4. 비활성 계정 로그인 차단
- **Method & Path**: `POST /auth/login`
- **Body**
  ```json
  { "loginId": "disabled_user", "password": "any-value", "deviceId": "qa-disabled-test" }
  ```
- **기대 결과**: 401 또는 403 응답과 함께 비활성 계정 안내가 반환.
- **추가 검증**: `audit_log`에 `LOGIN_DISABLED` 혹은 유사 이벤트 기록.

### A5. 세션 만료 후 API 접근
- **Method & Path**: `GET /fridge/bundles`
- **Headers**: `Authorization: Bearer {만료된 accessToken}`
- **기대 결과**: 401/419 응답 → 프론트는 재로그인 플로우로 전환.
- **추가 검증**: 서버 로그에서 `SESSION_EXPIRED` 이벤트 확인.

### A6. 만료된 Refresh 토큰 재사용
- **Method & Path**: `POST /auth/refresh`
- **Body**
  ```json
  { "refreshToken": "{expiredToken}", "deviceId": "qa-refresh-expired" }
  ```
- **기대 결과**: 401 응답. 기존 세션이 강제 종료되며 새 토큰 발급 불가.
- **추가 검증**: `audit_log`에 `REFRESH_TOKEN_EXPIRED` 기록, 세션 테이블에서 만료 여부 확인.

### A7. Refresh 토큰 재사용 방지
- **Method & Path**: `POST /auth/refresh`
- **Body (1차 요청)**
  ```json
  { "refreshToken": "{validToken}", "deviceId": "qa-refresh-reuse-1" }
  ```
- **Body (2차 요청, 동일 토큰)**: `deviceId` 변경 가능.
- **기대 결과**: 최초 요청만 200 응답, 두 번째 요청은 401.
- **추가 검증**: 감사 로그에 `REFRESH_TOKEN_REUSE` 기록, 해당 토큰이 무효화되는지 확인.

---

## 2. 냉장고 포장 접근 제어

> **공통 헤더**: `Authorization: Bearer {accessToken}`

### B1. 타인 포장 수정 차단
- **Method & Path**: `PATCH /fridge/bundles/{bundleId}`
- **Headers**: `Authorization: Bearer {aliceAccessToken}`
- **Body**
  ```json
  { "bundleName": "Intrusion Test", "memo": "should not update" }
  ```
- **기대 결과**: 403 응답. 포장 내용은 변경되지 않는다.
- **추가 검증**: `audit_log`에 `FRIDGE_BUNDLE_ACCESS_DENIED`(또는 동등한 이벤트)가 남는지 확인.

### B2. 타인 포장 삭제 차단
- **Method & Path**: `DELETE /fridge/bundles/{bundleId}`
- **Headers**: `Authorization: Bearer {aliceAccessToken}`
- **기대 결과**: 403 응답. 라벨 시퀀스/데이터베이스에 삭제 흔적이 없어야 한다.

### B3. 타층 칸 접근 차단
- **Method & Path**: `GET /fridge/bundles?slotCode=2F-A-01`
- **Headers**: `Authorization: Bearer {dianaAccessToken}` (3층 거주자)
- **기대 결과**: 403 응답 또는 빈 결과. UI에서 해당 칸이 노출되지 않아야 한다.

### B4. 층별장 권한 없는 사용자 수정 시도
- **Method & Path**: `PATCH /fridge/bundles/{bundleId}`
- **Headers**: `Authorization: Bearer {charlieAccessToken}` (층별장 미승격 상태)
- **Body**
  ```json
  { "bundleName": "Unauthorized Edit" }
  ```
- **기대 결과**: 403 응답. 층별장으로 승격되기 전에는 수정 불가.
- **추가 검증**: 권한 승격 후 동일 요청이 성공하는지 대비 테스트.

---

## 3. 검사 세션 권한

> **공통 헤더**: `Authorization: Bearer {accessToken}`

### C1. 일반 거주자 검사 세션 생성 차단
- **Method & Path**: `POST /fridge/inspections`
- **Headers**: `Authorization: Bearer {aliceAccessToken}`
- **Body**
  ```json
  { "compartmentId": "{targetCompartmentId}" }
  ```
- **기대 결과**: 403 응답.
- **추가 검증**: `audit_log`에 `INSPECTION_FORBIDDEN` 이벤트 기록.

### C2. 일반 거주자 검사 조치 입력 차단
- **Method & Path**: `POST /fridge/inspections/{sessionId}/actions`
- **Headers**: `Authorization: Bearer {aliceAccessToken}`
- **Body**: 실제 DTO(`InspectionActionRequest`)에 맞게 구성.
- **기대 결과**: 403 응답, 세션 상태 변화 없음.

### C3. 층별장 권한 해제 후 재시도
- **사전 단계**: `bob`이 층별장으로 세션을 시작한 직후 `admin`이 `bob`의 `FLOOR_MANAGER` 역할을 해제.
- **Method & Path**: `POST /fridge/inspections`
- **Headers**: `Authorization: Bearer {bobAccessToken}`
- **기대 결과**: 403 응답으로 즉시 차단.
- **추가 검증**: 해제 이후 기존 세션 접근(`GET /fridge/inspections/{sessionId}`)도 거부되는지 확인.

### C4. SSE 토큰 만료 재구독 (향후 확장)
- MVP 범위에서는 SSE 스트림이 제공되지 않는다. 실시간 동기화 도입 시 아래 항목을 보강한다.
- **예상 Method & Path**: `GET /fridge/inspections/{sessionId}/stream`
- **Headers**: `Authorization: Bearer {expiredToken}`
- **기대 결과**: 서버가 즉시 연결 종료, 감사 로그에 위조/만료 토큰 기록.

---

## 4. 알림 정책 음성 검증

> **상태**: 알림 설정/배치 관련 공개 API가 아직 구현되지 않은 것으로 보인다. 구현 완료 시 아래 항목에 실제 Method & Path, Request DTO를 기입하고 검증을 수행한다.

### D1. 검사 결과 알림 OFF 설정
- **예상 Method & Path**: `PATCH /notifications/preferences/{kindCode}`
- **Body**
  ```json
  { "isEnabled": false }
  ```
- **기대 결과**: 200 응답. `notification_preference`에서 해당 kind가 비활성화.
- **추가 검증**: `audit_log`에 `NOTIFICATION_PREFERENCE_UPDATED` 기록.

### D2. 검사 결과 알림 미발송 확인
- **Method & Path**: `POST /fridge/inspections/{sessionId}/submit` (층별장 계정)
- **기대 결과**: 알림 비활성 사용자에게 `FRIDGE_RESULT` 알림이 생성되지 않는다.

### D3. 백그라운드 허용 OFF 설정
- **예상 Method & Path**: `PATCH /notifications/preferences/{kindCode}`
- **Body**
  ```json
  { "allowBackground": false }
  ```
- **기대 결과**: 200 응답. 해당 사용자는 푸시 송신 목록에서 제외.

### D4. 임박 배치 수동 실행
- **예상 Method & Path**: `POST /admin/notifications/trigger-expiry`
- **기대 결과**: 백그라운드 허용 OFF 사용자(`diana`)는 푸시 미발송, 앱 내 레코드만 생성.
- **추가 검증**: `notification_dispatch_log`에서 제외 여부 확인.

### D5. 배치 재실행
- 동일 배치를 같은 일시에 재실행했을 때 새 알림이 생성되지 않는지 확인(`dedupe_key` 활용).

---

## 5. 세션·토큰 회귀 및 감사

### E1. SSE 연결 중 토큰 만료
- **상태**: MVP에서는 SSE가 비활성화되어 검증 대상이 아니다. 실시간 검사 합류 기능을 도입하는 시점에 테스트 케이스를 작성한다.
- **기대 결과**: 토큰 만료 시 서버가 401 이벤트 전달 후 연결 종료. 재연결 시 신선 토큰 필요.

### E2. 세션 만료 후 프론트 반응
- **액션**: 만료된 세션으로 웹 UI를 새로 고침.
- **기대 결과**: 로그인 페이지(또는 세션 만료 안내)로 리다이렉트.
- **추가 검증**: 브라우저 콘솔/네트워크에서 401 응답 확인.

### E3. 감사 로그 검증
- **쿼리 예시**
  ```sql
  SELECT action, actor_user_id, created_at
  FROM audit_log
  ORDER BY created_at DESC
  LIMIT 20;
  ```
- **기대 결과**: 앞선 테스트에서 발생한 실패/차단 이벤트가 모두 기록되어야 한다.

---

## 6. 실행 후 정리

1. 생성된 테스트 알림·포장·검사 세션 데이터를 정리한다. (필요 시 `./auto cleanup` 활용)
2. 계정 잠금·비활성 상태를 원복한다.
3. Postman 컬렉션/환경 변수는 `tools/testing/security/` 디렉터리에 버전 관리한다.
4. 실행 로그와 결과를 팀 지정 채널(예: 회고 문서, 이슈 코멘트)에 공유한다.

> **TIP**: API 호출 자동화를 위해 Postman 스크립트에서 `pm.variables.set('authToken', ...)` 형태로 토큰을 저장하고, 실패 응답 시 로그/스크린샷을 자동 첨부하도록 구성하면 회귀 테스트가 수월하다.
