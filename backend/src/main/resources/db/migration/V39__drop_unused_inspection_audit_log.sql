DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_audit_log') THEN
        DROP TABLE inspection_audit_log;
    END IF;
END $$;
