package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): 사용자-역할 매핑 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1 `user_role`, docs/feature-inventory.md "접근 정책".
 *  - 입력: DormUser, Role, 부여 시각(grantedAt), 부여자(grantedBy), 해제 시각(revokedAt).
 *  - 처리: 층별장 임명/해제 즉시 반영, 동시 세션 권한 업데이트.
 *  - 출력: 인증 인가 필터, 관리자 권한 관리 화면에서 조회.
 */
@Entity
@Table(name = "user_role")
public class UserRole extends AbstractTimestampedEntity {
    // TODO (Skeleton): UUID 기반 id, dormUser FK, role FK, grantedAt, grantedBy, revokedAt 필드 정의.
    // TODO (Skeleton): 활성 역할(unique dorm_user_id + role_code where revoked_at is null) 인덱스 매핑 설계.
    // TODO (Skeleton): grantedBy(관리자) DormUser FK와의 순환 참조 처리, soft-delete 정책 검토.
}
