-- Demo 계정 상태 복구

SET TIME ZONE 'UTC';

UPDATE dorm_user
   SET status = 'ACTIVE',
       updated_at = CURRENT_TIMESTAMP
 WHERE login_id IN ('alice', 'dylan');

-- ensure 기본 거주자 역할 유지
INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
SELECT gen_random_uuid(), du.id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM dorm_user du
 WHERE du.login_id IN ('alice', 'dylan')
   AND NOT EXISTS (
        SELECT 1
          FROM user_role ur
         WHERE ur.dorm_user_id = du.id
           AND ur.role_code = 'RESIDENT'
           AND ur.revoked_at IS NULL
   );
