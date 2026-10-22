import { test, expect } from '@playwright/test';
import { apiAs, isoFromLocal, localInput, storageFile } from './support/fixtures';

test.use({ storageState: storageFile('customer') });

test.describe('Customer panel', () => {
  test('has a renting menu with direct links to trips, verification and profile', async ({ page }) => {
    await page.goto('/cars.html');
    const menu = page.getByRole('navigation', { name: 'Main Navigation' });
    await expect(menu.getByRole('link')).toHaveText(['Explore Cars', 'My Trips', 'Verification', 'Profile']);
    await expect(menu.getByRole('link', { name: 'Explore Cars' })).toHaveClass(/active/);
    await menu.getByRole('link', { name: 'Verification' }).click();
    await expect(page).toHaveURL(/dashboard\.html\?tab=kyc/);
    await expect(menu.getByRole('link', { name: 'Verification' })).toHaveClass(/active/);
    // Each menu item shows only its own section: no repeated tabs or summary cards on the page.
    const heading = page.locator('.section-head h2');
    await expect(heading).toHaveText('Verification');
    await expect(page.locator('[data-account-tab]')).toHaveCount(0);
    await expect(page.locator('#app .stats')).toHaveCount(0);
    for (const [label, section] of [['Profile', 'profile'], ['My Trips', 'trips']]) {
      await menu.getByRole('link', { name: label }).click();
      await expect(page.locator('#account-tab-content')).toHaveAttribute('data-section', section);
      await expect(heading).toHaveText(label);
      await expect(menu.getByRole('link', { name: label })).toHaveClass(/active/);
    }
  });

  test('lists only approved, active vehicles', async ({ page }) => {
    await page.goto('/cars.html');
    await expect(page.locator('a[href*="id=pw-car-a"]').first()).toBeVisible();
    await expect(page.locator('a[href*="id=pw-car-b"]').first()).toBeVisible();
    // Pending listings are never public.
    await expect(page.locator('a[href*="id=pw-car-a2"]')).toHaveCount(0);
    await expect(page.locator('a[href*="id=pw-car-d"]')).toHaveCount(0);
  });

  test('opens a vehicle detail page with its pickup city', async ({ page }) => {
    await page.goto('/cars.html?id=pw-car-a');
    await expect(page.getByRole('heading', { level: 1, name: /Hyundai.*Creta PW/ })).toBeVisible();
    await expect(page.getByText('Pickup City:')).toBeVisible();
    await expect(page.getByText('Doorstep')).toHaveCount(0);
  });

  test('validates booking fields and only enables booking after a server quote', async ({ page }) => {
    await page.goto('/cars.html?id=pw-car-a');
    const form = page.locator('#car-booking-form');
    const submit = form.getByRole('button', { name: /Proceed to Booking/ });
    await expect(submit).toBeDisabled();
    await form.getByLabel('Pick-up Date & Time').fill(localInput(40));
    await form.getByLabel('Drop-off Date & Time').fill(localInput(39));
    await expect(page.locator('#booking-quote-box')).toContainText('Choose a valid pickup and return time');
    await expect(submit).toBeDisabled();
    await form.getByLabel('Drop-off Date & Time').fill(localInput(42));
    await expect(page.locator('#booking-quote-box')).toContainText('Total Payable');
    await expect(submit).toBeEnabled();
    // The terms checkbox is required: the browser blocks submission and no booking request is sent.
    let bookingRequests = 0;
    page.on('request', (r) => { if (r.url().endsWith('/api/bookings') && r.method() === 'POST') bookingRequests++; });
    await submit.click();
    await expect(page).toHaveURL(/cars\.html\?id=pw-car-a/);
    expect(bookingRequests).toBe(0);
  });

  test('books a car, and repeated submissions with the same request key return the same booking', async ({ page }) => {
    await page.goto('/cars.html?id=pw-car-a');
    const form = page.locator('#car-booking-form');
    const start = localInput(50), end = localInput(52);
    await form.getByLabel('Pick-up Date & Time').fill(start);
    await form.getByLabel('Drop-off Date & Time').fill(end);
    await expect(page.locator('#booking-quote-box')).toContainText('Total Payable');
    await form.getByRole('checkbox').check();
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST'),
      form.getByRole('button', { name: /Proceed to Booking/ }).click(),
    ]);
    expect(response.status()).toBe(201);
    const sent = response.request().postDataJSON();
    expect(sent.requestKey).toMatch(/^[0-9a-f-]{36}$/);
    // The page navigates to the dashboard with the new booking id (the response body is gone after navigation).
    await expect(page).toHaveURL(/dashboard\.html\?booking=/);
    const bookingId = new URL(page.url()).searchParams.get('booking');
    const trips = await (await page.request.get('/api/bookings/my-trips')).json();
    expect(trips.find((t: any) => t.id === bookingId)).toMatchObject({ vehicleId: 'pw-car-a', status: 'PENDING' });

    // Replaying the identical request (e.g. a network retry) returns the original reservation, not a second one.
    const replay = await page.request.post('/api/bookings', { data: sent });
    expect(replay.ok()).toBe(true);
    expect((await replay.json()).id).toBe(bookingId);
    const after = await (await page.request.get('/api/bookings/my-trips')).json();
    expect(after.filter((t: any) => t.vehicleId === 'pw-car-a' && t.startDate === isoFromLocal(start))).toHaveLength(1);
  });

  test('shows a conflict instead of success when the car is taken before submission', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageFile('customer2') });
    const page = await context.newPage();
    const start = localInput(60), end = localInput(62);
    await page.goto('/cars.html?id=pw-car-b');
    const form = page.locator('#car-booking-form');
    await form.getByLabel('Pick-up Date & Time').fill(start);
    await form.getByLabel('Drop-off Date & Time').fill(end);
    await form.getByRole('checkbox').check();
    // Any form input re-checks the quote; wait until booking is enabled for these dates.
    await expect(page.locator('#booking-quote-box')).toContainText('Total Payable');
    await expect(form.getByRole('button', { name: /Proceed to Booking/ })).toBeEnabled();

    // Another customer reserves the same dates after this quote was shown.
    const other = await apiAs('customer');
    const taken = await other.post('/api/bookings', { data: { vehicleId: 'pw-car-b', startDate: isoFromLocal(start), endDate: isoFromLocal(end), requestKey: 'playwright-conflict-' + Date.now() } });
    expect(taken.status()).toBe(201);
    await other.dispose();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST'),
      form.getByRole('button', { name: /Proceed to Booking/ }).click(),
    ]);
    expect(response.status()).toBe(409);
    await expect(form.getByRole('alert')).toContainText(/already reserved/i);
    await expect(page).toHaveURL(/cars\.html\?id=pw-car-b/);
    await expect(page.getByText(/Booking Confirmed|successfully/i)).toHaveCount(0);
    const trips = await (await page.request.get('/api/bookings/my-trips')).json();
    expect(trips.some((t: any) => t.vehicleId === 'pw-car-b')).toBe(false);
    await context.close();
  });
});

