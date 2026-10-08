# UI Flow (Reverse-Engineered)

이 문서는 현재 UI(Next.js `frontend/app`) 기준으로 화면 흐름을 역설계한 정리본입니다.
## 공통 네비게이션/규칙
- 하단 탭: `냉장고(/fridge)`, `세탁실(/laundry)`, `홈(/)`, `도서관(/library)`, `다목적실(/study)`
- 로그인 필요 화면은 `AuthGuard`로 보호됨
  - 비로그인 상태면 `/auth?mode=login&redirect=<현재경로>`로 이동
  - 픽스처 모드에서는 로그인 우회 가능 (`NEXT_PUBLIC_FIXTURE=1` 또는 `localStorage dm.fixture=1`)
- 관리자는 홈(`/`) 진입 시 `/admin`으로 리다이렉트됨

---

## 단계 1 (물품 CRUD) - 냉장고 기본 흐름
### 핵심 화면
- `/:` 홈(공지 카드, 로그인 유도)
- `/fridge`: 물품 목록/검색/필터/등록 진입
- `/fridge/item/[id]`: 개별 물품 상세 (직접 링크 진입용)
- `/fridge/bundle/[bundleId]`: 번들 상세 (직접 링크 진입용)

### 사용자 흐름
1) 홈(`/`)에서 냉장고 탭 클릭 → `/fridge`
2) `/fridge`에서 탭/검색/필터로 목록 탐색
3) `+` 또는 등록 버튼 → 등록 다이얼로그
4) 등록 완료 → 목록 갱신 (번들 + 아이템 생성)
5) 항목 클릭 → 번들 상세 시트 열림
6) 번들/아이템 수정 → 저장 후 목록 반영

### `/fridge` 화면 동작 요약
- 탭: `전체/내 물품/임박/만료`
- 검색/필터: 키워드 검색 + 슬롯 선택
- 등록: AddItemDialog에서 번들 + 아이템 입력
- 상세/수정: 번들 상세 시트에서 번들/아이템 수정
- 쿼리 기반 진입:
  - `?bundle=<id>` → 번들 시트 오픈
  - `?item=<id>` → 해당 아이템의 번들 시트 오픈

### 사용자 시나리오
- 거주자: 번들을 등록하고(번들 안에 아이템 포함), 임박/만료 탭으로 상태를 확인한다.

### API 의존성
- `GET /fridge/slots`
- `GET /fridge/bundles`
- `POST /fridge/bundles`
- `PATCH /fridge/bundles/{bundleId}`
- `DELETE /fridge/bundles/{bundleId}`
- `PATCH /fridge/items/{itemId}`
- `DELETE /fridge/items/{itemId}`

---

## 단계 2 (로그인/회원 시스템)
### 핵심 화면
- `/auth?mode=login`: 로그인 패널
- `/auth?mode=signup`: 회원가입 패널 (현재 UI는 비활성 안내)
- `/auth/logout`: 로그아웃 처리 페이지
- `/auth/login`, `/auth/signup`: `/auth`로 리다이렉트

### 사용자 흐름
1) 보호된 페이지 진입 시 로그인 안내 → `/auth?mode=login`
2) 로그인 성공 시 `redirect` 파라미터로 원래 화면 복귀
3) 회원가입 화면은 안내만 제공 (관리자 발급 필요)

### 사용자 시나리오
- 비로그인 사용자: 보호된 화면 접근 시 로그인 화면으로 이동해 인증을 완료한다.
- 회원가입 화면은 실제 가입 폼이 아닌 안내 화면으로 제공된다.

