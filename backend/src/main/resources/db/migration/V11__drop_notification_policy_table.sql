-- Remove legacy notification_policy table introduced for 확장 과제.
-- V4에서 생성됐던 구조를 안전하게 정리하고, Flyway checksum 충돌을 피하기 위해 별도 단계로 분리한다.

DROP TABLE IF EXISTS notification_policy;
