import { test, expect, type Page } from '@playwright/test';
import { apiAs, pngImage, storageFile } from './support/fixtures';

const bank = (accountNumber: string) => ({ accountHolderName: 'Hana HostA', bankName: 'Playwright Bank', accountNumber, ifscCode: 'PLAY0123456' });
const openPayouts = async (page: Page) => {
  await page.goto('/admin.html');
  await page.getByRole('navigation', { name: 'Administration sections' }).getByRole('link', { name: /^Payouts/ }).click();
};
const answerPrompts = (page: Page, ...answers: string[]) => {
  const queue = [...answers];
  page.on('dialog', (dialog) => void (dialog.type() === 'prompt' ? dialog.accept(queue.shift() ?? '') : dialog.dismiss()));
};
// Each PNG must differ so the duplicate-photo rule accepts it.
const photo = (seed: number) => pngImage(seed);

test.describe('Admin fleet entry', () => {
  test.use({ storageState: storageFile('admin') });

  test('creates a pending listing with only the real photo provided, hidden from the public until a second admin approves', async ({ page }) => {
    await page.goto('/admin.html?tab=vehicles');
    await page.getByRole('button', { name: 'Add New Car to Fleet' }).click();
    const form = page.locator('#admin-add-vehicle-form');
    await expect(page.getByText('Compliance documents and photos are automatically generated')).toHaveCount(0);
    await form.getByLabel('Vehicle Make (e.g. Hyundai)').fill('Skoda');
    await form.getByLabel('Model (e.g. Creta)').fill('Slavia PW');
    await form.getByLabel('Registration Number (e.g. GJ01AB1234)').fill('GJ01PW9001');
    await form.getByLabel('Category').selectOption('Sedan');
    await form.getByLabel('Front photo (optional)').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: await photo(1) });
    await form.getByRole('button', { name: 'Create Pending Listing' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'awaiting approval' })).toBeVisible();

    const created = (await (await page.request.get('/api/admin')).json()).vehicles.find((v: any) => v.registrationNumber === 'GJ01PW9001');
    expect(created).toMatchObject({ status: 'PENDING_APPROVAL', hostId: 'pw-admin', transmission: 'Automatic' });
    expect(created.media.map((m: any) => m.kind)).toEqual(['FRONT']);
    expect(created.documents).toEqual([]);
    expect((await (await page.request.get('/api/vehicles')).json()).some((v: any) => v.id === created.id)).toBe(false);

    // The folder offers only the missing angles, and an honest compliance state.
    await page.locator(`.vehicle-folder-btn[data-id="${created.id}"]`).click();
    await page.getByRole('button', { name: /^Photos/ }).click();
    const photoForm = page.locator('#folder-photo-form');
    expect(await photoForm.getByLabel('Angle').locator('option').allTextContents()).not.toContain('FRONT');
    await photoForm.getByLabel('Angle').selectOption('REAR');
    await photoForm.getByLabel('Photo').setInputFiles({ name: 'rear.png', mimeType: 'image/png', buffer: await photo(2) });
    await photoForm.getByRole('button', { name: 'Add Photo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'REAR photo added' })).toBeVisible();
    const after = (await (await page.request.get('/api/admin')).json()).vehicles.find((v: any) => v.id === created.id);
    expect(after.media.map((m: any) => m.kind).sort()).toEqual(['FRONT', 'REAR']);

    // Approval rules: never by the creating admin, and not without all photos and approved evidence.
    expect((await page.request.post(`/api/admin/vehicles/${created.id}/review`, { data: { status: 'ACTIVE', note: 'self' } })).status()).toBe(400);
    const admin2 = await apiAs('admin2');
    const res = await admin2.post(`/api/admin/vehicles/${created.id}/review`, { data: { status: 'ACTIVE', note: 'too early' } });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain('All required photos');
    await admin2.dispose();
  });

  test('a document with no evidence file is shown honestly in the compliance tab', async ({ page }) => {
    await page.goto('/admin.html?tab=vehicles');
    await page.locator('.vehicle-folder-btn[data-id="pw-car-legacy"]').click();
    await page.getByRole('button', { name: /^Compliance/ }).click();
    // Demo seed documents have no evidence media and are labelled as unverified, never as verified compliance.
    await expect(page.getByText('No evidence file').first()).toBeVisible();
    await expect(page.locator('#folder-tab-content-compliance').getByText('Unverified demo/test record').first()).toBeVisible();
    await page.getByRole('button', { name: /^Overview/ }).click();
    await expect(page.getByText('RC is an unverified record with no evidence file').first()).toBeVisible();
    expect(await page.locator('#folder-tab-content-compliance a[href^="/api/media/"]').count()).toBe(0);
  });
});

