# 입주자 계정 생애주기

기준일: 2026-10-13. 현재 구현의 화면·API·운영 계약이다.

## 입사부터 퇴사까지

1. 마이그레이션은 호실·개인번호별 슬롯과 비활성 계정을 준비한다. 아이디는 `201-1`처럼 호실과 개인번호의 조합이며 초기 비밀번호는 `0000`이다. 입사 처리 전에는 로그인할 수 없다.
2. 관리자는 `/admin/residents`에서 슬롯을 선택하고 이름과 처리 사유를 입력해 입사 처리한다. 이메일은 선택 사항이다. 입주자에게 아이디와 초기 비밀번호를 개별 안내한다.
3. 입주자는 로그인 직후 `/auth/change-password`에서 비밀번호를 변경한다. 변경 전에는 시설 이용과 개인정보 API가 `403 PASSWORD_CHANGE_REQUIRED`로 차단된다. 인증 세션 갱신·로그아웃 및 비밀번호 변경은 가능하다.
4. 새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하이며 현재 비밀번호와 달라야 한다. 변경하면 모든 기존 세션과 토큰이 무효화되므로 새 비밀번호로 다시 로그인한다.
5. 분실 시 관리자가 본인을 확인하고 사유를 남겨 `0000`으로 초기화한다. 기존 세션과 토큰은 무효화되고 다시 비밀번호 변경이 필요하다.
6. 퇴사 시 관리자가 퇴사 처리한다. 이전 계정은 `INACTIVE` 및 `retired_at`으로 기록하고 배정·역할·세션을 종료한다. 같은 아이디를 가진 새 UUID의 비활성 계정을 슬롯에 연결해 다음 입사를 준비한다. 퇴사 처리는 단순 비밀번호 초기화와 다르다.

초기 비밀번호가 공통이므로 실제 입사자 확인 후 활성화하고 바로 변경하도록 안내한다. 계정 활성화와 비밀번호 초기화는 관리자 권한으로만 수행한다.

## API

인증 헤더는 `Authorization: Bearer <accessToken>`이다. `{id}`는 사용자 UUID가 아닌 **슬롯 UUID**이다. 변경 요청 성공 응답은 `204 No Content`다.

| 메서드·경로 | 요청 또는 응답 | 권한 |
| --- | --- | --- |
| `GET /admin/resident-slots` | 슬롯 배열: `id`, `floor`, `roomNumber`, `personalNo`, `userId`, `loginId`, `displayName`, `status`, `mustChangePassword`, `occupied` | ADMIN |
| `POST /admin/resident-slots/{id}/check-in` | `name`(필수, 최대 100자), `email`(선택, 최대 320자), `reason`(필수, 최대 500자) | ADMIN |
| `POST /admin/resident-slots/{id}/reset-password` | `userId`(현재 거주자 UUID), `reason`(필수, 최대 500자) | ADMIN |
| `POST /admin/resident-slots/{id}/check-out` | `userId`(현재 거주자 UUID), `reason`(필수, 최대 500자) | ADMIN |
| `POST /auth/password` | `currentPassword`, `newPassword` | 로그인한 본인 |

`userId`는 관리자 화면을 연 뒤 거주자가 바뀌었을 때 다른 사람의 계정을 조작하지 않도록 검증한다. 입사 요청은 슬롯과 계정을 잠가 동시 중복 입사를 막는다.

| 오류 | 의미·대응 |
| --- | --- |
| `401 CREDENTIALS_CHANGED` | 비밀번호 또는 계정 상태 변경으로 인증 만료. 다시 로그인한다. |
| `403 CURRENT_PASSWORD_MISMATCH` | 현재 비밀번호를 다시 입력한다. |
| `409 OCCUPANT_CHANGED` | 슬롯의 거주자가 변경됨. 목록을 새로 조회한다. |
| `409 SLOT_ALREADY_OCCUPIED_OR_HAS_HISTORY` | 이미 입사했거나 사용 이력이 있는 계정으로 입사 불가. 상태를 확인한다. |
| `409 ACTIVE_INSPECTION_EXISTS` | 진행 중인 검사 담당자의 퇴사 불가. 검사를 먼저 종료한다. |
| `409 RESIDENT_NOT_ACTIVE` / `RESIDENT_NOT_ASSIGNED` | 초기화·퇴사의 대상 상태가 아님. 목록을 새로 조회한다. |
| `422 PASSWORD_POLICY_VIOLATION` | 비밀번호 정책 위반. DTO 형식 검증 실패는 별도의 400 응답일 수 있다. |

## 데이터·배포 유의점

- `resident_account_slot.current_user_id`만 다음 계정으로 교체한다. 이전 물품·벌점 등은 이전 UUID에 유지하고 새 계정의 개인 내역으로 승계하지 않는다. 공용 시설 내역은 시설별 조회 권한을 따르며 모든 과거 데이터가 숨겨진다는 의미는 아니다.
- `credential_version` 증가와 세션 폐기로 기존 access/refresh 인증을 무효화한다. 감사 로그에는 관리자와 처리 사유를 기록한다.
- 신규 운영 DB는 `db/production`의 V4, 기존 개발 이력은 `db/migration`의 V42를 사용한다. 한 DB에 두 경로를 섞거나 기존 DB를 새 경로로 바로 전환하지 않는다. 백업 및 Flyway 이력 확인이 필요하다.
- 현재 기준 데이터는 96개 호실, 278개 슬롯이다. 기존 계정의 비밀번호를 마이그레이션에서 일괄 덮어쓰지 않는다.
- UI `/auth/change-password`와 API `/auth/password`, UI `/admin/residents`와 API `/admin/resident-slots`를 구분한다.
