import { test, expect, type Browser, type Page } from '@playwright/test';
import { apiAs, storageFile, uploadMedia, type Role } from './support/fixtures';

// Records CSP violations reported by the browser on every page in the context.
async function cspWatch(page: Page) {
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  // Keep the run offline and deterministic; fonts are allowed by the policy, so stubbing them hides nothing.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 404, body: '' }));
}
async function visitWithoutViolations(browser: Browser, role: Role | null, paths: string[]) {
  const context = await browser.newContext(role ? { storageState: storageFile(role) } : {});
  const page = await context.newPage();
  await cspWatch(page);
  for (const path of paths) {
    const response = await page.goto(path);
    const csp = response!.headers()['content-security-policy'] || '';
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
    expect(scriptSrc, path).toBe("script-src 'self'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("object-src 'none'");
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as any).__csp), path).toEqual([]);
  }
  return { context, page };
}

test.describe('Content Security Policy without inline scripts', () => {
  test('public pages load with no CSP violations', async ({ browser }) => {
    const { context } = await visitWithoutViolations(browser, null, ['/', '/cars.html', '/cars.html?id=pw-car-a', '/auth.html', '/about.html', '/services.html', '/contact.html', '/tracking.html']);
    await context.close();
  });

  test('customer, owner and admin panels load and stay interactive with no CSP violations', async ({ browser }) => {
    const customer = await visitWithoutViolations(browser, 'customer', ['/dashboard.html', '/dashboard.html?tab=kyc', '/dashboard.html?tab=profile', '/kyc.html']);
    await customer.context.close();
    const host = await visitWithoutViolations(browser, 'hostA', ['/host-onboarding.html', '/kyc.html?vehicle=pw-car-a']);
    // Account tabs (owners) used inline onclick handlers before; they now use delegated listeners.
    await host.page.goto('/dashboard.html');
    await host.page.locator('[data-account-tab="profile"]').first().click();
    await expect(host.page).toHaveURL(/tab=profile/);
    expect(await host.page.evaluate(() => (window as any).__csp)).toEqual([]);
    await host.context.close();
    const admin = await visitWithoutViolations(browser, 'admin', ['/admin.html']);
    for (const tab of ['Documents', 'Bookings', 'Users', 'Payouts', 'Audit', 'Vehicles']) await admin.page.getByRole('navigation', { name: 'Administration sections' }).getByRole('link', { name: new RegExp('^' + tab) }).click();
    await admin.page.locator('.vehicle-folder-btn').first().click();
    await admin.page.locator('dialog [data-action="close-dialog"]').click();
    await expect(admin.page.locator('dialog[open]')).toHaveCount(0);
    expect(await admin.page.evaluate(() => (window as any).__csp)).toEqual([]);
    await admin.context.close();
  });

  test('the legacy menu works through its data-action handler', async ({ page }) => {
    await cspWatch(page);
    await page.goto('/about.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('#side-menu-drawer')).toHaveClass(/open/);
    expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  });
});

test.describe('Media authorization', () => {
  test('public car photos are public; pending-car photos and private documents are not', async () => {
    const anonymous = await apiAs();
    const hostA = await apiAs('hostA'), hostB = await apiAs('hostB'), admin = await apiAs('admin');
    const activePhoto = (await (await anonymous.get('/api/vehicles/pw-car-a')).json()).media[0].id;
    expect((await anonymous.get('/api/media/' + activePhoto)).status()).toBe(200);
    const pendingPhoto = (await (await hostA.get('/api/vehicles/mine')).json()).find((v: any) => v.id === 'pw-car-a2').media[0].id;
    expect((await anonymous.get('/api/media/' + pendingPhoto)).status()).toBe(403);
    expect((await hostB.get('/api/media/' + pendingPhoto)).status()).toBe(403);
    expect((await hostA.get('/api/media/' + pendingPhoto)).status()).toBe(200);
    expect((await admin.get('/api/media/' + pendingPhoto)).status()).toBe(200);
    // Another owner's compliance document (stored encrypted) is private to its owner and administrators.
    const doc = await (await uploadMedia(hostB, 'RC')).json();
    expect((await hostB.get('/api/media/' + doc.id)).status()).toBe(200);
    for (const outsider of [anonymous, hostA]) expect((await outsider.get('/api/media/' + doc.id)).status()).toBe(403);
    expect((await admin.get('/api/media/' + doc.id)).status()).toBe(200);
    // Unknown or malformed ids reveal nothing.
    expect((await anonymous.get('/api/media/00000000-0000-0000-0000-000000000000')).status()).toBe(404);
    for (const api of [anonymous, hostA, hostB, admin]) await api.dispose();
  });

  test('a blocked account loses access to its private media and the API', async () => {
    const blockme = await apiAs('blockme'), admin = await apiAs('admin');
    const doc = await (await uploadMedia(blockme, 'RC')).json();
    expect((await blockme.get('/api/media/' + doc.id)).status()).toBe(200);
    expect((await admin.post('/api/admin/users/pw-blockme/block', { data: { blocked: true, note: 'Browser test' } })).status()).toBe(201);
    expect((await blockme.get('/api/media/' + doc.id)).status()).toBe(403);
    expect((await blockme.get('/api/auth/profile')).status()).toBe(401);
    await blockme.dispose();
    await admin.dispose();
  });
});

test.describe('Error responses and image fallback', () => {
  test('error responses do not reveal file paths or internals', async () => {
    const anonymous = await apiAs();
    // A media record whose file is missing on disk is reported as not found, without the storage path.
    const res = await anonymous.get('/api/media/pw-missing-media');
    expect(res.status()).toBe(404);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ statusCode: 404, message: 'Image not found', error: 'Not Found' });
    expect(body).not.toMatch(/ENOENT|missing-in-storage|missing-on-disk|uploads|NoSuchKey|S3|[A-Z]:\\|\/tmp\/|prisma|sqlite/i);
    const bad = await anonymous.get('/api/vehicles?seats=abc');
    expect(await bad.text()).not.toMatch(/prisma|sqlite|stack|at .*\.js/i);
    await anonymous.dispose();
  });

  test('a listing whose photo file is missing shows the safe logo fallback', async ({ page }) => {
    await page.goto('/cars.html?id=pw-car-missing');
    await expect(page.locator('#car-hero-img')).toHaveAttribute('src', 'safar-logo.png');
    await expect(page.locator('#car-hero-img')).toHaveClass(/vehicle-image-fallback/);
  });
});
