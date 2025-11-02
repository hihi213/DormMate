import { test, expect } from '@playwright/test';

test.describe('검사 취소 상태 회귀', () => {
  test('거주자 화면 검사 이력에서 취소 세션을 취소 배지로 표기한다', async ({ page }) => {
    const cancelNote = '자동화 테스트용 취소 세션 메모';

    const now = Date.now();
    const accessExpiresAt = now + 60 * 60 * 1000;
    const refreshExpiresAt = now + 7 * 24 * 60 * 60 * 1000;

    await page.addInitScript(
      (scriptArgs) => {
        const { cancelNote, accessExpiresAt, refreshExpiresAt } = scriptArgs;
        window.localStorage.clear();
        window.localStorage.setItem('dm.fixture', '1');
        window.localStorage.setItem(
          'dm.auth.tokens',
          JSON.stringify({
            accessToken: 'test-access-token',
            tokenType: 'Bearer',
            accessExpiresAt,
            refreshToken: 'test-refresh-token',
            refreshExpiresAt,
          }),
        );
        window.localStorage.setItem(
          'dm.auth.profile',
          JSON.stringify({
            userId: 'test-user',
            loginId: 'resident01',
            name: '테스트 사용자',
            room: '2층 201호',
            roles: ['RESIDENT'],
            isFloorManager: false,
            isAdmin: false,
          }),
        );
        (window as any).__DM_FIXTURE__ = true;
        (window as any).__DM_TEST_FIXTURE__ = { cancelNote };
      },
      { cancelNote, accessExpiresAt, refreshExpiresAt },
    );

    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        const resourceType = route.request().resourceType();
        if (resourceType === 'document') {
          return route.continue();
        }

        if (route.request().method() === 'GET' && url.pathname === '/api/__fixtures__/fridge/inspections') {
          const resource = url.searchParams.get('resource') ?? 'history';
          if (resource === 'slots') {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
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
              }),
            });
          }

          if (resource === 'active') {
            return route.fulfill({ status: 204, body: '' });
          }

          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
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
                notes: cancelNote,
              },
            ]),
          });
        }

        if (route.request().method() === 'GET' && url.pathname.startsWith('/fridge/inspections')) {
          const fixture = {
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
            notes: cancelNote,
          };

          if (url.pathname.endsWith('/active')) {
            return route.fulfill({ status: 204, body: '' });
          }

          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([fixture]),
          });
        }

        if (
          route.request().method() === 'GET' &&
          url.pathname === '/fridge/slots' &&
          url.searchParams.get('view') === 'full'
        ) {
          const slotsResponse = {
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

          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(slotsResponse),
          });
        }

        if (route.request().method() === 'GET' && url.pathname === '/profile/me') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              userId: 'test-user',
              loginId: 'resident01',
              displayName: '테스트 사용자',
              roles: ['RESIDENT'],
              primaryRoom: {
                roomId: 'room-201',
                floor: 2,
                roomNumber: '201',
                personalNo: 1,
                assignedAt: new Date().toISOString(),
              },
              isFloorManager: false,
              isAdmin: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          });
        }
      }
      route.continue();
    });

    await page.goto('/fridge/inspections');

    const historyCard = page
      .locator('div.rounded-lg')
      .filter({ hasText: cancelNote })
      .first();

    await expect(historyCard).toBeVisible({ timeout: 10_000 });
    await expect(
      historyCard.locator('[data-slot="badge"]').filter({ hasText: '취소' }).first(),
    ).toBeVisible();
    await expect(historyCard.getByText(cancelNote)).toBeVisible();
  });
});
