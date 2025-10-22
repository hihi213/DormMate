package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): DormMate 역할 정의 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1 `role`, docs/feature-inventory.md "접근 정책".
 *  - 입력: 역할 코드(RESIDENT/FLOOR_MANAGER/ADMIN), 설명, 권한 메타데이터.
 *  - 처리: UserRole 매핑, 권한 인터셉터 로직에서 허용 범위를 판별.
 *  - 출력: 관리자 UI와 접근 제어 정책에 노출.
 */
@Entity
@Table(name = "role")
public class Role extends AbstractTimestampedEntity {
    // TODO (Skeleton): roleCode(Primary Key, VARCHAR(32)), name, description 필드 선언.
    // TODO (Skeleton): UserRole과의 연관관계 매핑(양방향 여부, fetch 전략) 결정.
    // TODO (Skeleton): 레퍼런스 데이터로 Seed할 초기 역할 목록(RESIDENT, FLOOR_MANAGER, ADMIN) 관리 전략 기록.
}
