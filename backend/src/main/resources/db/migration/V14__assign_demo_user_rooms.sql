-- 데모 사용자 호실 배정 로직은 제거되었다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    RAISE NOTICE 'V14__assign_demo_user_rooms: no-op (demo users removed).';
END $$;
