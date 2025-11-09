# 발표 개요

## 목차
1. 문제 정의 및 목표
2. 핵심 기능 및 아키텍처
3. 인프라 & 자동화
4. 운영 편의 & 관측성

## 1. 문제 정의 및 목표
- **현황 파악 어려움**: 기숙사 냉장고와 층별 점검이 수기 기록·메신저로 진행되어, 냉장칸 중복 사용/점검 누락이 빈번하게 발생한다.
- **정보 비대칭**: 관리자와 거주자가 같은 데이터를 보는 방식이 달라서, 냉장칸 배정·벌점 부여 시 실시간 상태를 공유하기 어렵다.
- **목표**: 냉장칸 배정부터 점검, 경고/알림 발송까지 한 화면에서 관리하고, 로그·감사 기능을 갖춘 백엔드 중심 MVP를 구축한다.

## 2. 핵심 기능 및 아키텍처
- **도메인 모델**: Room/Compartment, Inspection, Notification, AuditLog 모듈을 분리해 Spring Boot 3 기반으로 구현했다. JWT 기반 인증과 Role(ADMIN/RESIDENT) 분리가 명확하다.
- **주요 시나리오**
  - 냉장칸 배정/해제, 만료 임박 항목 자동 알림.
  - 층별 점검 생성→조치 기록→알림 발송, 모든 변경은 AuditLog에 기록.
  - 관리자 포털에서 냉장칸 현황, 점검 이력, 벌점, 데모 데이터 리셋까지 제어.
- **프런트 구조**: Next.js App Router, Zustand 상태 관리, 공통 UI 컴포넌트로 관리자/거주자 화면을 구성. `/healthz` 라우트 등 운영 기능도 포함.
- **아키텍처**: Spring Boot + PostgreSQL + Redis + Flyway + Next.js 조합. REST API와 프런트는 nginx(proxy)로 묶고, 모든 서비스는 Docker Compose로 통합.

## 3. 인프라 & 자동화 (구현 상세)
- **컨테이너 스택**
  - `docker-compose.yml` + `docker-compose.prod.yml`을 통해 app(Spring Boot), frontend(Next.js), db(PostgreSQL 16), redis, proxy(nginx), certbot까지 정의.
  - 각 서비스는 `deploy/.env.prod`를 공유하며, `proxy` 컨테이너는 `ENABLE_TLS`, `TLS_DOMAIN`, `TLS_SELF_SIGNED` 등 env 값에 따라 HTTP↔HTTPS 템플릿을 자동으로 교체하도록 entrypoint(`deploy/nginx/entrypoint.sh`)에서 구현.
- **데이터 마이그레이션**
  - Flyway가 `backend/scripts/flyway.sh`로 래핑되어 `./auto db migrate`에서 env 파일을 로드한 뒤 Gradle 태스크 `flywayMigrate`를 실행.
  - `./auto deploy reset --build`는 `docker compose down --volumes` → `up db redis` → `docker compose run --rm migrate` → `up proxy`까지 한 명령으로 묶음.
- **자동화 CLI (`tools/automation/cli.py`)**
  - `deploy` 서브커맨드에 up/down/status/reset/logs/tls issue/tls renew를 구현. `resolve_env_file_argument`로 env 파일 우선순위를 정리하고, `compose_base_args`로 동일 Compose 옵션을 재사용.
  - `deploy tls issue`는 certbot webroot 모드를 호출해 `/var/www/certbot` 볼륨을 proxy와 공유. 갱신(`deploy tls renew`) 시에는 certbot 실행 후 `proxy` 컨테이너에 `nginx -s reload`를 보냄.
  - 오류 상황을 감지해 `ValueError` 메시지를 사용자 친화적으로 출력(예: env 파일 없음, 도메인/이메일 미입력 시 안내).
- **CI 파이프라인**
  - GitHub Actions에서 `ENV_FILE_CONTENTS` 시크릿을 `deploy/.env.prod`로 내리고, `source` 후 주요 값을 `$GITHUB_ENV`로 export하여 모든 스텝이 동일 credentials를 사용.
  - `./auto dev up --services db redis`로 DB/Redis를 컨테이너로 띄우고, `./auto db migrate`, `./auto tests backend`, `./auto tests frontend`, `./auto tests playwright --full` 순으로 실행.
  - CI 로그에 Flyway 실패, npm ENOSPC 등의 상황을 미리 감지할 수 있도록 안내 메시지를 추가.

## 4. 운영 편의 & 관측성 (구현 상세)
- **헬스체크**
  - 백엔드: Spring Boot actuator `/healthz` + Docker healthcheck. 프런트: `frontend/app/healthz/route.ts` + Docker healthcheck가 `/frontend-healthz`를 사용.
  - nginx(proxy)는 `/healthz`, `/frontend-healthz`를 그대로 프록시하여 외부에서 레이어별 상태를 한 번에 확인 가능.
- **TLS 구성**
  - 초기에는 `ENABLE_TLS=false`로 HTTP만 사용. 도메인이 준비되면 `ENABLE_TLS=true`, `TLS_DOMAIN`, `TLS_EMAIL` 설정 후 `./auto deploy tls issue --domain <도메인> --email <이메일>`로 Let’s Encrypt 인증서 발급.
  - `TLS_SELF_SIGNED=true`인 경우, 인증서가 없으면 entrypoint에서 openssl을 사용해 임시 self-signed 인증서를 생성해 개발용 HTTPS 테스트 가능.
- **로그/경고/운영 이슈 대응**
  - `./auto` CLI에서 자주 만나는 오류에 대해 구체적인 안내를 추가 (예: ENOSPC 시 `docker system prune`, 포트 충돌 시 `sudo systemctl stop nginx`, Flyway 비번 mismatch 시 env 파일 점검).
  - 로그 레벨은 `LOG_LEVEL=json`, 주요 API/배치 작업은 `AuditLog` 테이블에 기록해 추적 가능.
- **배포 절차 및 문서화**
  - `ReadMe.md`와 `docs/presentation-outline.md`에 배포 순서( `git pull → env 확인 → ./auto db migrate → ./auto deploy up --build → 헬스체크`)를 명문화.
  - 서버에서 필요한 명령, Secrets 관리 방식(`ENV_FILE_CONTENTS`), TLS 발급 흐름 등을 한 문서에서 모아 질문에 대비.
