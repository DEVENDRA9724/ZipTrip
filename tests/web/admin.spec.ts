import { test, expect, type Page } from '@playwright/test';
import { apiAs, PNG_1PX, storageFile, uploadMedia } from './support/fixtures';

// Any script that runs because of injected data sets window.__xss or opens a dialog; both are trapped here.
async function trapScriptInjection(page: Page) {
  const dialogs: string[] = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await page.route('https://images.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
  await page.route('https://evil.example.test/**', (route) => route.fulfill({ status: 404, body: '' }));
  return async () => {
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
  };
}

test.describe('Admin panel', () => {
  test.use({ storageState: storageFile('admin') });

  test('opens the administration console with its sections', async ({ page }) => {
    await page.goto('/admin.html');
    const tabs = page.getByRole('navigation', { name: 'Administration sections' });
    for (const name of ['Dashboard', 'Vehicles', 'Documents', 'Bookings', 'Users', 'Payouts', 'Audit']) await expect(tabs.getByRole('link', { name: new RegExp('^' + name) })).toBeVisible();
  });

  test('a car folder\'s Compliance tab offers Review & approve for an uploaded document and opens the verification review', async ({ page }) => {
    const hostB = await apiAs('hostB');
    const media = await (await uploadMedia(hostB, 'PUC')).json();
    const doc = await (await hostB.post('/api/kyc/documents', { data: { kind: 'PUC', mediaId: media.id, vehicleId: 'pw-car-b', consent: true } })).json();
    expect(doc.status).toBe('PENDING');
    await hostB.dispose();
    await page.goto('/admin.html?tab=vehicles');
    await page.locator('.vehicle-folder-btn[data-id="pw-car-b"]').click();
    const dialog = page.locator('dialog');
    await dialog.getByRole('button', { name: /^Compliance/ }).click();
    const row = dialog.locator('#folder-tab-content-compliance tr', { has: page.locator(`[data-id="${doc.id}"]`) });
    await expect(row.getByTestId('doc-status')).toHaveText('Pending review');
    await row.getByRole('button', { name: 'Review & approve' }).click();
    await expect(page.locator('dialog').getByRole('heading', { name: 'Document Verification Review' })).toBeVisible();
    // Approval still requires opening the original first, exactly as in the Documents tab.
    await expect(page.locator('#document-review-guidance')).toContainText('Approval is unavailable until an original is opened');
    // The uploaded image is previewed inline in the review.
    const preview = page.locator('dialog .evidence-preview img');
    await expect(preview).toBeVisible();
    expect(await preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.locator('#doc-decision-form option[value="APPROVED"]').evaluate((o) => (o as HTMLOptionElement).disabled)).toBe(true);
  });

  test('lists a newly submitted vehicle document for review and still requires the evidence check to approve', async ({ page }) => {
    const hostB = await apiAs('hostB');
    const media = await (await uploadMedia(hostB, 'INSURANCE')).json();
    const doc = await (await hostB.post('/api/kyc/documents', { data: { kind: 'INSURANCE', mediaId: media.id, vehicleId: 'pw-car-b', consent: true } })).json();
    expect(doc.status).toBe('PENDING');
    await hostB.dispose();
    await page.goto('/admin.html');
    await page.getByRole('navigation', { name: 'Administration sections' }).getByRole('link', { name: /^Documents/ }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Hugo HostB' }).filter({ hasText: 'INSURANCE' }).filter({ hasText: 'PENDING' }).first()).toBeVisible();
    const approve = await page.request.post(`/api/admin/documents/${doc.id}/review`, { data: { status: 'APPROVED', note: 'Looks fine', identityChecked: true, validUntil: '2030-01-01' } });
    expect(approve.status()).toBe(400);
    expect((await approve.json()).message).toMatch(/inspect this record/);
    expect((await (await page.request.get('/api/admin')).json()).documents.find((d: any) => d.id === doc.id).status).toBe('PENDING');
  });

  test('shows approval and availability separately and refuses to approve a car without valid compliance', async ({ page }) => {
    await page.goto('/admin.html?tab=vehicles');
    const tile = page.locator('.admin-vehicle-tile', { hasText: 'Innova PW' });
    await expect(tile.getByTestId('vehicle-state')).toContainText(/pending approval/i);
    await expect(tile.getByText('RC has not been uploaded')).toBeVisible();
    await tile.getByRole('button', { name: /Open Folder/ }).click();
    const dialog = page.locator('dialog');
    await expect(dialog.getByTestId('folder-vehicle-state')).toContainText(/inactive/i);
    // While documents block approval, the UI offers only Reject and explains the steps; Approve is not offered.
    const decision = dialog.locator('#folder-decision-form');
    await expect(decision.getByTestId('approval-blocked')).toBeVisible();
    await expect(decision.getByLabel('Decision').locator('option')).toHaveText(['Reject listing']);
    // The server still refuses approval directly, whatever the UI shows.
    const approve = await page.request.post('/api/admin/vehicles/pw-car-d/review', { data: { decision: 'APPROVE', note: 'Bypassing the UI' } });
    expect(approve.status()).toBe(400);
    const body = await approve.json();
    expect(body.message).toBe('Approve valid RC, insurance and PUC first');
    expect(body.reasons).toContain('PUC_MISSING');
    expect((await (await page.request.get('/api/admin')).json()).vehicles.find((v: any) => v.id === 'pw-car-d')).toMatchObject({ approvalStatus: 'PENDING_APPROVAL', availability: 'INACTIVE' });
    // Availability cannot be switched on for a car that is not approved: not offered in the UI, refused by the API.
    const availability = dialog.locator('#folder-availability-form');
    await expect(availability.getByTestId('availability-locked')).toBeVisible();
    await expect(availability.getByLabel('Availability').locator('option[value="ACTIVE"]')).toHaveCount(0);
    const activate = await page.request.post('/api/vehicles/pw-car-d/availability', { data: { availability: 'ACTIVE' } });
    expect(activate.status()).toBe(400);
    expect((await activate.json()).reasons).toContain('APPROVAL_PENDING_APPROVAL');
  });

  test('rejects unsafe image URLs when creating a vehicle', async ({ page }) => {
    for (const images of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'http://images.example.test/a.png', 'https://x.example.test/a.jpg" onerror="alert(1)']) {
      const res = await page.request.post('/api/admin/vehicles', { data: { make: 'Unsafe', model: 'Image', year: 2024, registrationNumber: 'GJ01ZZ' + Math.floor(Math.random() * 9000 + 1000), city: 'Ahmedabad', pricePerDay: 1500, images } });
      expect(res.status(), images).toBe(400);
    }
  });
});

// A rejected or missing image falls back to a bundled asset: the logo or the model's stock photo.
const BUNDLED_FALLBACK = /^(safar-logo\.png|cars\/[a-z0-9]+\.jpg)$/;

test.describe('Public vehicle image security', () => {
  test('stored hostile image URLs and names cannot inject markup or run script on listings', async ({ page }) => {
    const verify = await trapScriptInjection(page);
    await page.goto('/cars.html');
    const card = page.locator('a[href*="id=pw-car-xss"]').first();
    await expect(card).toBeVisible();
    const img = page.locator('img[data-vehicle-image][alt*="Injection PW"]').first();
    await expect(img).toHaveAttribute('src', BUNDLED_FALLBACK);
    expect(await img.evaluate((el) => el.getAttributeNames().sort())).toEqual(['alt', 'data-vehicle-image', 'loading', 'src']);
    // The hostile make is shown as text, not parsed as an <img> element.
    await expect(page.getByText('<img src=x onerror=').first()).toBeVisible();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await verify();
  });

  test('vehicle detail pages render hostile values safely', async ({ page }) => {
    const verify = await trapScriptInjection(page);
    await page.goto('/cars.html?id=pw-car-xss');
    await expect(page.locator('#car-hero-img')).toHaveAttribute('src', BUNDLED_FALLBACK);
    // Scoped to page content: the shared header logo has its own constant onerror fallback.
    expect(await page.locator('#app').locator('img[src="x"], [onerror], [onload]').count()).toBe(0);
    await verify();
  });

  test('keeps legitimate https images and existing uploaded photos, and falls back for http', async ({ page }) => {
    const verify = await trapScriptInjection(page);
    await page.goto('/cars.html?id=pw-car-https');
    await expect(page.locator('#car-hero-img')).toHaveAttribute('src', 'https://images.example.test/car.png');
    await page.goto('/cars.html?id=pw-car-http');
    await expect(page.locator('#car-hero-img')).toHaveAttribute('src', BUNDLED_FALLBACK);
    await page.goto('/cars.html?id=pw-car-a');
    await expect(page.locator('#car-hero-img')).toHaveAttribute('src', /^\/api\/media\/[0-9a-f-]+$/);
    expect(await page.locator('#car-hero-img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await verify();
  });

  test('the client URL allow-list accepts only uploaded media, bundled assets and https', async ({ page }) => {
    await page.goto('/cars.html');
    const results = await page.evaluate(() => {
      const check = (window as any).safeVehicleImageUrl as (v: unknown) => string | null;
      return {
        https: check('https://cdn.example.com/a.jpg'),
        media: check('/api/media/0f8fad5b-d9cb-469f-a165-70867728950e'),
        asset: check('cars/creta.jpg'),
        http: check('http://cdn.example.com/a.jpg'),
        js: check('javascript:alert(1)'),
        jsMixed: check(' JaVaScRiPt:alert(1)'),
        data: check('data:image/png;base64,AAAA'),
        file: check('file:///etc/passwd'),
        quote: check('https://x.example/a.jpg" onerror="alert(1)'),
        markup: check('https://x.example/<script>'),
        protocolRelative: check('//x.example/a.jpg'),
        traversal: check('/api/media/../admin'),
        empty: check(''),
        nonString: check({ toString: () => 'https://x.example/a.jpg' }),
      };
    });
    expect(results).toEqual({
      https: 'https://cdn.example.com/a.jpg', media: '/api/media/0f8fad5b-d9cb-469f-a165-70867728950e', asset: 'cars/creta.jpg',
      http: null, js: null, jsMixed: null, data: null, file: null, quote: null, markup: null, protocolRelative: null, traversal: null, empty: null, nonString: null,
    });
  });
});

test.describe('Placeholder content removed', () => {
  test('home page shows real listing figures and no placeholder phone, hubs or taxi tab', async ({ page }) => {
    await page.goto('/');
    const listed = await (await page.request.get('/api/vehicles')).json();
    const cities = new Set(listed.map((v: any) => v.locationCity));
    await expect(page.getByTestId('stat-cars')).toHaveText(String(listed.length));
    await expect(page.getByTestId('stat-cities')).toHaveText(String(cities.size));
    const body = await page.locator('body').innerText();
    for (const text of ['99999', 'Hubs Live', '50+', '250+', '15+', 'Taxi', 'doorstep']) expect(body, text).not.toContain(text);
    await expect(page.locator('.bw-tab')).toHaveCount(0);
    expect(await page.locator('a[href^="tel:"], a[href*="wa.me"]').count()).toBe(0);
    // The city picker always offers the fixed service cities (names only, no invented pickup points), plus any other
    // city that has a listed car, with no duplicates; the search still works.
    const options = (await page.locator('#lp-city option').allTextContents()).slice(1).sort();
    const fixed = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'];
    expect(options).toEqual([...new Set([...fixed, ...cities])].sort());
    expect(options.some((o) => o.includes('('))).toBe(false);
    await page.locator('#lp-city').selectOption('Surat');
    await page.locator('#lp-search button[type=submit]').click();
    await expect(page).toHaveURL(/cars\.html\?.*city=Surat/);
    await expect(page.locator('a[href*="id=pw-car-b"]').first()).toBeVisible();
  });

  test('tracking does not claim live tracking', async ({ page }) => {
    await page.goto('/tracking.html');
    await expect(page.getByTestId('tracking-unavailable')).toContainText('does not offer live location tracking');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/GPS provider integration in progress|will be visible once/i);
  });

  test('contact page shows no placeholder details when none are configured', async ({ page }) => {
    await page.goto('/contact.html');
    const body = await page.locator('body').innerText();
    for (const text of ['99999', '24/7', 'Hubs', 'Safar Self Drive Tower', 'support@safarselfdrive.com', 'Taxi']) expect(body, text).not.toContain(text);
    await expect(page.getByText('Contact details have not been published yet.')).toBeVisible();
    await expect(page.locator('#cnt-submit')).toBeHidden();
    expect(await page.locator('a[href^="tel:"], a[href*="wa.me"], a[href^="mailto:"]').count()).toBe(0);
  });

  test('calculator page with fabricated taxi fares is no longer published', async ({ page }) => {
    expect((await page.request.get('/calculator.html')).status()).toBe(404);
  });
});
