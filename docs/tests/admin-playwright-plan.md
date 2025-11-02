# 관리자 Playwright 시나리오 설계
*최종 업데이트: 2025-11-01 · 담당: Codex(Frontend)*

## 1. 목적
- 관리자 핵심 플로우(자원 관리, 권한·정책, 위험 액션)를 `@admin` 태그 체계로 묶어 회귀 테스트를 표준화한다.
- 기존 사용자/층별장 시나리오와 충돌하지 않도록 별도 storage state(`storage/admin.json`)를 사용한다.

## 2. 태그 구조
| 태그 | 커버 범위 | 비고 |
| --- | --- | --- |
| `@admin` | 공통 관리자 smoke (로그인, 대시보드 렌더) | 모든 관리자 스펙의 상위 태그 |
| `@admin-resource` | 냉장고 자원 관리(필터, 상세 Drawer, 재배분 흐름) | Future: 세탁/도서관/다목적실 확장 |
| `@admin-roles` | 층별장 임명/해제, 관리자 권한 변경 | 진행 중 검사 세션 경고 검사 |
| `@admin-policy` | 알림·벌점 정책 수정, DangerZone 확인 | 09:00 배치/TTL 재설정 검증 |
| `@admin-report` | 보고서 다운로드, 감사 로그 조회 | CSV 존재 여부 및 파일명 패턴 검사 |
| `@admin-responsive` (옵션) | 주요 화면 반응형 뷰포트 스냅샷 | smoke 완료 후 opt-in |

## 3. 사전 준비
- `frontend/tests/e2e/.auth/admin.json` : 관리자 계정 세션 스토리지 (CLI `npm run playwright:create-admin-storage` 명령으로 생성).
- 테스트 데이터: 데모 Seed(`POST /admin/seed/fridge-demo`) 후 라벨 범위/칸 상태 기본값 확인.
- Feature Flag: `ADMIN_MODULE_FLAGS=laundry,library,multipurpose` 환경 변수로 Phase 2 탭 노출 여부 제어.
- Playwright 설정: `.env` 또는 스크립트 실행 시 `PLAYWRIGHT_STORAGE_STATE=tests/e2e/.auth/admin.json`을 지정하면 공통 스토리지 상태를 재사용할 수 있다.
- 유틸 헬퍼: `tests/e2e/utils/admin.ts`에서 `selectFilter`, `expectDrawerOpen`, `confirmDangerZone` 함수를 제공한다.

## 4. 시나리오 개요

### 4.1 `admin-dashboard.spec.ts` (`@admin`)
1. 관리자 계정 로그인 → 하단 탭에 `관리(⚙️)` 노출 확인.
2. 대시보드 KPI 카드 및 오늘의 타임라인 로드.
3. 빠른 실행 카드 클릭 시 관리 허브 Drawer가 열리는지 확인(중복 폼 금지).

### 4.2 `admin-resource.spec.ts` (`@admin`, `@admin-resource`)
1. 자원 관리 탭 이동 → FilterBar 값 입력/초기화 동작.
2. 특정 칸 선택 후 BulkEditor 노출 및 `재배분` 버튼 클릭 → Drawer Step 1~3 이동 확인.
3. DangerZoneModal에서 취소 → prod 환경 가드 토스트 메시지 확인(모킹).

### 4.3 `admin-roles.spec.ts` (`@admin`, `@admin-roles`)
1. 권한·계정 탭 → 층별장 필터 적용.
2. 행 선택 후 `층별장 해제` 클릭 → 진행 중 검사 세션 안내 노출 확인.
3. 임명/해제 성공 후 감사 로그 Drawer에서 최근 항목 존재 검증.

### 4.4 `admin-policy.spec.ts` (`@admin`, `@admin-policy`)
1. 알림·정책 탭 → 09:00 배치 시간을 07:30으로 수정 후 저장.
2. 테스트 발송 버튼 → 성공 토스트, Notification Outbox 레코드 확인.
3. 벌점 임계치 조정 → 예상 제재 대상 Diff 리스트 렌더 확인.

### 4.5 `admin-report.spec.ts` (`@admin`, `@admin-report`)
1. 보고서 생성 → 다운로드 링크와 파일명(`admin-report-YYYYMMDD.csv`) 규칙 검증.
2. 감사 로그 테이블 필터(기간/모듈) 적용 후 행 수 변화 확인.

## 5. 구현 메모
- 공통 헬퍼: `tests/e2e/utils/admin.ts`에 `selectFilter`, `openDrawer`, `confirmDangerZone` 유틸 추가.
- 스냅샷은 Dark/Light 2가지 테마 중 기본(라이트)만 유지, 배포 전 수동 검토.
- CLI 명령 예시: `npm run playwright:test -- --grep "@admin && !@admin-responsive"`.

## 6. TODO
1. Playwright storage state 생성을 위한 `scripts/create-admin-session.ts` 추가.
2. DangerZone 동작은 mock API(`PATCH /admin/fridge/compartments/...`)를 intercept해 회귀 테스트의 파괴적 영향을 차단.
3. Phase 2 모듈 합류 시 `@admin-resource` 케이스를 파라미터화해 시설 유형별로 반복 테스트.
