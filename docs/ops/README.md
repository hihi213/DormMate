# Ops 문서 포털
*용도: 운영·계획 관련 핵심 문서의 위치와 사용 원칙을 안내하는 인덱스로, 새 세션을 시작할 때 어떤 문서를 참고해야 하는지 정리한다.*

이 디렉터리는 프로젝트 전반에서 공통으로 참고해야 하는 운영/계획 문서를 모아 둡니다. 각 문서는 항상 최신 상태를 유지하고, 변경 시 다른 문서와의 싱크를 확인하세요.

## 주요 문서
- `docs/feature-inventory.md`: DormMate 기능·정책 카탈로그(무엇/왜)
- `docs/mvp-scenario.md`: MVP 범위와 시연 흐름(어떻게)
- `docs/mvp-implementation-plan.md`: 역할별 구현 단계와 체크리스트
- `docs/data-model.md`: 데이터 모델 및 엔터티 관계 정리
- `docs/ops/security-checklist.md`: 보안 음성 흐름 API 호출 순서 및 로그 검증 가이드
- `docs/ai-impl/README.md`: 프론트엔드·백엔드·Playground AI 협업 지침 인덱스

## 사용 지침
1. 새로운 세션을 시작할 때는 위 핵심 문서(MVP 시나리오·구현 계획·기능 정의)를 먼저 검토하고, 역할별 세부 지침은 `docs/ai-impl/README.md`에서 확인합니다.
2. 기능 정의/데이터/시나리오 문서는 항상 함께 갱신하고, 변경 이력은 PR/이슈, 팀 노트 등 프로젝트가 지정한 채널에 기록합니다.
3. 구현 AI, 학습용 AI, 사람이 모두 동일한 용어를 사용할 수 있도록 문서 간 용어를 일관되게 유지합니다.

## 자동화 CLI
- `tools/automation/cli.py`는 테스트, 빌드, 상태 관리를 위한 공통 진입점을 제공한다.
- 주요 명령
  - `./auto dev warmup [--refresh]`: Gradle/Node/Playwright 의존성 예열
  - `./auto dev up|down|status|backend|frontend`: Docker 및 개발 서버 제어
  - `./auto dev kill-ports [--ports …]`: 지정한 포트(기본 3000~3003, 8080)를 점유한 프로세스를 종료
  - `./auto tests core [--skip-backend --skip-frontend --skip-playwright --full-playwright]`: Step 6 테스트 번들
  - `./auto tests backend|frontend|playwright`: 계층별 테스트
  - `./auto db migrate`, `./auto cleanup`, `./auto state show|update`
- 명령 전체 목록은 `./auto --help`로 확인한다.
- CLI는 `.codex/state.json`에 현재 프로필, 테스트 결과, 메모를 저장하므로 수동으로 수정하지 않는다.
- 세션 중 실행한 주요 명령과 결과는 PR/이슈 코멘트 또는 팀이 지정한 회고 문서에 요약해 다음 단계 준비를 원활히 한다.
- `/admin/seed/fridge-demo`는 데모 전용 API이므로 어떤 자동화 스크립트·CI에서도 호출하지 않는다. 필요 시 운영자가 직접 실행하고, 실행 전후 점검은 아래 "데모 데이터 초기화" 섹션을 따른다.

## 데모 데이터 초기화 (관리자 전용)

> ⚠️ **운영 DB에서는 절대 호출 금지.** 이 절차는 냉장고/검사 관련 테이블을 모두 비운 뒤 데모 데이터를 다시 삽입한다.

| 구분 | 내용 |
| --- | --- |
| 목적 | 시연 전에 냉장고/검사 데이터를 표준 데모 상태로 초기화하기 위함 |
| 실행 효과 | `fridge_unit`, `fridge_compartment`, `compartment_room_access`, `bundle_label_sequence`, `fridge_bundle`, `fridge_item`, `inspection_*` 등 관련 테이블을 TRUNCATE 후 샘플 데이터를 재삽입 (`backend/src/main/resources/db/demo/fridge_demo_refresh.sql`) |
| 실행 전 확인 | ① 대상 DB가 데모/스테이징 환경인지 확인 ② 필요 시 백업 완료 ③ 데모 진행자가 초기화에 동의했는지 재확인 |
| 실행 절차 | 1. 관리자 계정으로 API 인증 토큰 발급<br>2. `POST /admin/seed/fridge-demo` 호출<br>3. 백엔드 로그에서 "FRIDGE_DEMO_DATA_REFRESHED" 응답 및 Flyway 스크립트 실행 정상 여부 확인 |
| 실행 후 점검 | ① `/fridge/slots` 목록에서 층/칸 구조가 초기값으로 복원됐는지 확인 ② 데모 계정(`alice`, `bob`, …) 로그인 후 포장/물품 샘플이 적재됐는지 점검 ③ 필요 시 `bundle_label_sequence.next_number`가 1 이상으로 초기화됐는지 확인 |

### 비상/경고 문구 표기 위치
- 본 섹션 외에도 `docs/mvp-scenario.md §2 사전 준비` 및 `docs/ops/status-board.md`에 동일 경고를 반복 노출한다.
- 운영 절차 문서, 배포 체크리스트, 페이지 데크 등에 “/admin/seed/fridge-demo는 데모 전용”이라는 문구를 추가하고, 자동화나 예약 작업에 포함시키지 않는다.

## 운영 점검 루틴
- **검사 → 알림 연동**: `inspection_action`에서 `correlation_id`가 채워진 알림을 `notification`에서 확인하고, 거주자 알림을 통해 조치 상세로 이동하는 흐름을 주기적으로 리허설한다.
- **알림 설정 이력**: `notification_preference`의 `updated_at`을 기준으로 ON/OFF 변경 이력을 살펴보고, 동일 계정이 여러 기기에서 설정을 변경했을 때 즉시 일관되게 반영되는지 확인한다.
- **발송 실패 로그**: `notification_dispatch_log`에서 최근 알림 실패 건을 조회하고, `error_code`·`error_message`를 기반으로 재시도 또는 장애 전파가 가능한지 점검한다.
- **검사 조치 감사**: `inspection_action_item`의 스냅샷 데이터를 점검해 폐기·경고 근거가 남아 있는지 확인하고, `unregistered_item_event`가 누락되지 않았는지 주기적으로 모니터링한다.
