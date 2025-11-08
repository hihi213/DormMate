# DormMate 환경 변수 설정 가이드

본 문서는 `deploy/.env.prod` 한 벌을 기준으로 로컬·CI·운영 환경을 구성하는 방법을 설명합니다. 저장소에는 **값이 비워진 샘플(.env, deploy/.env.prod)** 이 포함되어 있으므로, 실제 비밀 값은 복사본을 만들어 주입합니다.

---

## 1. 파일 구성
| 용도 | 경로 | 비고 |
| --- | --- | --- |
| 샘플(추적) | `.env`, `deploy/.env.prod` | 키 목록과 기본 주석만 포함. Git에 남아 있으므로 비밀번호를 입력하지 말 것 |
| 로컬 실행 | `deploy/.env.local` (임의) | 샘플을 복사해 값 채우기 |
| 운영 배포 | CI가 생성한 `deploy/.env.prod` | Secret Manager/Vault에서 값을 받아 런타임 전에만 생성하고 종료 시 즉시 삭제 |

필수 변수 요약:
- **DB 연결**: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (또는 `POSTGRES_*`)
- **Redis**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **보안**: `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` 또는 `ADMIN_PASSWORD_HASH`
- **운영 옵션**: `SERVER_PORT`, `TZ`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_REQ_PER_MIN`

샘플 파일은 기본 자격증명이 포함되어 있으므로 절대 그대로 배포하지 마세요.

---

## 2. 로컬 개발 절차
1. **샘플 복사**
   ```bash
   cp deploy/.env.prod deploy/.env.local
   ```
2. **값 채우기**
   - PostgreSQL/Redis를 Docker Compose로 기동한다면 기본 호스트(`localhost`, `redis`)만 맞추면 된다.
   - `SPRING_PROFILES_ACTIVE` 기본값이 `prod`이므로, 로컬 개발에서는 아래처럼 덮어쓴다.
     ```bash
     echo "SPRING_PROFILES_ACTIVE=dev-local" >> deploy/.env.local
     ```
3. **환경 변수 로드**
   ```bash
   set -a && source deploy/.env.local && set +a
   ```
   `direnv`를 사용할 경우 `.envrc`에 `dotenv deploy/.env.local`을 추가하면 자동으로 로드된다.
4. **마이그레이션 & 실행**
   ```bash
   backend/scripts/flyway.sh deploy/.env.local
   ./gradlew bootRun --args='--spring.profiles.active=dev-local'
   ```
   `backend/scripts/flyway.sh`는 지정한 파일을 자동으로 `set -a` → `source`한 뒤 Flyway 태스크를 실행한다. DB 정보가 비어 있으면 즉시 실패하므로 값 확인 후 실행한다.

---

## 3. CI·운영 환경
1. **비밀 관리**: Secret Manager, AWS SSM, Vault 등에서 `deploy/.env.prod` 템플릿과 동일한 키를 제공한다.
2. **배포 스크립트 예시**
   ```bash
   # 1) 비밀 주입
   printf "%s" "$ENV_FILE_CONTENTS" > deploy/.env.prod

   # 2) 마이그레이션
   backend/scripts/flyway.sh deploy/.env.prod

   # 3) 애플리케이션 실행
   set -a && source deploy/.env.prod && set +a
   ./gradlew bootRun --args='--spring.profiles.active=prod'
   ```
3. **Docker Compose**
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app
   ```
4. **데모 시드 보호**
   - `/admin/seed/fridge-demo`는 모든 냉장고/검사 데이터를 초기화하므로 운영 환경에서 호출하면 안 된다.
   - 운영 배포 시에는 방화벽 또는 `DEMO_SEED_ENABLED=false` 와 같은 서버 환경 변수를 사용해 컨트롤한다.

---

## 4. 보안 체크리스트
### 개발 환경
- [ ] `.env`, `deploy/.env.*`가 `.gitignore`에 명시되어 있는지 확인
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
| **프로파일이 prod로 실행됨** | `.env`에 `SPRING_PROFILES_ACTIVE=dev-local`을 추가했는지 확인. 없으면 기본 prod 환경이 로드된다. |
| **Redis 연결 실패** | Docker 네트워크 내부에서는 `redis`, 로컬 호스트에서 직접 돌릴 때는 `localhost`를 사용해야 한다. |

---

## 6. 배포 전 점검
1. `backend/scripts/flyway.sh deploy/.env.prod info`
2. `./gradlew test`
3. `./auto tests core --full-playwright` (프런트/관리자 E2E)
4. `.env` 최신 여부, 비밀 만료일 확인

위 절차 이후에만 `docker compose ... up app` 혹은 K8s 배포를 진행한다.
