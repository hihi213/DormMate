DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'inspection_schedule'
          AND column_name = 'fridge_compartment_id'
    ) THEN
        ALTER TABLE inspection_schedule
            ADD COLUMN fridge_compartment_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'inspection_schedule'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name = 'fk_inspection_schedule_fridge_compartment'
    ) THEN
        ALTER TABLE inspection_schedule
            ADD CONSTRAINT fk_inspection_schedule_fridge_compartment
                FOREIGN KEY (fridge_compartment_id)
                REFERENCES fridge_compartment (id);
    END IF;
END $$;
