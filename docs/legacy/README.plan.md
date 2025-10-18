README.md 작성 계획
README.md 파일은 프로젝트의 이해도를 높이고 다른 개발자(혹은 미래의 자신)가 쉽게 프로젝트를 시작하고 참여할 수 있도록 돕는 핵심 문서입니다. "독자적 개발 여정"을 고려할 때, 이 문서는 학습 과정과 프로젝트의 진화를 기록하는 역할도 겸할 수 있습니다.
1. Day 0 — Week 1 이전 사전 준비 (최소한의 시작)
프로젝트의 초기 단계에서는 다음의 내용을 포함하여 최소한의 README.md를 작성합니다.
• 1페이지 템플릿: 간결하고 핵심적인 내용으로 시작합니다.
• 프로젝트 개요: "사생 냉장고 관리 및 검사 시스템"이 무엇을 하는 프로젝트인지 한두 문장으로 명확히 설명합니다.
• 로컬 개발 환경 기동 3줄 가이드: 다음 세 가지 명령을 포함하여, 다른 사람이 로컬에서 프로젝트를 즉시 실행할 수 있도록 안내합니다.
    ◦ clone (프로젝트 저장소 복제)
    ◦ compose up (Docker Compose를 이용한 DB 등 인프라 기동)
    ◦ make dev (서버 및 DB 기동 스크립트 실행)
• 기본 파일 목록: .gitignore, LICENSE, README.md (자기 자신), .editorconfig 등 프로젝트에 포함된 기본 파일들을 간략히 언급할 수 있습니다.
2. 주간 개발 과정 중 (점진적 보강)
각 주차별 개발이 진행됨에 따라 README.md에 관련 내용을 점진적으로 추가하여 문서의 완성도를 높입니다. 이는 ADR (아키텍처 결정 기록)에 기록된 주요 결정 사항을 요약하여 README에 반영하는 방식이 될 수 있습니다.
• Week 1 (로그인 + RBAC 훅):
    ◦ 인증 및 권한 관리(RBAC) 방식: 토큰 방식 (JWT Access only vs Access+Refresh) 및 ADMIN / INSPECTOR / USER 역할별 권한 경계 초안을 요약하여 설명합니다.
    ◦ 유지보수 훅: 휴관 시 비관리자(USER/INSPECTOR) 로그인 차단 기능에 대한 설명을 추가합니다.
• Week 2 (핵심 스키마 + 등록/조회):
    ◦ 라벨/번호 체계: 층, 칸 라벨 및 스티커 번호 패턴(정규식), 그리고 (compartment, number) 유일성 범위 (ACTIVE 상태에서만 유일)에 대한 설명을 추가합니다.
    ◦ 핵심 도메인 스켈레톤: items(bundles) + status(ACTIVE/REMOVED) 등 주요 테이블에 대한 간략한 설명을 포함합니다.
• Week 3 (프리셋 액션 + 빠른 교체):
    ◦ 물품 관리 액션: ADJUST(부분 소비), REMOVE_ALL(전량 제거)과 같은 액션 프리셋에 대해 설명합니다.
    ◦ "빠른 교체": 서버에서 MOVE/REPLACE 기능을 직접 지원하지 않으며, 클라이언트 매크로를 통해 REMOVE_ALL 후 CREATE로 구현된다는 점을 명확히 설명합니다. 이 과정에서 번호 재사용은 기존 묶음이 REMOVED 된 이후에만 허용된다는 점도 명시합니다.
• Week 4 (검사 세션):
    ◦ 검사 세션 개요: inspection_session을 통한 세션 기반 검사 진행, 최대 2명 동시 검사 및 세션 범위(층 단위) 내에서 일반 사용자 쓰기 차단(423 Locked)에 대한 내용을 추가합니다.
    ◦ 태그 필터: expired, changed_since(sessionStartedAt) 등 검사 대상 필터링 기능을 설명합니다.
• Week 5 (조치 기록 + 제출):
    ◦ 조치 버튼: [통과] / [경고] / [폐기(+벌점)] / [스티커 미부착 폐기] 각 조치의 의미를 설명합니다.
    ◦ 세션 제출: 세션당 단일 제출자 원칙과 제출 시 벌점 원본 생성 및 알림 아웃박스(모의) 적재에 대해 설명합니다.
• Week 6 (벌점 조정 + 히스토리):
    ◦ 벌점 정책: 원본 벌점은 불변하며 운영자만 조정(Adjustment) 가능하고, 최종 벌점은 원본 + Σ조정으로 계산됨을 설명합니다.
• Week 7 (도메인 이벤트 + 로그 영구 보존 & 휴관 배치):
    ◦ 보존 정책: 데이터는 소프트삭제되며, activity_logs와 domain_events는 리소스 소프트삭제 후에도 영구 보존됨을 명시합니다.
    ◦ 휴관 기능: 관리자가 휴관 (toggle-maintenance) ON/OFF 시 비관리자 로그인 차단 및 (선택적으로) 층 물품 일괄 소프트삭제 배치 실행에 대해 설명합니다.
