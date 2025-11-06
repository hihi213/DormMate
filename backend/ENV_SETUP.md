# DormMate 환경변수 설정 가이드

## 🚀 **개발 환경 설정**

### **1. 환경변수 파일 생성**
프로젝트 루트에 `.env.dev` 파일을 생성하세요:

```bash
# backend/.env.dev
DB_URL=jdbc:postgresql://localhost:5432/dormitory_db
DB_USERNAME=dormmate_user
DB_PASSWORD=pleasesetup
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-jwt-secret-key-change-in-production-2025
JWT_REFRESH_EXPIRATION=604800000
AWS_S3_BUCKET=dormmate-dev-storage
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY=dev-access-key
AWS_SECRET_KEY=dev-secret-key
ADMIN_USERNAME=dormmate_admin
ADMIN_PASSWORD=ChangeMe!Dev2025
# ↑ 예시 값입니다. 실제 환경에서는 더 강력한 값으로 교체하세요.
SERVER_PORT=8080
```

> **참고**: `docker-compose.yml`이 PostgreSQL 컨테이너의 `5432` 포트를 호스트에 노출합니다. 로컬 툴에서 접근할 때는 `jdbc:postgresql://localhost:5432/...`를 사용하고, 컨테이너 간 통신만 필요하면 `jdbc:postgresql://db:5432/...`와 같이 `host=db`로 지정하세요.

### **2. 환경변수 로드**
터미널에서 다음 명령어로 환경변수를 로드하세요:

```bash
# macOS/Linux
export $(cat .env.dev | xargs)

# 또는 수동으로 설정
export DB_URL=jdbc:postgresql://localhost:5432/dormitory_db
export DB_USERNAME=dormmate_user
export DB_PASSWORD=pleasesetup
```

## 🏭 **운영 환경 설정**

### **1. AWS Lightsail 서버에서**
```bash
# /etc/environment 파일에 추가
sudo nano /etc/environment

# 추가할 내용
DB_URL=jdbc:postgresql://your-rds-endpoint:5432/dormitory_db
DB_USERNAME=prod_user
DB_PASSWORD=super-strong-password-here
REDIS_HOST=your-redis-endpoint
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
JWT_SECRET=random-256-bit-secret-key-here
JWT_REFRESH_EXPIRATION=604800000
AWS_S3_BUCKET=your-prod-bucket
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY=your-aws-access-key
AWS_SECRET_KEY=your-aws-secret-key
ADMIN_USERNAME=dormmate_admin
ADMIN_PASSWORD=SuperStrongAdminPass!2025
# ↑ 운영 환경에서는 길고 예측 불가능한 값을 사용하세요.
SERVER_PORT=8080
```

### **2. 환경변수 적용**
```bash
# 환경변수 적용
source /etc/environment

# 또는 시스템 재시작
sudo reboot
```

## 🔒 **보안 체크리스트**

### **개발 환경**
- [ ] `.env.dev` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 하드코딩된 비밀번호가 없는지 확인
- [ ] JWT 시크릿이 예측 가능하지 않은지 확인
- [ ] `ADMIN_USERNAME`, `ADMIN_PASSWORD` 값을 Flyway 마이그레이션 전에 반드시 설정했는지 확인

### **운영 환경**
- [ ] 모든 비밀번호가 강력한지 확인 (16자 이상, 특수문자 포함)
- [ ] 데이터베이스가 프라이빗 서브넷에 있는지 확인
- [ ] 방화벽 규칙이 적절히 설정되어 있는지 확인
- [ ] SSL/TLS 인증서가 설정되어 있는지 확인
- [ ] `ADMIN_USERNAME`, `ADMIN_PASSWORD` 환경변수가 안전한 값인지 주기적으로 변경

## 🚨 **주의사항**

1. **절대 소스코드에 비밀번호를 하드코딩하지 마세요**
2. **환경변수 파일은 절대 Git에 커밋하지 마세요**
3. **운영 환경의 비밀번호는 정기적으로 변경하세요**
4. **JWT 시크릿은 256비트 이상의 랜덤 문자열을 사용하세요**
5. **Flyway 마이그레이션(`./gradlew flywayMigrate`)을 실행하기 전에 `ADMIN_USERNAME`, `ADMIN_PASSWORD`를 반드시 지정하세요**

## 📝 **환경별 실행 방법**

### **개발 환경**
```bash
# (프로젝트 루트에서) 환경변수 로드 후
SPRING_PROFILES_ACTIVE=dev ./auto dev backend
```

### **운영 환경**
```bash
# 환경변수 로드 후
./gradlew bootRun --args='--spring.profiles.active=prod'
```

### **Docker 환경**
```bash
# 환경변수 파일을 사용하여 Docker 실행
docker run --env-file .env.prod your-app-image
```

## 🚢 **배포 절차 요약**
1. 앱 빌드  
   ```bash
   cd frontend && npm run build
   cd ../backend && ./gradlew bootJar
   ```
2. 이미지 태그 및 배포  
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build app
   docker tag dorm_app:latest dormmate/app:<TAG>
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app
   ```
3. 롤백  
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app --build --no-cache
   ```

배포 전에는 `./auto tests core --full-playwright` 결과를 확인하고, `.env.prod`가 최신인지 점검하세요.

## 🧊 냉장고 라벨 시드 참고

- `R__Seed.sql`은 각 보관 칸당 라벨 번호 1~999를 한 번에 채우기 위해 `generate_series`와 `CROSS JOIN`을 사용합니다.
- 배포 파이프라인에서 시드 단계가 오래 걸리지 않는지 확인하고, 필요하면 배치 크기를 줄이거나 `COPY` 기반 스크립트로 교체할 수 있습니다.
- 대량 삽입 후 `VACUUM ANALYZE label_pool;`을 실행해 통계를 최신화하면 이후 라벨 할당 쿼리 성능이 안정적으로 유지됩니다.
