import { test, expect } from '@playwright/test';
import { apiAs, state, storageFile } from './support/fixtures';

test.describe('Authentication', () => {
  test('signs in with valid credentials and lands on the requested page', async ({ page }) => {
    const { users, password } = state();
    await page.goto('/auth.html?redirect=dashboard.html');
    await page.getByLabel('Email address').fill(users.customer.email);
    await page.getByLabel('Password').fill(password);
    await page.locator('#auth-form').getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard\.html$/);
    await expect(page.locator('.user-pill')).toHaveText('Hi, ' + users.customer.firstName);
    await expect(page.locator('.section-head h2')).toHaveText('My Trips');
  });

  test('rejects invalid credentials without signing in', async ({ page }) => {
    const { users } = state();
    await page.goto('/auth.html');
    await page.getByLabel('Email address').fill(users.customer.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.locator('#auth-form').getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('#auth-form').getByRole('alert')).toContainText(/invalid/i);
    await expect(page).toHaveURL(/auth\.html/);
    expect((await page.context().cookies()).some((c) => c.name === 'safar_session')).toBe(false);
  });

  test('redirects unauthenticated visitors away from protected pages and the API refuses them', async ({ page }) => {
    for (const path of ['/dashboard.html', '/kyc.html', '/host-onboarding.html', '/admin.html']) {
      await page.goto(path);
      await expect(page).toHaveURL(/auth\.html\?redirect=/);
    }
    const anonymous = await apiAs();
    for (const path of ['/api/auth/profile', '/api/bookings/my-trips', '/api/vehicles/mine', '/api/admin']) expect((await anonymous.get(path)).status(), path).toBe(401);
    await anonymous.dispose();
  });

  test('signing out clears the session cookie and protected requests are refused', async ({ page }) => {
    const { users, password } = state();
    await page.goto('/auth.html');
    await page.getByLabel('Email address').fill(users.hostB.email);
    await page.getByLabel('Password').fill(password);
    await page.locator('#auth-form').getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('auth.html'));
    expect((await page.request.get('/api/auth/profile')).status()).toBe(200);
    // Sign out lives in the account menu.
    await page.locator('.ds-user-menu summary').click();
    await page.getByRole('menuitem', { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/auth\.html/);
    expect((await page.context().cookies()).some((c) => c.name === 'safar_session')).toBe(false);
    expect((await page.request.get('/api/auth/profile')).status()).toBe(401);
    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/auth\.html\?redirect=/);
  });
});

test.describe('Role restrictions', () => {
  for (const role of ['customer', 'hostA', 'dealer'] as const) {
    test(`${role} cannot open the admin panel or call admin APIs`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: storageFile(role) });
      const page = await context.newPage();
      await page.goto('/admin.html');
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
      await expect(page.locator('.admin-tabs')).toHaveCount(0);
      for (const [method, path] of [['get', '/api/admin'], ['get', '/api/admin/export.csv'], ['post', '/api/admin/vehicles/pw-car-a/review'], ['post', '/api/admin/users/pw-customer/block'], ['get', '/api/payouts/accounts']] as const) {
        const res = method === 'get' ? await page.request.get(path) : await page.request.post(path, { data: { status: 'ACTIVE', note: 'x', blocked: true } });
        expect(res.status(), `${role} ${path}`).toBe(403);
      }
      await context.close();
    });
  }

  test('customers cannot open the vehicle owner panel or list a car', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageFile('customer') });
    const page = await context.newPage();
    await page.goto('/host-onboarding.html');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    expect((await page.request.post('/api/vehicles', { data: {} })).status()).toBe(403);
    await context.close();
  });
});
