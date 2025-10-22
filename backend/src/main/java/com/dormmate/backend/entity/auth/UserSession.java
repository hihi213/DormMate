package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): DormMate 세션/토큰 저장소 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1 `user_session`, docs/feature-inventory.md "로그인·세션".
 *  - 입력: 로그인 성공 시 발급된 세션 식별자, 만료 시각(7일), 디바이스/IP 메타데이터 등.
 *  - 처리: 비밀번호 변경 시 세션 무효화, 동시 세션 관리, 만료 처리.
 *  - 출력: 인증 필터 및 세션 검증 로직에서 조회.
 */
@Entity
@Table(name = "user_session")
public class UserSession extends AbstractTimestampedEntity {
    // TODO (Skeleton): UUID 기반 id, DormUser FK, refreshToken(unique), issuedAt, expiresAt, revokedAt 필드 정의.
    // TODO (Skeleton): refresh_token unique 제약 및 active 세션 인덱스(dorm_user_id, expires_at where revoked_at is null) 매핑 전략 정리.
    // TODO (Skeleton): revokedReason, 클라이언트 메타데이터(UA/IP) 저장 여부와 컬럼 길이 정책 공유.
}
