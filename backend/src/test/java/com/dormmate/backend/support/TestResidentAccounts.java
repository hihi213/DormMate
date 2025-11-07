package com.dormmate.backend.support;

/**
 * Shared 테스트 계정 상수. 거주자 계정은 마이그레이션에서
 * login_id를 {@code floorRoom-personal_no} 형식으로 생성하며
 * 비밀번호는 모두 {@code user2025!}로 통일되어 있다.
 */
public final class TestResidentAccounts {

    public static final String DEFAULT_PASSWORD = "user2025!";

    public static final String FLOOR2_ROOM05_SLOT1 = "205-1";
    public static final String FLOOR2_ROOM05_SLOT2 = "205-2";
    public static final String FLOOR2_ROOM05_SLOT3 = "205-3";
    public static final String FLOOR2_ROOM17_SLOT2 = "217-2";
    public static final String FLOOR3_ROOM05_SLOT1 = "305-1";

    private TestResidentAccounts() {
        // utility
    }
}
