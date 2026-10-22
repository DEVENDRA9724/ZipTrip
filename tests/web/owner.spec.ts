import { test, expect } from '@playwright/test';
import { apiAs, isoFromLocal, localInput, PNG_1PX, storageFile, uploadMedia } from './support/fixtures';

test.describe('Vehicle owner panel (HOST)', () => {
  test.use({ storageState: storageFile('hostA') });

  test('has a task-based menu and sees only their own cars on Car Documents', async ({ page }) => {
    const mine = await (await page.request.get('/api/vehicles/mine')).json();
    expect(mine.map((v: any) => v.id).sort()).toEqual(['pw-car-a', 'pw-car-a2']);
    await page.goto('/host-onboarding.html');
    const menu = page.getByRole('navigation', { name: 'Main Navigation' });
    await expect(menu.getByRole('link')).toHaveText(['My Fleet', 'Add Car', 'Car Documents', 'Bookings', 'Payouts', 'Account']);
    await menu.getByRole('link', { name: 'Car Documents' }).click();
    await expect(page).toHaveURL(/host-onboarding\.html\?tab=documents/);
    const cards = page.locator('.car-docs-card');
    await expect(cards).toHaveCount(2);
    const text = (await cards.allTextContents()).join(' ');
    expect(text).toContain('Creta PW');
    expect(text).toContain('Swift PW');
    expect(text).not.toContain('Thar PW');
    expect(text).not.toContain('Innova PW');
    // Each car lists RC, Insurance and PUC with an upload action.
    await expect(page.locator('#car-docs-pw-car-a2 tr[data-kind]')).toHaveCount(3);
    await expect(page.locator('#car-docs-pw-car-a2 .car-doc-upload')).toHaveCount(3);
  });

  test('the account page keeps only the owner\'s own driving licence; car documents moved to Car Documents', async ({ page }) => {
    await page.goto('/dashboard.html?tab=kyc');
    // Owners verify their own identity here; there is no RC/Insurance/PUC upload on the account page.
    await expect(page.getByTestId('car-docs-moved')).toBeVisible();
    await expect(page.locator('#doc-upload-form')).toHaveCount(0);
    await expect(page.locator('select[name="kind"] option', { hasText: /^(RC|INSURANCE|PUC)$/ })).toHaveCount(0);
    // Old links that opened the account upload form for a car now open Car Documents at that car.
    await page.goto('/kyc.html?vehicle=pw-car-a');
    await expect(page).toHaveURL(/tab=documents&vehicle=pw-car-a/);
    await expect(page.locator('#car-docs-pw-car-a')).toHaveClass(/is-focused/);
  });

  for (const kind of ['RC', 'INSURANCE', 'PUC']) {
    test(`uploads ${kind} for an owned car as a pending record`, async ({ page }) => {
      await page.goto('/host-onboarding.html?tab=documents&vehicle=pw-car-a');
      await page.locator(`#car-docs-pw-car-a tr[data-kind="${kind}"] .car-doc-upload`).click();
      const form = page.locator('#car-doc-upload-form');
      await form.locator('input[type=file]').setInputFiles({ name: `${kind.toLowerCase()}.png`, mimeType: 'image/png', buffer: PNG_1PX });
      await form.getByRole('checkbox').check();
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/kyc/documents') && r.request().method() === 'POST'),
        form.getByRole('button', { name: /^Submit .* for review$/ }).click(),
      ]);
      expect(response.status()).toBe(201);
      expect(response.request().postDataJSON()).toMatchObject({ kind, vehicleId: 'pw-car-a' });
      expect(await response.json()).toMatchObject({ kind, vehicleId: 'pw-car-a', status: 'PENDING' });
      await expect(page.getByRole('status').filter({ hasText: 'submitted for verification review' })).toBeVisible();
      // The car's card shows the new upload waiting for review (an older verified copy may still be current).
      await expect(page.locator(`#car-docs-pw-car-a tr[data-kind="${kind}"]`)).toContainText('waiting for review');
    });
  }

  test('uploads nothing until a document file and the consent are given', async ({ page }) => {
    let uploads = 0;
    page.on('request', (r) => { if (/\/api\/(media|kyc\/documents)/.test(r.url()) && r.method() === 'POST') uploads++; });
    await page.goto('/host-onboarding.html?tab=documents');
    await page.locator('#car-docs-pw-car-a tr[data-kind="INSURANCE"] .car-doc-upload').click();
    const form = page.locator('#car-doc-upload-form');
    await form.getByRole('button', { name: /^Submit .* for review$/ }).click();
    expect(await form.locator('input[type=file]').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await form.locator('input[type=file]').setInputFiles({ name: 'ins.png', mimeType: 'image/png', buffer: PNG_1PX });
    await form.getByRole('button', { name: /^Submit .* for review$/ }).click();
    expect(await form.getByRole('checkbox').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    expect(uploads).toBe(0);
  });

  test('cannot attach documents to another owner’s vehicle, even by editing the request', async ({ page }) => {
    const hostB = await apiAs('hostB');
    const docsOnB = async () => (await (await hostB.get('/api/vehicles/mine')).json()).find((v: any) => v.id === 'pw-car-b').documents.length;
    const before = await docsOnB();
    const media = await uploadMedia(page.request, 'RC');
    expect(media.status()).toBe(201);
    const { id: mediaId } = await media.json();
    const res = await page.request.post('/api/kyc/documents', { data: { kind: 'RC', mediaId, vehicleId: 'pw-car-b', consent: true } });
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Your vehicle was not found');
    expect(await docsOnB()).toBe(before);
    await hostB.dispose();
  });

  test('rejects invalid document categories, unsupported files and oversized files on the server', async ({ page }) => {
    const media = await (await uploadMedia(page.request, 'PUC')).json();
    expect((await page.request.post('/api/kyc/documents', { data: { kind: 'PASSPORT', mediaId: media.id, vehicleId: 'pw-car-a', consent: true } })).status()).toBe(400);
    expect((await page.request.post('/api/kyc/documents', { data: { kind: 'PUC', mediaId: media.id, consent: true } })).status()).toBe(400);
    const svg = await uploadMedia(page.request, 'RC', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/svg+xml', 'x.svg');
    expect(svg.status()).toBe(400);
    const pdf = await uploadMedia(page.request, 'RC', Buffer.from('%PDF-1.7 not an image'), 'application/pdf', 'x.pdf');
    expect(pdf.status()).toBe(400);
    const huge = await uploadMedia(page.request, 'RC', Buffer.alloc(9 * 1024 * 1024, 1), 'image/png', 'huge.png');
    expect(huge.status()).toBe(413);
  });

  test('cannot approve its own listing or manage another owner’s calendar', async ({ page }) => {
    expect((await page.request.post('/api/admin/vehicles/pw-car-a2/review', { data: { status: 'ACTIVE', note: 'self approval' } })).status()).toBe(403);
    const period = { startDate: isoFromLocal(localInput(80)), endDate: isoFromLocal(localInput(81)), reason: 'Service' };
    expect((await page.request.post('/api/vehicles/pw-car-b/availability-blocks', { data: period })).status()).toBe(404);
    const own = await page.request.post('/api/vehicles/pw-car-a/availability-blocks', { data: period });
    expect(own.status()).toBe(201);
    expect((await page.request.post(`/api/vehicles/pw-car-a/availability-blocks/${(await own.json()).id}/release`, { data: {} })).status()).toBe(201);
  });

  test('pauses and reactivates its own approved car, but cannot approve or activate a car awaiting review', async ({ page }) => {
    expect((await page.request.post('/api/admin/vehicles/pw-car-a2/review', { data: { decision: 'APPROVE', note: 'self approval' } })).status()).toBe(403);
    expect((await page.request.post('/api/vehicles/pw-car-b/availability', { data: { availability: 'INACTIVE' } })).status()).toBe(404);
    const pending = await page.request.post('/api/vehicles/pw-car-a2/availability', { data: { availability: 'ACTIVE' } });
    expect(pending.status()).toBe(400);
    expect((await pending.json()).reasons).toContain('APPROVAL_PENDING_APPROVAL');

    const listed = async () => (await (await page.request.get('/api/vehicles?city=Ahmedabad')).json()).map((v: any) => v.id);
    await page.goto('/host-onboarding.html?tab=fleet');
    const creta = () => page.locator('#host-section-fleet article', { hasText: 'Creta PW' });
    await expect(creta().getByTestId('vehicle-bookable')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await creta().getByRole('button', { name: 'Pause new bookings' }).click();
    await expect(creta().getByText('Paused: not accepting new bookings')).toBeVisible();
    expect(await listed()).not.toContain('pw-car-a');
    await creta().getByRole('button', { name: 'Accept bookings' }).click();
    await expect(creta().getByTestId('vehicle-bookable')).toBeVisible();
    expect(await listed()).toContain('pw-car-a');
    // The car awaiting review explains why and offers no way to activate it.
    const swift = page.locator('#host-section-fleet article', { hasText: 'Swift PW' });
    await expect(swift.getByText('Awaiting administrator review')).toBeVisible();
    await expect(swift.getByRole('button', { name: 'Accept bookings' })).toHaveCount(0);
  });

  test('cannot lift a suspension placed by an administrator', async ({ page }) => {
    const admin = await apiAs('admin');
    expect((await admin.post('/api/vehicles/pw-car-a/availability', { data: { availability: 'INACTIVE', reason: 'ADMIN_SUSPENDED' } })).status()).toBe(201);
    try {
      const lift = await page.request.post('/api/vehicles/pw-car-a/availability', { data: { availability: 'ACTIVE' } });
      expect(lift.status()).toBe(403);
      expect((await lift.json()).reasons).toEqual(['RESTRICTED_ADMIN_SUSPENDED']);
      // An owner "pause" does not replace the administrator's reason.
      await page.request.post('/api/vehicles/pw-car-a/availability', { data: { availability: 'INACTIVE' } });
      await page.goto('/host-onboarding.html?tab=fleet');
      const creta = page.locator('#host-section-fleet article', { hasText: 'Creta PW' });
      await expect(creta.getByTestId('admin-restriction')).toContainText('Suspended by Safar');
      await expect(creta.getByRole('button', { name: 'Accept bookings' })).toHaveCount(0);
    } finally {
      expect((await admin.post('/api/vehicles/pw-car-a/availability', { data: { availability: 'ACTIVE' } })).status()).toBe(201);
      await admin.dispose();
    }
  });

  test('sees bookings for its own cars only', async ({ page }) => {
    const customer = await apiAs('customer');
    const created = await customer.post('/api/bookings', { data: { vehicleId: 'pw-car-a', startDate: isoFromLocal(localInput(90)), endDate: isoFromLocal(localInput(91)), requestKey: 'owner-view-' + Date.now() } });
    expect(created.status()).toBe(201);
    await customer.dispose();
    const hosted = await (await page.request.get('/api/bookings/host-bookings')).json();
    expect(hosted.length).toBeGreaterThan(0);
    expect(hosted.every((b: any) => ['pw-car-a', 'pw-car-a2'].includes(b.vehicleId))).toBe(true);
    await page.goto('/host-onboarding.html?tab=bookings');
    await expect(page.locator('#host-section-bookings').getByText('Creta PW').first()).toBeVisible();
  });
});

test.describe('Vehicle owner panel (DEALER)', () => {
  test.use({ storageState: storageFile('dealer') });

  test('uses the same fleet controls for its own vehicles', async ({ page }) => {
    await page.goto('/host-onboarding.html');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toHaveCount(0);
    const mine = await (await page.request.get('/api/vehicles/mine')).json();
    expect(mine.map((v: any) => v.id)).toEqual(['pw-car-d']);
    await page.goto('/kyc.html?vehicle=pw-car-d');
    await expect(page).toHaveURL(/tab=documents&vehicle=pw-car-d/);
    await expect(page.locator('#car-docs-pw-car-d')).toHaveClass(/is-focused/);
    await page.locator('#car-docs-pw-car-d tr[data-kind="PUC"] .car-doc-upload').click();
    await expect(page.locator('#car-doc-upload-form')).toBeVisible();
  });
});

test.describe('Unauthenticated uploads', () => {
  test('are refused', async () => {
    const anonymous = await apiAs();
    expect((await uploadMedia(anonymous, 'RC')).status()).toBe(401);
    expect((await anonymous.post('/api/kyc/documents', { data: { kind: 'RC', mediaId: 'x', vehicleId: 'pw-car-a', consent: true } })).status()).toBe(401);
    await anonymous.dispose();
  });
});
