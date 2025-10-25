package com.dormmate.backend.modules.inspection.domain;

import java.time.OffsetDateTime;

import com.dormmate.backend.global.jpa.AbstractTimestampedEntity;
import com.dormmate.backend.modules.auth.domain.DormUser;
import com.dormmate.backend.modules.auth.domain.Room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "unregistered_item_event")
public class UnregisteredItemEvent extends AbstractTimestampedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_session_id", nullable = false)
    private InspectionSession inspectionSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by", nullable = false)
    private DormUser reportedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approx_room_id")
    private Room approximateRoom;

    @Column(name = "item_description", nullable = false)
    private String itemDescription;

    @Column(name = "disposed_at")
    private OffsetDateTime disposedAt;

    public Long getId() {
        return id;
    }

    public InspectionSession getInspectionSession() {
        return inspectionSession;
    }

    public void setInspectionSession(InspectionSession inspectionSession) {
        this.inspectionSession = inspectionSession;
    }

    public DormUser getReportedBy() {
        return reportedBy;
    }

    public void setReportedBy(DormUser reportedBy) {
        this.reportedBy = reportedBy;
    }

    public Room getApproximateRoom() {
        return approximateRoom;
    }

    public void setApproximateRoom(Room approximateRoom) {
        this.approximateRoom = approximateRoom;
    }

    public String getItemDescription() {
        return itemDescription;
    }

    public void setItemDescription(String itemDescription) {
        this.itemDescription = itemDescription;
    }

    public OffsetDateTime getDisposedAt() {
        return disposedAt;
    }

    public void setDisposedAt(OffsetDateTime disposedAt) {
        this.disposedAt = disposedAt;
    }

}
