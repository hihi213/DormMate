# 관리자/프런트 Playwright 시나리오 현황
*최신 코드 기준(Playwright fixture 모드) 정리 — admin 실서버 시나리오는 미작성 상태, 현존 테스트는 fixture 기반 smoke/권한/회귀 3종입니다.*

## 1. 목적
- 프런트 E2E를 fixture 모드(가짜 API + 로컬스토리지 세션)로 빠르게 smoke 검증한다.
- 관리자 실서버 시나리오는 향후 구현 시 추가하고, 현재는 권한/취소 배지/홈 로드 정도만 커버한다.

## 2. 실행/환경
- 기본 명령: `npm run playwright:test` (frontend). `playwright.config.ts`가 `PLAYWRIGHT_BASE_URL`이 비어 있으면 dev 서버를 fixture 모드(`NEXT_PUBLIC_FIXTURE=1`, `NEXT_PUBLIC_API_BASE=http://127.0.0.1:3000/api/__fixtures__/backend`)로 자동 기동한다.
- 실 서버 대상으로 실행할 때: 앱/백엔드를 미리 띄우고 `PLAYWRIGHT_BASE_URL=http://localhost:3000 NEXT_PUBLIC_API_BASE=http://localhost:8080/api` 식으로 지정. 필요 시 `PLAYWRIGHT_STORAGE_STATE=tests/e2e/.auth/admin.json`으로 저장된 세션 사용.
- 워커: `PLAYWRIGHT_WORKERS`로 오버라이드 가능(미지정 시 CI=3, 로컬=자동).
- 스토리지 생성 스크립트(실서버용): `ADMIN_EMAIL=admin@dormmate.io ADMIN_PASSWORD=admin PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run playwright:create-admin-storage` → `frontend/tests/e2e/.auth/admin.json` 생성 후 `PLAYWRIGHT_STORAGE_STATE`로 지정.

## 3. 사전 준비
1. **Fixture 모드 기본값**: 별도 설정 없으면 dev 서버가 fixture API를 사용해 뜬다(실 API 호출 없음).
2. **역할별 세션 주입**: `frontend/tests/support/fixture-auth.ts`의 `setupFixtureAuthSession`으로 resident/floorManager/admin 프로필과 토큰을 로컬스토리지/쿠키에 주입한다.
3. **실 서버 대상으로 실행 시**: fixture helper 사용을 지양하거나, `page.route` 모킹을 해제하고 실제 API 응답을 확인할 것. Danger Zone/재배분/정정 등 파괴적 플로우는 전용 DB나 모킹 전략을 정의한 뒤 추가한다.

## 4. 시나리오 현황(현재 커밋 기준)

- `fridge-smoke.spec.ts`: 홈(`/`) 진입 시 타이틀 로드 smoke.
- `inspection-role-access.spec.ts`: admin/floorManager/resident 역할별 관리자 페이지/검사 가드 노출 확인.
- `inspection-cancel-status.spec.ts`: resident 뷰 검사 이력에서 취소 배지·메모 표기 회귀.

> 위 테스트는 모두 fixture API와 세션 주입에 의존하며, 실 API 연동 시나리오는 아직 없다.

## 5. 실행 예시
- 기본(fixture): `npm run playwright:test`
- 실 서버 대상(admin 예시): `PLAYWRIGHT_BASE_URL=http://localhost:3000 NEXT_PUBLIC_API_BASE=http://localhost:8080/api PLAYWRIGHT_STORAGE_STATE=tests/e2e/.auth/admin.json npm run playwright:test -- --grep admin`

## 6. TODO
1. 실 API 기반 관리자 시나리오(재배분/정정/Danger Zone/알림 재발송) 작성 및 태그 체계 재도입.
2. `scripts/create-admin-storage.mjs`에 층별장/거주자 계정 옵션 추가.
3. Fixture 모드와 실 모드 분리 실행 스크립트 정의(`npm run playwright:test:fixture`, `:real`).
4. OpenAPI seed vs runtime 스냅샷 비교(CI) 추가 후, 드리프트 시 Playwright smoke를 함께 실패 처리하는 방안 검토.
