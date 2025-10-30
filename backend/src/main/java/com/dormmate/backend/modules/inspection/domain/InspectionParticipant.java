package com.dormmate.backend.modules.inspection.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

// SSE 기반 다중 검사자 합류 기능을 차기 단계에서 열 때 사용할 예정인 엔티티다.
@Entity
@Table(name = "inspection_participant")
public class InspectionParticipant extends AbstractTimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_session_id", nullable = false)
    private InspectionSession inspectionSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dorm_user_id", nullable = false)
    private DormUser dormUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private InspectionParticipantRole role;

    @Column(name = "joined_at", nullable = false)
    private OffsetDateTime joinedAt;

    @Column(name = "left_at")
    private OffsetDateTime leftAt;

    public Long getId() {
        return id;
    }

    public InspectionSession getInspectionSession() {
        return inspectionSession;
    }

    public void setInspectionSession(InspectionSession inspectionSession) {
        this.inspectionSession = inspectionSession;
    }

    public DormUser getDormUser() {
        return dormUser;
    }

    public void setDormUser(DormUser dormUser) {
        this.dormUser = dormUser;
    }

    public InspectionParticipantRole getRole() {
        return role;
    }

    public void setRole(InspectionParticipantRole role) {
        this.role = role;
    }

    public OffsetDateTime getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(OffsetDateTime joinedAt) {
        this.joinedAt = joinedAt;
    }

    public OffsetDateTime getLeftAt() {
        return leftAt;
    }

    public void setLeftAt(OffsetDateTime leftAt) {
        this.leftAt = leftAt;
    }

    public UUID getUserId() {
        return dormUser != null ? dormUser.getId() : null;
    }
}
