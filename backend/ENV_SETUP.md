# DormMate 환경 변수 설정 가이드

본 문서는 `deploy/.env.local`(로컬)과 `deploy/.env.prod`(운영 템플릿)를 기준으로 로컬·CI·운영 환경을 구성하는 방법을 설명합니다. 저장소에는 **값이 비워진 `deploy/.env.prod`만** 포함되어 있으며, 실제 비밀 값은 런타임 직전에만 주입합니다.

---

## 1. 파일 구성
| 용도 | 경로 | 비고 |
| --- | --- | --- |
| 운영 템플릿(추적) | `deploy/.env.prod` | 키 목록과 기본 주석만 포함. Git에 남아 있으므로 비밀번호를 입력하지 말 것 |
| 로컬 실행 | `deploy/.env.local` | 샘플을 복사해 값 채우기 |
| 운영 배포 | CI가 생성한 `deploy/.env.prod` | Secret Manager/Vault에서 값을 받아 런타임 직전에만 생성 |

필수 변수 요약:
- **DB 연결**: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (또는 `POSTGRES_*`) — Docker Compose는 지정되지 않으면 `POSTGRES_DB=dormitory_db`로 기본값을 넣으므로, 실제 환경에서는 `deploy/.env.local`에 프로젝트별 DB 이름을 반드시 명시하세요.
- **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **보안**: `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` 또는 `ADMIN_PASSWORD_HASH`
- **운영 옵션**: `SERVER_PORT`, `TZ`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_REQ_PER_MIN`
- **프런트/프록시**: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_FIXTURE`, `PROXY_HTTP_PORT` — Next.js 빌드와 nginx reverse proxy 포트 매핑에 사용
- **TLS**: `ENABLE_TLS`, `PROXY_HTTPS_PORT`, `SERVER_NAME`, `TLS_DOMAIN`, `TLS_EMAIL`, `TLS_SELF_SIGNED` — HTTPS 구성을 위한 제어 값

샘플 파일은 기본 자격증명이 포함되어 있으므로 절대 그대로 배포하지 마세요.

---

## 2. 로컬 개발 절차
1. **샘플 복사**
   ```bash
   touch deploy/.env.local
   ```
2. **값 채우기**
   - PostgreSQL/Redis를 Docker Compose로 기동한다면 기본 호스트(`localhost`, `redis`)만 맞추면 된다.
   - `SPRING_PROFILES_ACTIVE` 기본값이 `prod`이므로, 로컬 개발에서는 아래처럼 덮어쓴다.
     ```bash
     echo "SPRING_PROFILES_ACTIVE=dev-local" >> deploy/.env.local
     ```
3. **마이그레이션 & 실행**
   ```bash
   ./auto db migrate --env local
   ./auto dev backend --env local
   ```
   `backend/scripts/flyway.sh`는 지정한 env 파일을 `set -a` → `source`로 로드한 뒤 Flyway 태스크를 실행한다.
   DB 정보가 비어 있으면 즉시 실패하므로 값 확인 후 실행한다.
   인자를 생략하면 기본으로 `deploy/.env.prod`를 사용한다.
   일반적으로는 `./auto db migrate --env local` 사용을 권장하며, 직접 실행 시에는
   `backend/scripts/flyway.sh deploy/.env.local`로 호출한다.

---

## 3. CI·운영 환경
1. **비밀 관리**: Secret Manager, AWS SSM, Vault 등에서 `deploy/.env.prod` 템플릿과 동일한 키를 제공한다.
2. **배포 스크립트 예시**
   ```bash
   # 1) 비밀 주입
   printf "%s" "$ENV_FILE_CONTENTS" > deploy/.env.prod

   # 2) 마이그레이션
   ./auto db migrate --env prod
   ```
