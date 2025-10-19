# Schema Drift Checklist

이 디렉터리는 Flyway 마이그레이션(`backend/src/main/resources/db/migration`)과 실제 데이터베이스
스키마 간의 차이를 조기에 감지하기 위한 도구 모음입니다.  
핵심 원칙은 **문서(`docs/service/domain-model.md`) ↔ SQL ↔ 코드**를 항상 일치시키는 것입니다.

## 1. 실행 전 확인

- Docker가 실행 중이어야 하며 `postgres:16.4-alpine` 이미지를 내려받을 수 있어야 합니다.
- 실제 DB(또는 개발용 컨테이너)에 대한 읽기 권한이 필요합니다.
- 다음 환경 변수를 설정합니다. (예시는 로컬 개발 DB 기준)

```bash
export ACT_URL='postgresql://dorm_user:dorm_password@localhost:5432/dormitory_db'
export ACT_HOST='localhost'
export ACT_PORT='5432'
export ACT_DB='dormitory_db'
export ACT_USER='dorm_user'
export ACT_PASSWORD='dorm_password'
# (선택) migra 옵션
export MIGRA_SCHEMA='public'
export MIGRA_WITH_PRIVILEGES='false'
export MIGRA_UNSAFE='false'
```

## 2. 로컬 점검 절차

```bash
make schema-drift
```

위 명령은 `tools/db/migra-local.sh`를 호출하며 다음 단계를 수행합니다.

1. **Expected DB**(PostgreSQL 16 컨테이너)를 기동하고 레포 내 Flyway 마이그레이션을 적용합니다.
2. **Actual DB**에 Flyway `validate`를 수행해 버전/체크섬을 검증합니다.
3. `migra actual → expected` 비교를 통해 SQL 차이(`artifacts/migra.sql`)를 생성합니다.

`artifacts/migra.sql`이 비어 있으면 ✅ 정합성 유지, 내용이 존재하면 ❌ 드리프트가 있으므로 SQL을 검토하여
문서/마이그레이션/코드를 함께 갱신해야 합니다.

## 3. 집중 점검 대상

- `label_pool.status`(0=AVAILABLE, 1=IN_USE), `last_used_at`, 관련 트리거
- `compartments.lock_owner_session_id`, `lock_acquired_at`, `lock_expires_at`
- `notifications.dedupe_key` Unique / `ttl_at`, `preview_summary` 생성 컬럼
- `fridge_items.created_at`, `modified_at`, `last_inspection_action_id`

위 항목이 변경되면 반드시 `docs/service/domain-model.md`와 마이그레이션 SQL을 동시에 수정하고
`make schema-drift` 결과를 CI까지 확인합니다.

## 4. CI 연동

`.github/workflows/ci.yml`의 `Schema drift check` 단계가 `make schema-drift`를 실행해 PR마다 동일한 검증을 수행합니다.
드리프트가 감지되면 워크플로가 실패하므로, SQL/문서/코드를 함께 수정한 뒤 다시 실행해야 합니다.
