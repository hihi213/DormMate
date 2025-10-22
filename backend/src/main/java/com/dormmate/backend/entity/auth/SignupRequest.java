package com.dormmate.backend.entity.auth;

import com.dormmate.backend.entity.AbstractTimestampedEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TODO (Skeleton): DormMate 가입 요청을 저장하는 엔터티.
 *  - 정책 근거: docs/data-model.md §4.1, docs/feature-inventory.md §1 "회원가입".
 *  - 입력: 호실, 개인번호, 로그인 ID, 이메일 등 가입 신청 데이터.
 *  - 처리: 관리자 승인/반려 시 상태 전이와 decision_note 기록, 승인자 정보 저장.
 *  - 출력: 가입 대기 목록, 감사 로그, 승인 이력 조회에서 사용.
 */
@Entity
@Table(name = "signup_request")
public class SignupRequest extends AbstractTimestampedEntity {
    // TODO (Skeleton): UUID 기반 id, Room FK, personalNo, loginId, email, status(PENDING/APPROVED/REJECTED) 필드 정의.
    // TODO (Skeleton): DormUser(승인자)와의 관계 매핑 및 reviewedAt/decisionNote 컬럼 매핑 전략 정리.
    // TODO (Skeleton): pending 유니크 인덱스(room_id+personal_no, status='PENDING') 처리 방법을 엔티티에 반영할지 결정.
}