test.describe('Local preview cars', () => {
  test('appear only when nothing is listed, are labelled, cannot be opened or booked, and never show for dated searches', async ({ page }) => {
    // Simulate an empty listing; the Playwright server itself has approved cars.
    await page.route('**/api/vehicles?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/cars.html');
    await expect(page.getByTestId('preview-banner')).toContainText('Preview mode (local only)');
    const previews = page.getByTestId('preview-car');
    await expect(previews).toHaveCount(9);
    await expect(page.locator('#cars-count-text')).toContainText('Preview only, not bookable');
    expect(await page.locator('[data-testid="preview-car"] a, a[data-testid="preview-car"]').count()).toBe(0);
    await expect(previews.first().getByText('Not bookable')).toBeVisible();
    // Filters work on the samples.
    await page.locator('#chip-row .chip-btn[data-filter="SUV"]').click();
    await expect(previews).toHaveCount(3);
    // A dated search never shows samples, so they can't look like real availability.
    const start = new Date(Date.now() + 3 * 86400000).toISOString(), end = new Date(Date.now() + 5 * 86400000).toISOString();
    await page.goto(`/cars.html?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
    await expect(page.locator('#fleet-grid .empty')).toBeVisible();
    await expect(page.getByTestId('preview-car')).toHaveCount(0);
  });

  test('do not appear when real cars are listed', async ({ page }) => {
    await page.goto('/cars.html');
    await expect(page.locator('a.car-card').first()).toBeVisible();
    await expect(page.getByTestId('preview-car')).toHaveCount(0);
    await expect(page.getByTestId('preview-banner')).toHaveCount(0);
  });
});