test.describe('Payout bank verification', () => {
  test('requires a second administrator for the exact version reviewed and holds payouts after a change', async ({ browser }) => {
    const hostA = await apiAs('hostA');
    expect((await hostA.post('/api/payouts/account', { data: bank('112233445566') })).status()).toBe(201);
    const context = await browser.newContext({ storageState: storageFile('admin') });
    const page = await context.newPage();
    answerPrompts(page, 'VERIFIED', 'VERIFIED');
    await openPayouts(page);
    const row = page.getByRole('row').filter({ hasText: 'host-a@playwright.invalid' });
    await expect(row.getByTestId('payout-account-state')).toHaveText('Awaiting second approval (version 1)');
    await expect(row).not.toContainText('112233445566');
    await row.getByRole('button', { name: 'Review version 1' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'review recorded' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'host-a@playwright.invalid' }).getByTestId('payout-account-state')).toHaveText('Verified (version 1)');

    // An approval for a version the host has since replaced is refused.
    await hostA.post('/api/payouts/account', { data: bank('665544332211') });
    await page.getByRole('row').filter({ hasText: 'host-a@playwright.invalid' }).getByRole('button', { name: 'Review version 1' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'changed after you opened them' })).toBeVisible();
    const account = await (await hostA.get('/api/payouts/account')).json();
    expect(account).toMatchObject({ revision: 2, status: 'PENDING', verificationCurrent: false });
    expect(account).not.toHaveProperty('encryptedAccountNumber');
    await expect(page.getByRole('row').filter({ hasText: 'host-a@playwright.invalid' })).toBeVisible();
    await context.close();

    // Verify version 2 (second admin), create a payout, then change details again: the payout is held.
    const admin2 = await apiAs('admin2');
    expect((await admin2.post(`/api/payouts/accounts/${account.id}/status`, { data: { status: 'VERIFIED', revision: 2 } })).status()).toBe(201);
    const payout = await (await admin2.post('/api/payouts/admin/create', { data: { accountId: account.id, amount: 4200, periodStart: '2026-10-01', periodEnd: '2026-10-31' } })).json();
    expect(payout).toMatchObject({ destinationState: 'CAPTURED', destinationAccountNumberLast4: '2211' });
    await hostA.post('/api/payouts/account', { data: bank('778899001122') });
    const blocked = await admin2.post(`/api/payouts/${payout.id}/status`, { data: { status: 'PROCESSING' } });
    expect(blocked.status()).toBe(409);
    const view = await browser.newContext({ storageState: storageFile('admin2') });
    const adminPage = await view.newPage();
    await openPayouts(adminPage);
    const payoutRow = adminPage.getByRole('row').filter({ hasText: '₹4,200' });
    await expect(payoutRow.getByTestId('payout-on-hold')).toBeVisible();
    await expect(payoutRow).toContainText('•••• 2211');
    await expect(payoutRow.getByRole('button', { name: 'Reconcile' })).toBeVisible();
    await view.close();
    await admin2.dispose();
    await hostA.dispose();
  });

  test('administrators cannot review their own bank details in the panel or API', async ({ browser }) => {
    const admin = await apiAs('admin');
    const own = await (await admin.post('/api/payouts/account', { data: { ...bank('223344556677'), accountHolderName: 'Ada Admin' } })).json();
    const selfReview = await admin.post(`/api/payouts/accounts/${own.id}/status`, { data: { status: 'VERIFIED', revision: own.revision } });
    expect(selfReview.status()).toBe(403);
    const context = await browser.newContext({ storageState: storageFile('admin') });
    const page = await context.newPage();
    await openPayouts(page);
    const row = page.getByRole('row').filter({ hasText: 'admin@playwright.invalid' });
    await expect(row).toContainText('A different administrator must review these details');
    await expect(row.getByRole('button', { name: /Review version/ })).toHaveCount(0);
    await context.close();
    await admin.dispose();
  });
});
