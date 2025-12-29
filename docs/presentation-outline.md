# 발표 개요

## 목차
1. 문제 정의 및 목표
2. 핵심 기능 및 아키텍처
3. 인프라 & 자동화
4. 운영 편의 & 관측성

## 1. 문제 정의 및 목표
- 현황 파악 어려움: 기숙사 냉장고와 층별 점검이 수기 기록·메신저로 진행되어, 냉장칸 중복 사용/점검 누락이 빈번하게 발생한다.
- 정보 비대칭: 관리자와 거주자가 같은 데이터를 보는 방식이 달라서, 냉장칸 배정·벌점 부여 시 실시간 상태를 공유하기 어렵다.
- 목표: 냉장칸 배정부터 점검, 경고/알림 발송까지 한 화면에서 관리하고, 로그·감사 기능을 갖춘 백엔드 중심 MVP를 구축한다.

## 2. 핵심 기능 및 아키텍처
- 도메인 모델: Room/Compartment, Inspection, Notification, AuditLog 모듈을 분리해 Spring Boot 3 기반으로 구현했다. JWT 기반 인증과 Role(ADMIN/RESIDENT) 분리가 명확하다.
- 프런트 구조: Next.js App Router, Zustand 상태 관리, 공통 UI 컴포넌트로 관리자/거주자 화면을 구성. `/healthz` 라우트 등 운영 기능도 포함.
- 아키텍처: Spring Boot + PostgreSQL + Redis + Flyway + Next.js 조합. REST API와 프런트는 nginx(proxy)로 묶고, 모든 서비스는 Docker Compose로 통합.


### Auth/세션 구조

/auth/login, /auth/refresh, /auth/logout만 별도 인증 없이 열려 있고 다른 모든 API는 JWT가 필요합니다. LoginRequest/RefreshRequest는 deviceId를 함께 받도록 정의돼 있습니다.

로그인 시 흐름: 사용자 활성 상태·비밀번호 검증 → 현재 역할 조회 → 만료된 세션만 일괄 폐기 → 난수 refresh 토큰을 발급해 SHA‑256으로 해시 → JWT 토큰쌍 발급 → user_session에 refresh 토큰 해시·만료시각·deviceId를 보관합니다. 즉, 로그인 시점에는 기존 활성 세션을 강제로 끊지 않습니다.

리프레시 시에는 요청 토큰 해시로 세션을 찾고, 만료/비활성/사용자 비활성 여부를 검사한 뒤 기존 세션을 REASON_ROTATED로 폐기하고 새 세션을 생성합니다. 단, 이때만 deviceId 불일치 여부를 확인해 불일치 시 DEVICE_MISMATCH로 폐기합니다. 따라서 doc에 있는 “동시 로그인 시 즉시 해제”는 아직 구현돼 있지 않습니다.

로그아웃은 refresh 토큰 해시로 해당 세션 레코드의 revoked_at/revoked_reason만 설정합니다.

### 세션/디바이스 저장소

user_session 엔티티는 refresh 해시, 발급/만료 시각, 해지 원인, device_id를 저장하며 isActive()로 만료·해지 여부를 판별합니다.

저장소는 해시로 단건 해지, 사용자별 만료 세션 일괄 해지, 활성 세션 조회만 제공합니다. 즉, “새 로그인 시 다른 세션 해지” 같은 메서드는 존재하지 않습니다.

### JWT/보안 파이프라인

JwtTokenService가 access/refresh TTL(기본 900초/7일)을 주입 받아 JWT를 발급·검증하고, 역할 리스트를 토큰에 담아줍니다.

JwtAuthenticationFilter가 모든 요청 헤더에서 Bearer 토큰을 파싱해 JwtAuthenticationPrincipal을 SecurityContext에 주입하고, /auth/·health 체크만 필터를 건너뜁니다.

SecurityConfig는 세션을 완전 무상태로 두고, /admin/·/actuator/에 ROLE_ADMIN을 요구합니다.

