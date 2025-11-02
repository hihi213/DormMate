import type { Page, Route } from '@playwright/test';

export type FixtureRole = 'resident' | 'floorManager' | 'admin';

type FixtureProfile = {
  userId: string;
  loginId: string;
  displayName: string;
  roles: Array<'RESIDENT' | 'FLOOR_MANAGER' | 'ADMIN'>;
  isFloorManager: boolean;
  isAdmin: boolean;
  primaryRoom?: {
    roomId: string;
    floor: number;
    roomNumber: string;
    personalNo: number;
    assignedAt: string;
  } | null;
};

const ROLE_METADATA: Record<FixtureRole, FixtureProfile> = {
  resident: {
    userId: 'fixture-resident',
    loginId: 'resident01',
    displayName: '거주자 테스트',
    roles: ['RESIDENT'],
    isFloorManager: false,
    isAdmin: false,
    primaryRoom: {
      roomId: 'room-201',
      floor: 2,
      roomNumber: '201',
      personalNo: 1,
      assignedAt: new Date().toISOString(),
    },
  },
  floorManager: {
    userId: 'fixture-floor-manager',
    loginId: 'floor01',
    displayName: '층별장 테스트',
    roles: ['RESIDENT', 'FLOOR_MANAGER'],
    isFloorManager: true,
    isAdmin: false,
    primaryRoom: {
      roomId: 'room-301',
      floor: 3,
      roomNumber: '301',
      personalNo: 1,
      assignedAt: new Date().toISOString(),
    },
  },
  admin: {
    userId: 'fixture-admin',
    loginId: 'admin',
    displayName: '관리자 테스트',
    roles: ['ADMIN', 'RESIDENT'],
    isFloorManager: false,
    isAdmin: true,
    primaryRoom: null,
  },
};

type SetupOptions = {
  role: FixtureRole;
};

const TOKEN_PREFIX = 'fixture-token';

export async function setupFixtureAuthSession(page: Page, options: SetupOptions) {
  const { role } = options;
  const now = Date.now();
  const accessExpiresAt = now + 60 * 60 * 1000;
  const refreshExpiresAt = now + 7 * 24 * 60 * 60 * 1000;
  const profile = ROLE_METADATA[role];
  const tokenSeed = `${TOKEN_PREFIX}-${role}`;

  // Playwright dev server는 localhost와 127.0.0.1을 혼용하므로 두 도메인에 쿠키를 설정한다.
  await page.context().addCookies([
    {
      name: 'dm_fixture_role',
      value: role,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
    {
      name: 'dm_fixture_role',
      value: role,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);

  await page.addInitScript(
    ({ role, accessExpiresAt, refreshExpiresAt, profile, tokenSeed }) => {
      window.localStorage.clear();
      window.localStorage.setItem('dm.fixture', '1');
      window.localStorage.setItem(
        'dm.auth.tokens',
        JSON.stringify({
          accessToken: `${tokenSeed}-access`,
          tokenType: 'Bearer',
          accessExpiresAt,
          refreshToken: `${tokenSeed}-refresh`,
          refreshExpiresAt,
        }),
      );
      window.localStorage.setItem(
        'dm.auth.profile',
        JSON.stringify({
          userId: profile.userId,
          loginId: profile.loginId,
          name: profile.displayName,
          room: profile.primaryRoom ? `${profile.primaryRoom.floor}층 ${profile.primaryRoom.roomNumber}호` : undefined,
          roles: profile.roles,
          isFloorManager: profile.isFloorManager,
          isAdmin: profile.isAdmin,
        }),
      );
      (window as any).__DM_FIXTURE__ = true;
      window.localStorage.setItem('dm.fixture.role', role);
    },
    { role, accessExpiresAt, refreshExpiresAt, profile, tokenSeed },
  );

  const slotFixture = {
    items: [
      {
        slotId: '00000000-0000-0000-0000-00000000a001',
        slotIndex: 0,
        slotLetter: 'A',
        floorNo: 2,
        floorCode: '2F',
        compartmentType: 'CHILL',
        resourceStatus: 'ACTIVE',
        locked: false,
        lockedUntil: null,
        capacity: 24,
        displayName: '2층 냉장 A',
        occupiedCount: 0,
      },
    ],
    totalCount: 1,
  };

  const canceledSession = {
    sessionId: '10000000-0000-0000-0000-000000000001',
    slotId: '00000000-0000-0000-0000-00000000a001',
    slotIndex: 0,
    slotLabel: 'A',
    floorNo: 2,
    floorCode: '2F',
    status: 'CANCELLED',
    startedBy: '20000000-0000-0000-0000-000000000002',
    startedAt: '2024-10-01T09:00:00Z',
    endedAt: '2024-10-01T09:15:00Z',
    bundles: [],
    summary: [
      {
        action: 'PASS',
        count: 1,
      },
    ],
    actions: [],
    notes: '자동화 테스트용 취소 세션 메모',
    initialBundleCount: 3,
    totalBundleCount: 3,
  };

  const handler = (route: Route) => {
    const url = new URL(route.request().url());
    const resource = url.searchParams.get('resource');
    if (resource === 'slots') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(slotFixture),
      });
    }
    if (resource === 'active') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([canceledSession]),
    });
  };

  await page.route('**/api/__fixtures__/fridge/inspections?*', handler);
  await page.route('**/api/__fixtures__/fridge/inspections', handler);
}
