package com.dormmate.backend.entity.auth;

import java.time.OffsetDateTime;
import java.util.*;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * TODO (Skeleton): DormMate 거주자 계정을 표현하는 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1, docs/feature-inventory.md §1.
 *  - 입력: 가입 승인 후 활성화된 사용자 정보, 상태 값(PENDING/ACTIVE/INACTIVE), 이메일, 비밀번호 해시 등.
 *  - 처리: 역할 매핑·세션 관리·탈퇴 처리에서 참조, 감사 로그와도 연계 예정.
 *  - 출력: AUTH-01 흐름 전반에서 사용자 기본 정보를 노출.
 */
@Entity
@Table(name = "dorm_users") 
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DormUser extends AbstractTimestampedEntity{
    // TODO (Skeleton): UUID 기반 id, loginId(Unique, lower-case), passwordHash, fullName, email 지정.
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name="id",nullable = false)
    private UUID id;

    @Column(name="login_id", nullable = false, unique = true)
    private String loginId;
    @Column(name="password_hash", nullable = false)
    private String passwordHash;
    @Column(name="full_name", nullable = false)
    private String fullName;
    @Column(name="email", nullable = false)
    private String email;


    // TODO (Skeleton): DormUserStatus status 컬럼과 createdAt/updatedAt/deactivatedAt 타임스탬프 매핑.
    @Enumerated(EnumType.STRING)
    private DormUserStatus status;
    //PostgreSQL이라면 OffsetDateTime(timezone 포함) 또는 Instant를 쓰면 UTC 기준 기록이 쉬워집니다.
    @Column(name="created_at",nullable = false)
    private OffsetDateTime createdAt;
    @Column(name="updated_at",nullable = false)
    private OffsetDateTime updatedAt;
    @Column(name="deactivated_at")
    private OffsetDateTime deactivatedAt;
    // TODO (Skeleton): UserRole, RoomAssignment, UserSession과의 연관관계 매핑 및 fetch 전략 결정.
    // TODO (Skeleton): 감사 로그 등 공통 메타데이터 베이스 클래스 편입 여부 검토.
}

