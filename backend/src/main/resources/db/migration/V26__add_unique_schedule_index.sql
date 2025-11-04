DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uq_inspection_schedule_active_compartment_scheduled_at'
    ) THEN
        CREATE UNIQUE INDEX uq_inspection_schedule_active_compartment_scheduled_at
            ON inspection_schedule (fridge_compartment_id, scheduled_at)
            WHERE status = 'SCHEDULED' AND fridge_compartment_id IS NOT NULL;
    END IF;
END $$;
