package com.dormmate.backend.entity;

/**
 * TODO (Skeleton): Timestamp 감사 필드를 공통으로 제공하는 베이스 엔터티.
 *  - 목적: createdAt/updatedAt과 createdBy/updatedBy를 일관되게 관리한다.
 *  - 근거: docs/data-model.md §4 공통 Timestamp 정책, AUTH-01 범위 및 이후 모듈 재사용 계획.
 *
 * TODO (Skeleton):
 *  - @MappedSuperclass + @EntityListeners(AuditingEntityListener.class) 적용 위치 확정.
 *  - createdAt/updatedAt 필드 타입(OffsetDateTime vs Instant)과 @CreatedDate/@LastModifiedDate 조합 정의.
 *  - createdBy/updatedBy 필드 타입(UUID vs String)과 AuditorAware 연동 방식 확정.
 *  - Flyway DEFAULT CURRENT_TIMESTAMP와 insertable/updatable 속성 충돌 여부 검토.
 *  - 시스템 이벤트용 SYSTEM_USER_UUID 및 Optional 처리 규칙 문서화.
 */
public abstract class AbstractTimestampedEntity {
    // TODO (Skeleton): createdAt/updatedAt 필드와 접근자 정의.
    // TODO (Skeleton): createdBy/updatedBy 필드와 감사 주체 매핑 로직 추가.
    // TODO (Skeleton): 감사 필드의 JSON 직렬화/응답 포함 여부 결정.
}

