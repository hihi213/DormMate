package com.dormmate.backend.modules.inspection.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class InspectionLockMaintenanceScheduler {

    private static final Logger log = LoggerFactory.getLogger(InspectionLockMaintenanceScheduler.class);

    private final InspectionService inspectionService;

    public InspectionLockMaintenanceScheduler(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @Scheduled(fixedDelayString = "${app.inspection.lock-release-interval:PT5M}")
    @Transactional
    public void releaseExpiredLocks() {
        int released = inspectionService.releaseExpiredSessions();
        if (released > 0) {
            log.info("Released {} expired inspection locks", released);
        }
    }
}

