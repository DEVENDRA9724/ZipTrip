import { test, expect } from '@playwright/test';
import { apiAs, state, storageFile } from './support/fixtures';

test.describe('Authentication', () => {
  test('shows an empty real login form without demo accounts or passwords', async ({ page }) => {
    await page.goto('/auth.html');
    await expect(page.getByLabel('Email address')).toHaveValue('');
    await expect(page.getByLabel('Password')).toHaveValue('');
    await expect(page.getByText(/Quick Demo Logins/i)).toHaveCount(0);
    await expect(page.locator('.fill-demo-btn, [data-pass]')).toHaveCount(0);
    const source = await (await page.request.get('/portal.js')).text();
    expect(source).not.toContain('Admin@12345678');
    expect(source).not.toContain('Host@12345678');
    expect(source).not.toContain('Customer@12345678');
  });

  for (const [role, destination] of [['admin', 'admin.html'], ['hostA', 'host-onboarding.html'], ['customer2', 'dashboard.html']] as const) {
    test(`signs in a real ${role} account and keeps its session after reload`, async ({ page }) => {
      const { users, password } = state();
      await page.goto('/auth.html');
      await page.getByLabel('Email address').fill(users[role].email.toUpperCase());
      await page.getByLabel('Password').fill(password);
      await page.locator('#auth-form').getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(new RegExp(destination.replace('.', '\\.') + '$'));
      // Cookie-only clients must work too, without relying on the JavaScript token.
      await page.evaluate(() => localStorage.removeItem('safar_token'));
      await page.reload();
      await expect(page.locator('.user-pill')).toHaveText('Hi, ' + users[role].firstName);
      expect((await page.request.get('/api/auth/profile')).status()).toBe(200);
    });
  }

  test('removes unsupported fleet controls and keeps working filters', async ({ page }) => {
    await page.goto('/cars.html');
    await expect(page.locator('#fleet-grid .vcard').first()).toBeVisible();
    await expect(page.locator('#filter-home-delivery, #addon-fastag, #addon-s3, #addon-superhost')).toHaveCount(0);
    await page.locator('#car-search').fill('Creta PW');
    await expect(page.locator('#fleet-grid .vcard')).toHaveCount(1);
    await page.getByRole('button', { name: 'Reset All', exact: true }).click();
    await expect(page.locator('#car-search')).toHaveValue('');
    await expect(page.locator('#fleet-grid .vcard').nth(1)).toBeVisible();
  });

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