/profile/me는 현재 인증 정보를 다시 조회하는 내장 API이며, JPA 감사도 동일 principal을 사용해 userId를 기록합니다.


### 거주자용 냉장고 도메인 현황

FridgeService.getSlots는 입주자 권한에 따라 조회 범위를 제한합니다. 거주자는 자신 방에 매핑된 칸만, 층별장은 담당 층 전체를, 관리자는 전체를 볼 수 있으며 view=full일 때 용량·표시명·점유수를 포함해 페이징으로 반환합니다. 시나리오 3.1의 view=full 설명은 “용량/점유수/잠금 여부가 노출되는 관리자·거주자 공통 슬롯 API”로 구체화하면 됩니다.

/fridge/bundles 조회는 기본적으로 본인 소유 포장만 돌려주고, owner=all은 관리자 전용입니다. 검색어는 slot letter + 라벨 번호(예: A123) 혹은 키워드를 지원하며, 응답에서 memo는 소유자 본인에게만 내려갑니다. 문서에는 “관리자도 다른 사람 메모는 볼 수 없음”과 “라벨 검색/페이지네이션이 서버에서 처리됨”을 강조하세요.

단건 조회 역시 동일한 정책을 따릅니다. 관리자는 접근 권한만 확인하고 memo 없이, 소유자만 memo를 포함한 FridgeBundleResponse를 받습니다. 문서 3.1.6의 “메모는 작성자만 확인” 부분을 이 근거로 업데이트하면 됩니다.

포장 생성/수정/삭제 흐름: 칸 잠금·검사 중 여부를 ensureCompartmentNotLocked가 검사하고, 허용량(max_bundle_count) 초과 시 422를 던지며 라벨은 bundle_label_sequence를 통해 자동 발급·재사용됩니다. 시나리오 설명에서는 “삭제 시 라벨이 재활용된다”와 “검사 중 칸은 거주자 수정 불가”를 명시하세요.

아이템 CRUD는 소유자/관리자만 가능하며 FridgeItemResponse.updatedAfterInspection 플래그가 자동 계산되어 검사 이후 수정 배지를 표현합니다. 

엔티티 구조(FridgeCompartment의 maxBundleCount/lockedUntil/status, FridgeBundle의 memo/status 등)와 컨트롤러 경로(/fridge/slots, /fridge/bundles, /fridge/items)를 그대로 문서에 링크하면 추후 기능 검증 시 참고하기 쉽습니다.

### 검사 파이프라인

층별장(혹은 관리자)만 startSession을 호출할 수 있고, 담당 층 검증 후 FridgeCompartment를 잠금 상태로 만들며 30분(LOCK_EXTENSION_MINUTES) 후 만료되도록 설정합니다. 이미 진행 중인 세션이 있거나 일정이 링크돼 있으면 충돌을 막고, InspectionParticipant를 즉시 추가해 리드 검사자를 기록합니다.

recordActions는 요청당 여러 InspectionActionEntryRequest를 처리하면서 번들/아이템 스냅샷(inspection_action_item)을 남기고, 폐기 시 즉시 물품 상태를 DELETED로 전환합니다. DISPOSE/UNREGISTERED 조치에는 maybeAttachPenalty가 자동으로 벌점을 생성해 correlationId와 함께 묶습니다. 조치가 성공하면 잠금 만료 시각이 30분 뒤로 연장됩니다.

submitSession은 칸 잠금을 풀고, 링크된 일정이 있으면 COMPLETED와 completedAt를 세팅한 뒤 NotificationService.sendInspectionResultNotifications를 호출합니다. 알림에는 sessionId, actionIds, penaltyHistoryIds 등이 메타데이터로 담겨 dedupe 키(FRIDGE_RESULT:session:user)가 동일하면 중복 발송을 차단하며, 거주자 선호 설정이 꺼져 있으면 발송하지 않습니다.

