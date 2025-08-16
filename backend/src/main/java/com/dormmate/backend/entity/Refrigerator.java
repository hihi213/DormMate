package com.dormmate.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "refrigerators")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Refrigerator {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id")
    private DormitoryBuilding building;
    
    @Column(name = "floor_number", nullable = false)
    private Integer floorNumber;
    
    @Column(name = "location_description")
    private String locationDescription;
    
    @Column(name = "capacity_liters")
    private Integer capacityLiters;
    
    @Column(name = "is_available")
    private Boolean isAvailable;
    
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @OneToMany(mappedBy = "refrigerator", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Item> items;
    
    @PrePersist
    protected void onCreate() {
        if (isAvailable == null) {
            isAvailable = true;
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
