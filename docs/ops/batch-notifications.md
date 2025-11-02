# 배치 알림 운영 가이드

DormMate의 냉장고 임박/만료 알림 배치 스케줄러 운영 기준을 정리한 문서다. 운영자는 본 가이드를 기준으로 재시도, 오류 대응, 복구 절차를 수행한다.

## 1. 배치 스케줄 및 재시도 정책

- 실행 시각: 매일 09:00 KST에 `FridgeExpiryNotificationScheduler`가 기동한다.
- 기본 재시도 규칙
  - 실패 시 5분 간격으로 최대 3회 자동 재시도 (환경 변수 `NOTIFICATION_BATCH_MAX_RETRY`, `NOTIFICATION_BATCH_RETRY_INTERVAL_MINUTES`로 조정 가능).
  - 재시도 중에도 dedupe 키는 동일하게 유지하여 동일 사용자에게 중복 알림이 생성되지 않도록 한다.
  - 재시도 횟수 및 상태는 애플리케이션 로그에 `[ALERT][Batch][FRIDGE_EXPIRY] attempt=2 user=... errorCode=...` 포맷으로 남긴다.
- 3회 모두 실패 시
  - 관리자 알림(웹/모바일)으로 “임박/만료 배치 실패” 경고를 발송한다.
  - 운영자는 아래 복구 절차를 따른다.

## 2. 오류 코드 / 로그 표준화

- `NotificationDispatchLog.errorCode`는 아래 도메인 상수를 사용한다.
  - `EXPIRY_BATCH_FAILED`: 임박 배치 실패
  - `EXPIRED_BATCH_FAILED`: 만료 배치 실패
- `errorMessage`에는 root cause만 기록한다 (예: SQLSTATE, HTTP status 등).
- 애플리케이션 로그는 `[ALERT][Batch][FRIDGE_EXPIRY] attempt=2 user=… errorCode=EXPIRY_BATCH_FAILED detail=…` 포맷으로 남겨 모니터링 시스템이 파싱할 수 있게 한다.
- 아래 표를 참고해 오류 코드별 대응을 수행한다.

| 오류 코드 | 원인 예시 | 즉시 조치 | 재시도 전 확인 사항 |
|-----------|-----------|-----------|---------------------|
| `EXPIRY_BATCH_FAILED` | DB 연결 실패, 쿼리 예외 | 재시도 대기(5분) 후 자동 수행, 3회 실패 시 수동 재실행 | DB 상태 확인, 쿼리 로깅 검토 |
| `EXPIRED_BATCH_FAILED` | 알림 저장 실패, dedupe 충돌 | 자동 재시도, 필요 시 수동 재실행 | 알림 테이블 상태 확인 |

## 3. 수동 재실행 및 복구 절차

1. 장애 원인을 제거했는지 확인한다 (DB/네트워크/시스템 상태).
2. 수동 재실행 명령(`./gradlew runFridgeExpiryBatch` 또는 운영 환경에 맞는 Trigger)을 사용한다.
3. 실행 후 `notification_dispatch_log`를 조회해 성공 로그를 확인한다.
4. 여전히 실패 시 운영 채널(Slack 등)에 재시도 결과와 오류 메시지를 공유하고, 추가 조치를 논의한다.

## 4. 참고 문서

- 매일 배치 구현 상세: `backend/src/main/java/com/dormmate/backend/modules/notification/application/FridgeExpiryNotificationScheduler.java`
- 알림 및 로그 도메인: `Notification`, `NotificationDispatchLog`
- 상태 보드 진행 이력: `docs/ops/status-board.md` NO-501 섹션