3. Week 10 — 폴리싱 & 문서/데모 & 릴리즈 (최종 완성)
릴리즈를 위한 최종 단계에서는 README.md를 프로젝트의 모든 중요한 정보를 담는 종합 문서로 완성합니다.
• 아키텍처: 시스템의 고수준 아키텍처 다이어그램 및 주요 컴포넌트 간의 상호작용을 설명합니다.
• ERD (Entity-Relationship Diagram): 데이터베이스 스키마 및 테이블 간의 관계를 시각적으로 보여주는 ERD를 포함합니다.
• 시퀀스 다이어그램: 핵심 사용자 시나리오 (예: 물품 등록, 검사 세션 생성 및 조치, 벌점 부과 흐름)에 대한 시퀀스 다이어그램을 포함하여 시스템의 동작 방식을 상세히 설명합니다.
• 상세 실행 가이드: Day 0의 간략한 가이드에서 더 나아가, 필요한 의존성, 환경 변수 설정, 테스트 실행 방법, 잠재적인 문제 해결 팁 등 프로젝트를 완전히 이해하고 운영하는 데 필요한 모든 세부 정보를 포함합니다.
• 주요 API 목록: 데모 시연 흐름 및 API 호출 로그에 제시된 주요 API 엔드포인트들을 정리하여 표 형태로 제공할 수 있습니다.
• 주요 검증 체크포인트 요약: "검증 체크포인트(요약)"에 명시된 번호 유일성, 검사 동시성, 조치/제출, 벌점 모델, 보존 정책, 운영 훅 등 핵심 검증 사항들을 요약하여 포함합니다.
• 향후 계획/개선 사항 (선택): Week 9의 견고화 및 선택적 회원가입 등 향후 개선될 수 있는 부분이나 보류된 기능에 대한 간략한 언급을 추가할 수 있습니다.




## Day 0 — 최소 README

- **프로젝트 개요**: 사생 냉장고 관리 및 검사 시스템. 냉장고 물품 등록/관리, 층 단위 검사 세션, 조치/벌점 기록과 운영 훅(휴관)을 지원합니다.

- **로컬 개발 환경 3줄 가이드**

```bash
git clone <repo-url> && cd pj_DormMate
docker compose up -d
cd backend && ./gradlew bootRun
```

- **프론트엔드 (Next.js)**

```bash
cd client
npm install
npm run dev
```

- **원커맨드(dev 스크립트) 사용법**

```bash
# 백엔드 + 인프라(DB/Redis/pgAdmin)
./scripts/dev.sh

# 프론트까지 함께 실행
./scripts/dev.sh --with-frontend
```

- **환경 변수 예시 (로컬/운영)**

```bash
# 공통 (로컬 기본값 포함)
SPRING_PROFILES_ACTIVE=local
DB_URL=jdbc:postgresql://localhost:5432/dormitory_db
DB_USERNAME=dorm_user
DB_PASSWORD=dorm_password
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ALLOWED_ORIGINS=http://localhost:3000

# JWT (로컬 샘플 값 — 운영에서는 안전한 값으로 교체)
JWT_SECRET=dev-jwt-secret-key-change-in-production-2024
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# S3 (선택)
AWS_S3_BUCKET=dormmate-dev-storage
AWS_S3_REGION=ap-northeast-2
AWS_ACCESS_KEY=your-access-key
AWS_SECRET_KEY=your-secret-key

# 운영 배포 예시
# SPRING_PROFILES_ACTIVE=prod
# DB_URL=jdbc:postgresql://prod-host:5432/dormitory_db
# DB_USERNAME=prod_user
# DB_PASSWORD=prod_pass
# CORS_ALLOWED_ORIGINS=https://your-prod-domain.com
# AWS_S3_BUCKET=dormmate-prod-storage
# AWS_S3_REGION=ap-northeast-2
```

- **헬스체크 (Day 0)**
```bash
# 공개 헬스체크 (최소 정보)
curl http://localhost:8080/health

# 내부 Actuator (ADMIN 권한 필요)
curl -u admin:admin http://localhost:8080/actuator/health
curl -u admin:admin http://localhost:8080/actuator/info
```

**보안 구조**
- `/health`: 공개 (로드밸런서/외부 모니터링용)
- `/actuator/*`: ADMIN 권한 필요 (버전/커밋 등 상세 정보)
- 운영환경: Actuator는 내부망(127.0.0.1:8081)에서만 접근 가능

**타임존 정책**
- JVM/DB: UTC 고정 (로그, 스케줄, 데이터 저장)
- 화면/리포트: KST(UTC+9)로 변환하여 표시
- 일관된 시간 처리로 시간대 관련 버그 방지

- **기본 파일 목록(권장)**
  - `.gitignore`
  - `README.md`
  - `docker-compose.yml`
  - `LICENSE` (optional)
  - `.editorconfig` (optional)
