# DormMate 보안 검증 체크리스트
*용도: MVP 범위에서 보안·음성(부정) 흐름을 재현할 때 따라야 할 API 호출 순서와 검증 절차를 제공하는 실행 가이드다.*
*목적: `docs/2.Demo_Scenario.md`에 정의된 부정(음성) 흐름과 보안 시나리오를 API 호출 순서대로 재현하기 위한 실행 가이드를 제공한다. 테스트 전 `docs/1.Feature_Inventory.md`, `docs/2.1.Demo_Plan.md`, `docs/data-model.md`의 정책과 시드 데이터를 최신 상태로 동기화한다.*

> **실행 원칙**
> - 모든 호출은 HTTPS 환경과 정책에 맞는 도메인/포트를 사용한다.
> - 실패 케이스 검증 후에는 `audit_log`, `notification_dispatch_log`, 인증 서버 로그 등을 확인하고, 필요 시 초기 상태로 롤백한다.
> - Postman/자동화 스크립트는 `tools/testing/security/` 하위에서 관리하고, 여기 정의된 순서를 그대로 따른다.

---

## 1. 인증/세션 음성 시나리오

> **사전 준비**: `alice` 정상 계정, `disabled_user` 비활성 계정, 관리자 `admin`.  
> **공통 헤더**: `Content-Type: application/json`
>
> **현재 구현 안내**  
> - 지원 엔드포인트: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/profile/me`만 무상태로 열려 있다.  
> - 세션 구조: `user_session`에 리프레시 해시·`device_id`·만료(기본 7일)가 저장되며, 리프레시 시 deviceId 불일치면 `DEVICE_MISMATCH`로 세션이 즉시 폐기된다. 액세스 토큰은 데모 기준 45초, 리프레시는 5분(`application-prod.properties` 기본값).  
> - 계정 잠금/해제 API, 비밀번호 재설정은 미구현 상태다. 잠금 시나리오는 401 응답 확인 수준으로만 검증하고 AU-103 일정에 남겨 둔다.

### A1. 로그인 실패 반복
- **Method & Path**: `POST /auth/login`
- **Body**
  ```json
  { "loginId": "alice", "password": "wrong-pass", "deviceId": "qa-lock-test" }
  ```
- **실행**: 동일 요청을 여러 차례 반복.
- **기대 결과**: 매 요청 401. 별도 잠금/지연 정책은 없음(미구현).
- **추가 검증**: 실패 후 `AuthService` 로그에서 `LOGIN_FAILED` 메시지 확인(감사 로그 스키마 없음).

### A2. 비활성 계정 로그인 차단
- **Method & Path**: `POST /auth/login`
- **Body**
  ```json
  { "loginId": "disabled_user", "password": "any-value", "deviceId": "qa-disabled-test" }
  ```
- **기대 결과**: 401 또는 403과 함께 비활성 안내 메시지. 계정 잠금 해제 API 없음.

### A3. 세션 만료 후 API 접근
- **Method & Path**: `GET /fridge/bundles`
- **Headers**: `Authorization: Bearer {만료된 accessToken}`
- **기대 결과**: 401/419 응답 → 프론트는 재로그인 플로우로 전환.
- **추가 검증**: 서버 로그에서 `SESSION_EXPIRED` 이벤트 확인.

### A4. 만료된 Refresh 토큰 재사용
- **Method & Path**: `POST /auth/refresh`
- **Body**
  ```json
  { "refreshToken": "{expiredToken}", "deviceId": "qa-refresh-expired" }
  ```
- **기대 결과**: 401 응답. 기존 세션이 강제 종료되며 새 토큰 발급 불가.
- **추가 검증**: `audit_log`에 `REFRESH_TOKEN_EXPIRED` 기록, 세션 테이블에서 만료 여부 확인.

### A5. Refresh 토큰 재사용/디바이스 불일치 차단
- **Method & Path**: `POST /auth/refresh`
- **Body (1차 요청)**
  ```json
  { "refreshToken": "{validToken}", "deviceId": "qa-refresh-reuse-1" }
  ```
- **Body (2차 요청, 동일 토큰)**: `deviceId` 변경 가능.
- **기대 결과**: 최초 요청만 200. 두 번째 요청 또는 deviceId 변경 시 401 `DEVICE_MISMATCH`로 기존 세션 폐기.
- **추가 검증**: `user_session.revoked_reason=DEVICE_MISMATCH` 확인.

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

### C5. 관리자 강제 종료
- **Method & Path**: `DELETE /fridge/inspections/{sessionId}`
- **Headers**: `Authorization: Bearer {adminAccessToken}`
- **기대 결과**: 204 응답, 칸 잠금 해제(`is_locked=false`, `locked_until=NULL`). 층별장 권한으로 동일 요청 시 403 응답을 확인한다.
- **추가 검증**: `/fridge/slots?view=full` 재호출 시 해당 칸의 `locked` 필드가 즉시 갱신되는지 확인한다.

---

## 4. 알림 정책 음성 검증

> **상태**: 알림 설정/배치는 구현되어 있으며, 임박/만료 배치는 매일 09:00에 스케줄러(`FridgeExpiryNotificationScheduler`)가 실행한다. 수동 트리거 API는 없다.

### D1. 검사 결과 알림 OFF
- **Method & Path**: `PATCH /notifications/preferences/FRIDGE_RESULT`
- **Body**
  ```json
  { "enabled": false, "allowBackground": false }
  ```
- **기대 결과**: 200 응답, `notification_preference`에 enabled=false 반영.
- **추가 검증**: 이후 `POST /fridge/inspections/{sessionId}/submit` 시 해당 사용자에게 알림이 생성되지 않는다.

### D2. 백그라운드 허용 OFF
- **Method & Path**: `PATCH /notifications/preferences/FRIDGE_EXPIRY`
- **Body**
  ```json
  { "enabled": true, "allowBackground": false }
  ```
- **기대 결과**: 200 응답. 임박/만료 배치 실행 후 `notification_dispatch_log`에서 해당 사용자가 SUCCESS 채널에서 제외되거나 `allowBackground=false` 메타데이터가 반영됐는지 확인.

### D3. 알림 dedupe 확인
- **Method & Path**: `POST /fridge/inspections/{sessionId}/submit`을 동일 세션/사용자 조합으로 2회 호출.
- **기대 결과**: 첫 호출만 `FRIDGE_RESULT` 알림 생성, 두 번째는 `notification` 테이블에 추가 레코드 없음(`dedupe_key=FRIDGE_RESULT:<sessionId>:<userId>`).

### D4. 임박 배치 스케줄 확인
- **Action**: 09:00 cron 직후 로그 또는 `notification_dispatch_log` 확인.
- **기대 결과**: `channel=INTERNAL_BATCH`, 성공/실패 코드 기록. 배치 수동 트리거 API 없음.

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

## 5. 검사 정정·알림·벌점 검증

> ADMIN만 `/fridge/inspections/{sessionId}` PATCH를 호출할 수 있습니다. 정정 시 `penalty_history`, `notification`, `audit_log`가 함께 갱신되므로 각 항목을 검증합니다.

### C1. ADMIN 검사 정정 성공
- **Method & Path**: `PATCH /fridge/inspections/{sessionId}`
- **Headers**: `Authorization: Bearer {adminAccessToken}`
- **Body**
  ```json
  {
    "notes": "정정 시나리오",
    "mutations": [
      { "actionId": 101, "action": "WARN_INFO_MISMATCH", "note": "메모 수정" }
    ],
    "deleteActionIds": [102]
  }
  ```
- **기대 결과**: 200 응답. 응답 본문에 수정된 메모·조치가 반영되고 `actions[].actionType`이 변경된다.
- **추가 검증**: `penalty_history`에서 삭제된 조치와 연결된 벌점이 제거됐는지 확인하고, `audit_log`에 `INSPECTION_ADJUST` 이벤트가 층/slotIndex/변경 건수 메타데이터로 기록됐는지 확인한다.

### C2. 비ADMIN 정정 차단
- **Headers**: `Authorization: Bearer {floorManagerAccessToken}` (또는 거주자 토큰)
- **기대 결과**: 403 `ADMIN_ONLY`. 프런트에서도 정정 버튼이 노출되지 않아야 하며, 강제 호출 시 동일 오류가 반환된다.

### C3. 정정 후 알림·벌점 재검증
- **Step 1**: `GET /notifications?state=all` — 정정된 검사 알림의 `metadata.penaltyHistoryIds`가 최신 값인지 확인한다.
- **Step 2**: 필요 시 재발송 기능(향후 `/fridge/inspections/{sessionId}/notifications/resend`)을 테스트하고, 중복 발송이 dedupe 키로 차단되는지 확인한다.

## 6. 데모 데이터 초기화 안전 장치

> `/admin/seed/fridge-demo`는 **데모/스테이징 전용**입니다. 실행 시 냉장고/검사/벌점 데이터가 전시용으로 재삽입되므로 운영 DB에서는 절대 호출하지 마세요.

### D1. 권한 검증
- **Method & Path**: `POST /admin/seed/fridge-demo`
- **Headers**: ADMIN / 비ADMIN 토큰
- **기대 결과**: ADMIN만 200 응답과 함께 `"message": "FRIDGE_DEMO_DATA_REFRESHED"`. 비ADMIN은 403.
- **추가 검증**: `audit_log`에 `FRIDGE_DEMO_SEED_EXECUTED` 이벤트가 기록되고 `metadata.script`가 `db/demo/fridge_exhibition_items.sql`인지 확인한다.

### D2. 데이터 주입 확인
- `SELECT COUNT(*) FROM fridge_bundle WHERE bundle_name LIKE '전시 데모:%';` → 7 유지.
- `SELECT COUNT(*) FROM penalty_history WHERE source = 'FRIDGE_INSPECTION' AND reason LIKE '전시 데모%';` → 데모용 벌점이 주입됐는지 확인.
- `/admin/fridge` UI에서 전시 포장/검사 카드가 바로 나타나고, 검사 정정 시나리오를 곧바로 실행할 수 있는지 확인한다.


---

## 7. 실행 후 정리

1. 생성된 테스트 알림·포장·검사 세션 데이터를 정리한다. (필요 시 `./auto cleanup` 활용)
2. 계정 잠금·비활성 상태를 원복한다.
3. Postman 컬렉션/환경 변수는 `tools/testing/security/` 디렉터리에 버전 관리한다.
4. 실행 로그와 결과를 팀 지정 채널(예: 회고 문서, 이슈 코멘트)에 공유한다.

> **TIP**: API 호출 자동화를 위해 Postman 스크립트에서 `pm.variables.set('authToken', ...)` 형태로 토큰을 저장하고, 실패 응답 시 로그/스크린샷을 자동 첨부하도록 구성하면 회귀 테스트가 수월하다.