관리자의 정정(PATCH)은 제출 완료 상태에만 허용됩니다. 요청 본문에서 노트 수정, 조치 삭제, 조치 추가/변경을 조합할 수 있고, 삭제 대상과 동일 actionId에 대한 mutation은 오류 처리됩니다. 변경되면 감사 로그(INSPECTION_ADJUST)에 이전/현재 상태 요약(삭제 수, note 변경 여부 등)이 남습니다.

잠금이 만료된 칸은 스케줄러가 5분 간격으로 스캔해 세션을 CANCELLED로 돌리고, 연동된 일정도 다시 SCHEDULED로 되돌립니다. 이 경로는 데모 중 무활동 시 자동 해제가 어떻게 처리되는지 설명할 때 근거가 됩니다.

일정 생성/수정은 층별장 권한으로 제한되며, 같은 칸+시간에 중복 일정을 만들면 SCHEDULE_CONFLICT로 막습니다. 생성 시 해당 칸에 접근 권한이 있는 모든 호실 입주자에게 [냉장고] 검사 일정 안내 알림이 전송되고, 알림 메타데이터에는 scheduleId, slotIndex, scheduledAt이 포함됩니다. 검사 제출 시 일정은 자동 COMPLETED 처리되고, 취소나 잠금 만료 시 다시 SCHEDULED로 되돌립니다.

이 내용을 기반으로 시나리오 3.2~3.4 절을 “검사 시작→조치→제출→알림/벌점→정정→일정 갱신/잠금 해제” 순으로 재구성하면 실제 구현과 1:1로 맞출 수 있습니다.

### 벌점,알림 연계

검사 조치가 생성될 때 maybeAttachPenalty가 DISPOSE/UNREGISTERED 조치마다 PenaltyHistory를 만들고, 제출 시에는 NotificationService.sendInspectionResultNotifications가 호출되어 거주자별 조치/벌점 ID·correlationId가 모두 메타데이터에 담깁니다. 문서 3.3~3.4 절은 “조치→벌점→알림”이 이 순서로 자동 연계된다는 점을 이 코드 기준으로 다시 서술하면 됩니다.

알림 API는 /notifications 컨트롤러에서 제공하며 목록은 UNREAD 우선 정렬 + TTL 만료 자동 처리(NotificationService.getNotifications 내부의 expireNotifications 호출)로 내려옵니다. 시나리오에 “거주자가 알림 탭에서 읽음 처리/전체 읽음/선호 설정 토글을 확인한다”는 흐름을 추가할 때 이 API 경로와 동작을 근거로 넣어 주세요.

NotificationRepository는 dedupe 키를 기준으로 중복 발송을 막고, markAllRead 쿼리로 한 번에 읽음 처리합니다. 따라서 데모에서 “같은 검사 결과 알림이 중복되지 않는다”거나 “모든 알림 읽음” 버튼이 서버 측에서도 원자적으로 처리된다는 점을 강조할 수 있습니다.

배치 알림은 FridgeExpiryNotificationScheduler가 매일 09:00에 실행되어 임박/만료 데이터를 그룹화하고, 사용자 선호가 백그라운드 허용일 때만 notification_dispatch_log에 SUCCESS를 기록합니다. 실패하면 createFailureNotification으로 EXPIRED 상태 알림을 남기고 로그에 FAILED + errorCode를 적재합니다. 시나리오 3.4에서 “관리자 화면에서 notification_dispatch_log를 확인한다”는 부분을 이 구현(채널 INTERNAL_BATCH, errorCode EXPIRY_BATCH_FAILED|EXPIRED_BATCH_FAILED)과 맞춰 설명하면 됩니다.

NotificationPreference는 임베디드 ID로 사용자·알림 종류를 묶고, NotificationService.updatePreference가 REST에서 바로 호출됩니다. 거주자 알림 설정 시나리오(3.4.1)는 “종류별 ON/OFF와 백그라운드 허용을 각각 서버가 저장한다”는 실제 동작을 반영해야 합니다.

벌점 저장 구조와 알림 메타데이터에서 penaltyHistoryIds/penaltyCorrelationIds를 함께 전달한다는 점을 연결하면, 관리자·거주자 뷰에서 벌점 누적을 재검증하는 흐름을 강화할 수 있습니다.

