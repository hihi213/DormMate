# DormMate 환경변수 설정 가이드

## 🚀 **개발 환경 설정**

### **1. 환경변수 파일 생성**
프로젝트 루트의 `deploy/.env.prod` 파일 하나만 관리하면 됩니다. 파일은 `.gitignore`에 포함되어 저장소에 커밋되지 않습니다.

```bash
# deploy/.env.prod
DB_URL=
DB_USERNAME=
DB_PASSWORD=

REDIS_PORT=6379
JWT_SECRET=dev-jwt-secret-key-change-in-production-2025
JWT_REFRESH_EXPIRATION=604800000
AWS_S3_BUCKET=dormmate-storage
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY=change-me
AWS_SECRET_KEY=change-me
ADMIN_USERNAME=
ADMIN_PASSWORD=
SERVER_PORT=8080
```

> **참고**: `docker-compose.yml`이 PostgreSQL 컨테이너의 `5432` 포트를 호스트에 노출합니다. 로컬 툴에서 접근할 때는 `jdbc:postgresql://localhost:5432/...`를 사용하고, 컨테이너 간 통신만 필요하면 `jdbc:postgresql://db:5432/...`와 같이 `host=db`로 지정하세요.

### **2. 환경변수 로드**
터미널에서 다음 명령어로 환경변수를 로드하세요:

```bash
# macOS/Linux (프로젝트 루트 기준)
set -a
source deploy/.env.prod
set +a
```

> `direnv`를 사용하면 `dotenv deploy/.env.prod`만 `.envrc`에 추가하여 디렉터리 진입 시 자동으로 로드할 수 있습니다.

### **3. Flyway 마이그레이션 실행**
환경 파일을 지정하지 않으면 `deploy/.env.prod`가 기본으로 사용됩니다.

```bash
# 기본 환경
backend/scripts/flyway.sh

# 다른 파일을 사용하려면 명시적으로 전달
backend/scripts/flyway.sh secrets/prod.env
backend/scripts/flyway.sh secrets/prod.env clean
```

## 🏭 **운영 환경 설정**

### **1. 서버용 `.env` 관리**
- 배포 스크립트가 필요한 값을 이용해 `deploy/.env.prod`를 생성합니다.
- 값은 Secret Manager, 환경변수, Vault 등 안전한 저장소에 보관하세요.

### **2. 배포 시 적용**
배포 스크립트가 `.env`를 만든 뒤 필요한 명령을 실행하고, 완료 후 파일을 삭제합니다.

```bash
# 예시: 프로덕션 마이그레이션
backend/scripts/flyway.sh deploy/.env.prod

# 예시: 애플리케이션 실행
set -a && source deploy/.env.prod && set +a
./gradlew bootRun --args='--spring.profiles.active=prod'
```

## 🔒 **보안 체크리스트**

### **개발 환경**
- [ ] `deploy/.env.prod` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 하드코딩된 비밀번호가 없는지 확인
- [ ] JWT 시크릿이 예측 가능하지 않은지 확인

### **운영 환경**
- [ ] 모든 비밀번호가 강력한지 확인 (16자 이상, 특수문자 포함)
- [ ] 데이터베이스가 프라이빗 서브넷에 있는지 확인
- [ ] 방화벽 규칙이 적절히 설정되어 있는지 확인
- [ ] SSL/TLS 인증서가 설정되어 있는지 확인

## 🚨 **주의사항**

1. **절대 소스코드에 비밀번호를 하드코딩하지 마세요**
2. **환경변수 파일은 절대 Git에 커밋하지 마세요**
3. **운영 환경의 비밀번호는 정기적으로 변경하세요**
4. **JWT 시크릿은 256비트 이상의 랜덤 문자열을 사용하세요**

## 📝 **환경별 실행 방법**

### **개발 환경**
```bash
# (프로젝트 루트에서) 환경변수 로드 후
./auto dev backend
```

### **운영 환경**
```bash
# 환경변수 로드 후
./gradlew bootRun --args='--spring.profiles.active=prod'
```

### **Docker 환경**
```bash
docker compose --env-file deploy/.env.prod up migrate
docker compose --env-file deploy/.env.prod up app
```

## 🚢 **배포 절차 요약**
1. 앱 빌드  
   ```bash
   cd frontend && npm run build
   cd ../backend && ./gradlew bootJar
   ```
2. 이미지 태그 및 배포  
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml build app
   docker tag dorm_app:latest dormmate/app:<TAG>
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app
   ```
3. 롤백  
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml down
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app --build --no-cache
   ```

배포 전에는 `./auto tests core --full-playwright` 결과를 확인하고, `deploy/.env.prod`가 최신인지 점검하세요.

## 🧊 냉장고 라벨 시드 참고

- `R__Seed.sql`은 각 보관 칸당 라벨 번호 1~999를 한 번에 채우기 위해 `generate_series`와 `CROSS JOIN`을 사용합니다.
- 배포 파이프라인에서 시드 단계가 오래 걸리지 않는지 확인하고, 필요하면 배치 크기를 줄이거나 `COPY` 기반 스크립트로 교체할 수 있습니다.
- 대량 삽입 후 `VACUUM ANALYZE label_pool;`을 실행해 통계를 최신화하면 이후 라벨 할당 쿼리 성능이 안정적으로 유지됩니다.