3. **Docker Compose**
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d proxy
   # proxy 서비스에는 app/frontend가 depends_on으로 연결되어 전체 스택을 동시에 기동합니다.
   # 또는 ./auto deploy up --build --env prod
   # (DB 초기화까지 포함하려면 ./auto deploy reset --build --env prod)
   ```
4. **관리(Actuator) 포트 설정**
   - 기본값은 `SERVER_PORT`와 동일하며, CI에서도 이 구성을 사용한다. 별도 포트(예: 8081)를 두고 싶다면 `.env.prod`에 `MANAGEMENT_SERVER_PORT=8081`을 추가한다.
   - 이때만 `MANAGEMENT_SERVER_ADDRESS=127.0.0.1`과 같이 바인딩 주소를 설정한다. *동일 포트를 사용할 때는 주소 변수를 비워 두어야 Spring Boot가 오류 없이 기동된다.*
5. **데모 시드 보호**
   - `/admin/seed/fridge-demo`는 모든 냉장고/검사 데이터를 초기화하므로 운영 환경에서 호출하면 안 된다.
   - 운영 배포 시에는 방화벽 또는 `DEMO_SEED_ENABLED=false` 와 같은 서버 환경 변수를 사용해 컨트롤한다.

6. **TLS/HTTPS 구성**
   - `ENABLE_TLS=true`, `SERVER_NAME`, `TLS_DOMAIN`, `TLS_EMAIL`, `PROXY_HTTPS_PORT=443`를 지정한다.
   - 최초 1회 인증서 발급: `./auto deploy tls issue --domain <도메인> --email <이메일>` (또는 `docker compose ... run --rm certbot ...`)
   - 이후 갱신은 `./auto deploy tls renew`로 실행하면 `proxy` 컨테이너가 자동으로 새 인증서를 로드한다. 필요 시 `./auto deploy up`으로 재기동한다.

---

## 4. 보안 체크리스트
### 개발 환경
- [ ] `deploy/.env.local`, `deploy/.env.prod`가 `.gitignore`에 명시되어 있는지 확인
- [ ] 인증 정보는 90일 이하 주기로 교체
- [ ] `JWT_SECRET`은 256bit 이상 무작위 값 사용

### 운영 환경
- [ ] DB/Redis는 사설 서브넷에 두고, 필요한 포트만 보안 그룹으로 허용
- [ ] TLS(예: ALB, Nginx)로 외부 통신 암호화
- [ ] Flyway 실행 권한은 CI/운영 계정으로 제한
- [ ] 데모 시드 SQL(R__demo_reset.sql)은 운영 계정으로 실행되지 않도록 권한 분리

---

## 5. 자주 묻는 질문
| 질문 | 답변 |
| --- | --- |
| **`Connection refused` 에러** | DB 컨테이너가 켜져 있는지(`docker compose ps`), `DB_HOST`가 `localhost`인지 확인. CI에서는 `db` 서비스 이름을 사용해야 한다. |
| **Flyway checksum mismatch** | 이미 배포된 버전 SQL을 수정하지 말고, 새 버전(V\_\_)을 추가하거나 `flyway repair` + DB 백업 후 처리한다. |
| **프로파일이 prod로 실행됨** | `deploy/.env.local`에 `SPRING_PROFILES_ACTIVE=dev-local`을 추가했는지 확인. 없으면 기본 prod 환경이 로드된다. |
| **Redis 연결 실패** | Docker 네트워크 내부에서는 `redis`, 로컬 호스트에서 직접 돌릴 때는 `localhost`를 사용해야 한다. |

---

## 6. 배포 전 점검
1. `./auto db migrate --info --env prod` (또는 `backend/scripts/flyway.sh deploy/.env.prod info`)
2. `./gradlew test`
3. `./auto tests core --full-playwright` (프런트/관리자 E2E)
4. `deploy/.env.prod` 최신 여부, 비밀 만료일 확인

위 절차 이후에만 `./auto deploy up --build --env prod` (또는 K8s 배포)을 진행한다. checksum 불일치가 발생하면 `./auto db migrate --repair --env prod` 후 다시 migrate 한다.