### 관리자 운영/데모 도구
관리자 운영 기능 조사 결과: 칸 설정과 상태 전환은 /admin/fridge/compartments에서 FridgeAdminService가 허용량 검증·검사 진행 중 여부를 체크하며, 호실 재배분은 FridgeReallocationService가 프리뷰/적용·경고·감사 로그를 모두 처리합니다. 데모 데이터 리셋은 DemoSeedService가 SQL 스크립트를 실행한 뒤 FRIDGE_DEMO_SEED_EXECUTED 감사를 남겨 재현성을 보장합니다.

관리자 칸 제어는 FridgeAdminService가 맡습니다. /admin/fridge/compartments GET은 ADMIN만 호출 가능하며, 층 필터와 view=full 여부에 따라 FridgeDtoMapper.toSlotResponse로 잠금/용량/상태를 내려줍니다. PATCH는 UpdateCompartmentConfigRequest를 받아 허용량(max_bundle_count)이 현재 활성 포장 수보다 작으면 422를 던지고, 상태 전환 시 진행 중인 검사(InspectionStatus.IN_PROGRESS)가 있으면 409로 막습니다.

호실 재배분은 FridgeReallocationService를 통해 /admin/fridge/reallocations/preview|apply 두 단계로 진행됩니다. 프리뷰는 지정 층의 칸/호실 정보를 읽어 권장 배정을 계산하고 검사 중 칸은 warning으로 표시합니다. 적용 시에는 기존 compartment_room_access를 종료하고 새 매핑을 생성하며, 영향을 받은 칸/호실 수를 ReallocationApplyResponse와 감사 로그(FRIDGE_REALLOCATION_APPLY)에 남깁니다.

데모 데이터 초기화는 /admin/seed/fridge-demo에서 DemoSeedService.seedFridgeDemoData를 호출합니다. 내부적으로 db/demo/fridge_exhibition_items.sql 파일을 실행해 냉장고·검사 샘플 데이터를 재삽입하고, 성공/실패 로그를 남기며 마지막에 AuditLogService로 FRIDGE_DEMO_SEED_EXECUTED 이벤트를 기록합니다.

모든 관리자 작업은 AuditLogService.record를 사용합니다. AuditLog 엔티티는 actionType/resourceType/resourceKey와 상세 JSON(예: 재배분 영향 수)을 저장하며, JPA @PrePersist로 생성 시각을 자동 기록합니다.

## 3. 인프라 & 자동화 (구현 상세)
- 컨테이너 스택
  - `docker-compose.yml` + `docker-compose.prod.yml`을 통해 app(Spring Boot), frontend(Next.js), db(PostgreSQL 16), redis, proxy(nginx), certbot까지 정의.
  - 각 서비스는 `deploy/.env.prod`를 공유하며, `proxy` 컨테이너는 `ENABLE_TLS`, `TLS_DOMAIN`, `TLS_SELF_SIGNED` 등 env 값에 따라 HTTP↔HTTPS 템플릿을 자동으로 교체하도록 entrypoint(`deploy/nginx/entrypoint.sh`)에서 구현.
- 데이터 마이그레이션
  - Flyway가 `backend/scripts/flyway.sh`로 래핑되어 `./auto db migrate`에서 env 파일을 로드한 뒤 Gradle 태스크 `flywayMigrate`를 실행.
  - `./auto deploy reset --build --env prod`는 `docker compose down --volumes` → `up db redis` → `docker compose run --rm migrate` → `up proxy`까지 한 명령으로 묶음.
- 자동화 CLI (`tools/automation/cli.py`)
  - `deploy` 서브커맨드에 up/down/status/reset/logs/tls issue/tls renew를 구현. `resolve_env_file_argument`로 env 파일 우선순위를 정리하고, `compose_base_args`로 동일 Compose 옵션을 재사용.
  - `deploy tls issue`는 certbot webroot 모드를 호출해 `/var/www/certbot` 볼륨을 proxy와 공유. 갱신(`deploy tls renew`) 시에는 certbot 실행 후 `proxy` 컨테이너에 `nginx -s reload`를 보냄.
  - 오류 상황을 감지해 `ValueError` 메시지를 사용자 친화적으로 출력(예: env 파일 없음, 도메인/이메일 미입력 시 안내).