### API 의존성
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /profile/me`

---

## 단계 3 (냉장고 검사)
### 핵심 화면
- `/fridge/inspections`: 검사 일정/이력/세션 관리
- `/fridge/inspect`: 검사 수행 화면 (진행 중 세션)

### 사용자 흐름 (층별장/관리자)
1) `/fridge/inspections`에서 검사 일정 확인
2) 슬롯 선택 후 검사 시작 → `/fridge/inspect`
3) 검사 전/완료 탭 전환하며 조치 기록
4) 제출 시 결과 저장 및 세션 종료
5) 완료 세션은 검사 이력에서 확인

### `/fridge/inspections` 주요 동작
- 검사 일정 생성/수정/삭제
- 진행 중 세션 확인 및 재진입
- 완료/취소 이력 목록 제공

### `/fridge/inspect` 주요 동작
- 검사 항목 검색/필터
- 조치 기록(통과/경고/폐기)
- 제출/취소 다이얼로그
- 30초 간격 세션 상태 동기화
- 진행 중 세션이 없으면 `/fridge/inspections`로 이동

### 사용자 시나리오
- 층별장: 검사 개요에서 오늘 일정 확인 -> 검사 시작 -> 조치 기록 -> 제출.

### API 의존성
- `POST /fridge/inspections`
- `GET /fridge/inspections/active`
- `GET /fridge/inspections/{sessionId}`
- `DELETE /fridge/inspections/{sessionId}`
- `POST /fridge/inspections/{sessionId}/actions`
- `DELETE /fridge/inspections/{sessionId}/actions/{actionId}`
- `POST /fridge/inspections/{sessionId}/submit`
- `GET /fridge/inspections` (이력)
- `GET /fridge/inspection-schedules`
- `GET /fridge/inspection-schedules/next`
- `POST /fridge/inspection-schedules`
- `PATCH /fridge/inspection-schedules/{scheduleId}`
- `DELETE /fridge/inspection-schedules/{scheduleId}`

---

## 단계 4 (유틸리티: 알림)
### 핵심 화면
- `/notifications`: 사용자 알림 센터
- `/admin/notifications`: 관리자 알림/정책 관리

### 사용자 알림 흐름 (`/notifications`)
1) 알림 목록 로드 (전체/미읽음/읽음)
2) 개별 읽음 처리 or 전체 읽음 처리
3) 알림 설정(종류별 ON/OFF, 백그라운드 허용)
4) 브라우저 알림 권한 상태 표시 (UI만 제공, 실제 Push 발송은 미구현)

### 관리자 알림 흐름 (`/admin/notifications`)
1) 알림 목록 필터/조회/읽음 처리
2) 알림 정책 확인(배치 시각/TTL/상한)
3) 정책 수정 UI 제공 (저장 동작은 백엔드 연동 예정)

### 사용자 시나리오
- 거주자: 알림 센터에서 검사 결과/임박 알림을 읽음 처리한다.

### API 의존성
- `GET /notifications`
- `PATCH /notifications/{notificationId}/read`
- `PATCH /notifications/read-all`
- `GET /notifications/preferences`
- `PATCH /notifications/preferences/{kindCode}`

---

## 단계 5 (관리자 기능)
### 핵심 화면
- `/admin`: 관리자 대시보드
- `/admin/fridge`: 냉장고 운영 관리
- `/admin/users`: 사용자/역할 관리
- `/admin/audit`: 감사 로그/리포트

### 관리자 흐름
1) `/` 진입 시 관리자면 `/admin`으로 이동
2) 대시보드에서 빠른 액션/모듈 상태 확인
3) 냉장고 운영(/admin/fridge)에서 칸 상태/검사/재배분 관리
4) 사용자 관리(/admin/users)에서 역할 승격/해제, 계정 비활성화
5) 감사 로그(/admin/audit)에서 주요 이벤트/리포트 확인

### `/admin/fridge` 주요 동작
- 칸 상태(운영/잠금/이슈/퇴역) 변경
- 번들 목록/삭제 이력 조회
- 검사 세션 조회 및 정정
- 칸 재배분 시뮬레이션/적용

### 사용자 시나리오
- 관리자: 대시보드에서 모듈 상태 확인 -> 냉장고 운영 화면에서 칸 상태/검사 정정 -> 사용자 역할 변경.

### API 의존성
- `GET /admin/dashboard`
- `GET /admin/users`
- `POST /admin/users/{userId}/roles/floor-manager`
- `DELETE /admin/users/{userId}/roles/floor-manager`
- `PATCH /admin/users/{userId}/status`
- `GET /admin/policies`
- `PUT /admin/policies`
- `GET /admin/fridge/compartments`
- `PATCH /admin/fridge/compartments/{compartmentId}`
- `GET /fridge/bundles` (관리자 화면에서도 동일 엔드포인트 사용)
- `GET /admin/fridge/bundles/deleted`
- `GET /fridge/inspections` (관리자 화면에서도 동일 엔드포인트 사용)
- `PATCH /fridge/inspections/{sessionId}` (관리자 정정, 동일 엔드포인트 사용)
- `POST /fridge/inspections/{sessionId}/notifications/resend`
- `POST /admin/fridge/reallocations/preview`
- `POST /admin/fridge/reallocations/apply`
- `GET /admin/fridge/issues`

---

## 범위 외(현재 UI는 안내 카드만 제공)
- `/laundry`: 세탁실 모듈 (준비 중)
- `/library`: 도서관 모듈 (준비 중)
- `/study`: 다목적실 모듈 (준비 중)
