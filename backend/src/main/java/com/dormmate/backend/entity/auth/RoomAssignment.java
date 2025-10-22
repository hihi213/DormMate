package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): 호실 배정 이력 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1 `room_assignment`, docs/feature-inventory.md §1 "접근 정책".
 *  - 입력: DormUser, Room, 개인 번호, 입주/퇴사 시각(assignedAt/releasedAt).
 *  - 처리: 칸 접근 제어, 탈퇴 후 이력 보존, 동시 배정 검증.
 *  - 출력: 현재 배정/과거 이력 조회 및 승인 과정 교차 검증.
 */
@Entity
@Table(name = "room_assignment")
public class RoomAssignment extends AbstractTimestampedEntity {
    // TODO (Skeleton): UUID 기반 id, DormUser/Room FK 매핑, personalNo, assignedAt, releasedAt 필드 정의.
    // TODO (Skeleton): 활성 배정(unique room_id+personal_no where released_at is null) 인덱스 매핑 전략 기록.
    // TODO (Skeleton): DormUser, Room과의 연관관계 방향(다대일) 및 cascade 정책 검토.
    // TODO (Skeleton): 향후 칸-호실 매핑 검증 로직과의 연동 포인트 명시.
}