- CI 파이프라인
  - GitHub Actions에서 `ENV_FILE_CONTENTS` 시크릿을 `deploy/.env.prod`로 내리고, `source` 후 주요 값을 `$GITHUB_ENV`로 export하여 모든 스텝이 동일 credentials를 사용.
  - `./auto dev up --services db redis --env prod`로 DB/Redis를 컨테이너로 띄우고, `./auto db migrate --env prod`, `./auto tests backend`, `./auto tests frontend`, `./auto tests playwright --full` 순으로 실행.
  - CI 로그에 Flyway 실패, npm ENOSPC 등의 상황을 미리 감지할 수 있도록 안내 메시지를 추가.

## 4. 운영 편의 & 관측성 (구현 상세)
- 헬스체크
  - 백엔드: Spring Boot actuator `/healthz` + Docker healthcheck. 프런트: `frontend/app/healthz/route.ts` + Docker healthcheck가 `/frontend-healthz`를 사용.
  - nginx(proxy)는 `/healthz`, `/frontend-healthz`를 그대로 프록시하여 외부에서 레이어별 상태를 한 번에 확인 가능.
- TLS 구성
  - 초기에는 `ENABLE_TLS=false`로 HTTP만 사용. 도메인이 준비되면 `ENABLE_TLS=true`, `TLS_DOMAIN`, `TLS_EMAIL` 설정 후 `./auto deploy tls issue --domain <도메인> --email <이메일>`로 Let’s Encrypt 인증서 발급.
  - 초기에는 `ENABLE_TLS=false`로 HTTP만 사용. 도메인이 준비되면 `ENABLE_TLS=true`, `TLS_DOMAIN`, `TLS_EMAIL` 설정 후 `./auto deploy tls issue --env prod --domain <도메인> --email <이메일>`로 Let’s Encrypt 인증서 발급.
  - `TLS_SELF_SIGNED=true`인 경우, 인증서가 없으면 entrypoint에서 openssl을 사용해 임시 self-signed 인증서를 생성해 개발용 HTTPS 테스트 가능.
- 로그/경고/운영 이슈 대응
  - `./auto` CLI에서 자주 만나는 오류에 대해 구체적인 안내를 추가 (예: ENOSPC 시 `docker system prune`, 포트 충돌 시 `sudo systemctl stop nginx`, Flyway 비번 mismatch 시 env 파일 점검).
  - 로그 레벨은 `LOG_LEVEL=json`, 주요 API/배치 작업은 `AuditLog` 테이블에 기록해 추적 가능.
- 냉장고 권한 불일치 감시
  - Flyway repeatable 스크립트 `R__fridge_views.sql`에서 `vw_fridge_bundle_owner_mismatch` 뷰를 정의해 번들-호실-칸 매핑 오류만 필터링한다.
  - 관리자 UI의 감사 로그 페이지 상단에 “냉장고 권한 불일치 모니터” 카드가 배치되어, `GET /admin/fridge/issues` 결과를 실시간 표로 노출하고 `issueType`(방 배정 없음/권한 없음)을 배지로 표시한다.
  - 뷰 결과는 향후 status-board·슬랙 경보와 연결할 수 있도록 `issue_type`, `bundle_id`, `updated_at` 기준으로 export 가능하다.
- 배포 절차 및 문서화
  - `ReadMe.md`와 `docs/presentation-outline.md`에 배포 순서( `git pull → env 확인 → ./auto db migrate --env prod → ./auto deploy up --build --env prod → 헬스체크`)를 명문화.
  - 서버에서 필요한 명령, Secrets 관리 방식(`ENV_FILE_CONTENTS`), TLS 발급 흐름 등을 한 문서에서 모아 질문에 대비.
