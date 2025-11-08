# 관리자 Playwright 시나리오 설계
*최종 업데이트: 2025-11-08 · 담당: Codex(Frontend)*

## 1. 목적
- 관리자 뷰(냉장고 관리·검사 정정·데모 데이터 초기화)를 자동화 테스트로 검증해 배포 전 회귀 부담을 줄인다.
- 거주자/층별장 테스트와 충돌하지 않도록 전용 storage state와 Danger Zone 모킹 전략을 명시한다.

## 2. 태그 구조
| 태그 | 커버 범위 | 비고 |
| --- | --- | --- |
| `@admin` | 공통 로그인·네비게이션 smoke | 모든 관리자 스펙 상위 태그 |
| `@admin-fridge` | 슬롯/포장 필터, 재배분, 삭제 이력 뷰 | `/admin/fridge` 기본 화면 |
| `@admin-inspection` | 검사 이력 조회, 정정, 알림 상태 확인 | 검사 다이얼로그 & Notification 패널 |
| `@admin-demo` | 데모 데이터 초기화 Danger Zone 흐름 | API 목킹 필수 |
| `@admin-responsive` (옵션) | 768px/1024px 브레이크 포인트 스냅샷 | smoke 통과 후 선택 실행 |

## 3. 사전 준비
1. **스토리지 상태**: `frontend/scripts/create-admin-storage.mjs`를 실행해 `frontend/tests/e2e/.auth/admin.json`을 생성한다. (예: `npm run playwright:create-admin-storage -- --username admin --password admin1!`)
2. **데이터 시드**: 테스트 시작 전 `POST /admin/seed/fridge-demo`를 호출해 전시용 포장·검사 기록·벌점이 준비된 상태를 만든다. Danger Zone 테스트에서는 이 호출을 mock 하고, 나머지 스펙은 실 API 호출을 허용한다.
   > 수동 SQL로 초기화해야 하는 경우 `inspection_action_item → inspection_action → penalty_history`를 먼저 삭제하고 `fridge_item/fridge_bundle/bundle_label_sequence`를 정리한다. `AdminSeedIntegrationTest`가 같은 순서를 검증하므로, 이 흐름을 따르면 `/admin/seed/fridge-demo` 호출 전에 FK 예외를 피할 수 있다.
3. **환경 변수**: `NEXT_PUBLIC_API_BASE_URL`과 `PLAYWRIGHT_STORAGE_STATE=tests/e2e/.auth/admin.json`을 `.env.test` 또는 CI 설정에 지정한다. 관리자 모듈 플래그는 기본값으로 이미 활성화되어 별도 설정이 필요 없다.
4. **테스트 유틸**: `tests/e2e/utils/admin.ts`에 제공된 `selectFloorFilter`, `openSlotDrawer`, `editInspectionAction`, `confirmDangerZone` 헬퍼를 재사용해 중복 코드를 줄인다.

## 4. 시나리오 개요

### 4.1 `admin-smoke.spec.ts` (`@admin`)
1. 관리자 스토리지 상태로 `/admin/fridge` 진입 → 로고/알림 벨/프로필 버튼 노출 여부 확인.
2. 층 드롭다운이 기본 3F로 설정되어 있는지, 슬롯 카드 그리드가 첫 페이지에 로드되는지 검사한다.
3. 상단 도구 모음(`재배분`, `검사 일정`, `데모 데이터 초기화`) 버튼 클릭 시 각각 모달/시트가 열렸다가 닫히는지 확인한다.

### 4.2 `admin-fridge.spec.ts` (`@admin`, `@admin-fridge`)
1. 층 필터를 4F로 변경 → `useSearchParams`에 `floor=4`가 반영되고 카드 수가 맞는지 검증.
2. 슬롯 검색창에 `3F-305`를 입력해 해당 칸만 남는지 확인 후 `초기화` 버튼이 필터·페이지를 원상복구하는지 확인.
3. 카드 클릭 → 우측 패널 로드 → `칸 설정` 버튼으로 잠금 토글(성공 토스트 확인) → `재배분` 버튼 클릭 후 Step 1~3 진행, Mock API를 통해 성공 케이스와 경고(warnings) 뱃지 노출을 각각 검증.
4. `삭제 이력` 탭 전환 → 페이지네이션(10개 단위)과 `라벨 재사용` 배지 조건을 확인한다.

### 4.3 `admin-inspection.spec.ts` (`@admin`, `@admin-inspection`)
1. 하단 `최근 검사` 테이블에서 첫 행을 클릭해 상세 다이얼로그를 연다.
2. `정정` 버튼 → 조치 리스트 중 하나를 `폐기 → 경고`로 수정하고 메모를 입력 → 저장 시 PATCH 응답에 포함된 `updatedAt`/`correlationId`가 UI에 반영되는지 확인.
3. 정정 후 알림 탭에서 `알림 상태`가 `재발송 필요`로 전환되는지, `알림 재발송` 버튼 클릭 시 mock 토스트가 표시되는지 검증.
4. `재검 요청` 버튼 → 검사 일정 시트로 연결 → 일정 저장 성공 토스트와 audit toast(“감사 로그에 기록되었습니다”)가 모두 나타나는지 확인.

### 4.4 `admin-demo.spec.ts` (`@admin`, `@admin-demo`)
1. Danger Zone 카드에서 `데모 데이터 초기화` 클릭 → 확인 다이얼로그 copy가 운영 금지 경고를 포함하는지 확인.
2. 다이얼로그에서 `확인` 선택 시 `POST /admin/seed/fridge-demo` 요청을 mock → 200 응답 후 토스트 메시지(`FRIDGE_DEMO_DATA_REFRESHED`)와 카드 리스트 리프레시를 확인.
3. 실패 케이스(500 응답) 모킹 → 오류 토스트, Danger Zone 버튼 re-enable 여부를 검증한다.

### 4.5 `admin-responsive.spec.ts` (`@admin`, `@admin-responsive`) _옵션_
1. 1024px 뷰포트에서 패널이 슬라이드 형태로 전환되는지 시각 스냅샷 비교.
2. 768px 뷰포트에서 카드가 단일 열로 재배치되고 탭이 아이콘 형태로 변환되는지 확인.

## 5. 구현 메모
- 테스트 실행 예시: `npm run playwright:test -- --grep "@admin && !@admin-responsive"` (CI 기본). 반응형 스냅샷은 주간 배포 전 수동으로만 실행한다.
- Danger Zone, 재배분, 정정 PATCH는 실제 데이터를 변경하므로 `page.route`로 API를 mock 하거나 전용 테스트 DB를 사용한다.
- 관리자 시트/다이얼로그는 애니메이션이 250ms 지연되므로 `await drawer.waitFor({ state: "visible" })` 헬퍼를 반드시 호출한다.

## 6. TODO
1. `scripts/create-admin-storage.mjs`에 다중 계정 지원(층별장/거주자) 옵션 추가.
2. Notification 탭의 `알림 재발송` API가 실제 구현되면 mock 대신 성공/실패 케이스를 각각 검증하도록 스펙을 확장한다.
3. Deleted bundle 조회 시 검색어 자동완성(UI) 도입 후, Playwright 시나리오에 토글/자동완성 케이스를 추가한다.
