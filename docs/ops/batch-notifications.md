# 배치 알림 운영 가이드

 DormMate의 냉장고 임박/만료 알림 배치 스케줄러 운영 기준을 정리한 문서다. 운영자는 본 가이드를 기준으로 재시도, 오류 대응, 복구 절차를 수행한다.

## 1. 배치 스케줄 및 현재 동작

- 실행 시각: 매일 09:00 KST에 `FridgeExpiryNotificationScheduler#runDailyBatch`가 한 번 실행된다.
- 현재 버전에는 자동 재시도 로직이 없다. 실패 시 예외가 로깅되고 `notification_dispatch_log`에 `FAILED` 상태가 기록된다.
- 임박 알림 TTL은 24시간, 만료 알림 TTL은 7일이며 dedupe 키는 `{kind}:{userId}:{yyyyMMdd}` 형식으로 하루 한 번 알림만 발송된다.
- 신규 사용자 선호도는 `FRIDGE_EXPIRY`, `FRIDGE_EXPIRED` 알림을 기본 ON으로 생성되며, UI에서 비활성화할 수 있다.

> **향후 계획**  
> 자동 재시도(예: 5분 간격 3회)와 관리자 경보 발송은 미구현이다. 운영 요구가 생기면 재시도 스케줄러 및 경보 체계를 추가하고 본 가이드를 업데이트한다.

## 2. 오류 코드 / 로그 표준화

- `NotificationDispatchLog.errorCode`는 아래 도메인 상수를 사용한다.
  - `EXPIRY_BATCH_FAILED`: 임박 배치 실패
  - `EXPIRED_BATCH_FAILED`: 만료 배치 실패
- `errorMessage`에는 root cause만 기록한다 (예: SQLSTATE, HTTP status 등).
- 애플리케이션 로그는 `[ALERT][Batch][FRIDGE_EXPIRY] attempt=2 user=… errorCode=EXPIRY_BATCH_FAILED detail=…` 포맷으로 남겨 모니터링 시스템이 파싱할 수 있게 한다.
- 성공 시에도 `notification_dispatch_log`에 `status=SUCCESS`, `channel=INTERNAL_BATCH`, `logged_at`을 저장한다(단, 사용자가 백그라운드 수신을 허용한 경우). 실패 시에는 `status=FAILED`, `errorCode`, `errorMessage`를 반드시 기록해 재시도·운영 대응 정보를 한 곳에서 추적한다.
- 아래 표를 참고해 오류 코드별 대응을 수행한다.

| 오류 코드 | 원인 예시 | 즉시 조치 | 재시도 전 확인 사항 |
|-----------|-----------|-----------|---------------------|
| `EXPIRY_BATCH_FAILED` | DB 연결 실패, 쿼리 예외 | 재시도 대기(5분) 후 자동 수행, 3회 실패 시 수동 재실행 | DB 상태 확인, 쿼리 로깅 검토 |
| `EXPIRED_BATCH_FAILED` | 알림 저장 실패, dedupe 충돌 | 자동 재시도, 필요 시 수동 재실행 | 알림 테이블 상태 확인 |

## 3. 수동 재실행 및 복구 절차

1. 장애 원인을 제거했는지 확인한다 (DB/네트워크/시스템 상태).
2. 수동 재실행 명령은 아직 스크립트화되어 있지 않다. 필요 시 `FridgeExpiryNotificationScheduler#runDailyBatch`를 Spring Shell/Actuator 혹은 임시 Admin API로 노출해야 한다.
   - **임시 조치**: 로컬에서 `./auto dev backend --env local` 실행 후 `/admin/notifications/run-expiry-batch`(임시 엔드포인트)와 같은 관리용 API를 마련하거나, IDE에서 빈을 수동 실행한다.
3. 실행 후 `notification_dispatch_log`를 조회해 성공 로그를 확인한다.
4. 여전히 실패 시 운영 채널에 결과와 오류 메시지를 공유하고, 재시도 시점을 합의한다.

## 4. 참고 문서

- 매일 배치 구현 상세: `backend/src/main/java/com/dormmate/backend/modules/notification/application/FridgeExpiryNotificationScheduler.java`
- 알림 및 로그 도메인: `Notification`, `NotificationDispatchLog`
- 상태 보드 진행 이력: `docs/2.2.Status_Board.md` NO-501 섹션

## 5. 회귀 테스트 체크리스트

1. `backend/src/test/java/com/dormmate/backend/modules/notification/FridgeExpiryNotificationSchedulerIntegrationTest.java`를 실행한다. 이 테스트는 고정 Clock과 전용 슬롯 번들/선호도 픽스처를 사용해 `notification`, `notification_dispatch_log`, `notification_preference`를 초기화한 뒤 FRIDGE_EXPIRY/FRIDGE_EXPIRED 알림이 종류당 1건만 생성되는지 확인한다.
2. 실행 명령:  
   ```bash
   cd backend && ./gradlew test --tests com.dormmate.backend.modules.notification.FridgeExpiryNotificationSchedulerIntegrationTest
   ```
3. 테스트가 통과하면 `notification_dispatch_log`에 `INTERNAL_BATCH` 채널 성공 로그가, 실패 시 `EXPIRY_BATCH_FAILED` 또는 `EXPIRED_BATCH_FAILED`가 적재되는지 추가로 점검한다.
4. 코드나 정책을 수정했다면 위 테스트 외에 `./gradlew clean test`를 실행해 `AdminSeedIntegrationTest`까지 함께 통과하는지 확인한다. 해당 테스트는 데모 시드 실행 전 FK 정리 순서를 검증해 `/admin/seed/fridge-demo` 절차가 안전한지 보장한다.
