package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): 기숙사 호실 메타데이터 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1 `room`, docs/feature-inventory.md "회원가입".
 *  - 입력: 층(floor), 호실 번호(room_number), 수용 인원(capacity), 유형(room_type).
 *  - 처리: 가입 요청 및 배정 로직에서 유효성 검사, 칸-호실 매핑 정책에 활용.
 *  - 출력: RoomAssignment 및 냉장고 접근 정책에서 참조.
 */
@Entity
@Table(name = "room")
public class Room extends AbstractTimestampedEntity {
    // TODO (Skeleton): UUID 기반 id, floor(SMALLINT), roomNumber(VARCHAR(4)), RoomType(Enum) 필드 선언.
    // TODO (Skeleton): capacity, unique(floor, roomNumber) 제약, room_type CHECK 매핑 전략 정의.
    // TODO (Skeleton): RoomAssignment, SignupRequest와의 연관관계(@OneToMany 등) 방향 및 fetch 전략 설계.
    // TODO (Skeleton): 냉장고 칸 매핑(compartment_room_access)과의 간접 관계, 삭제 정책(TODO) 기록.
}
