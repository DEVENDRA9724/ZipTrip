import { test, expect } from '@playwright/test';
import { isoFromLocal, localInput, storageFile } from './support/fixtures';

// Exercise the production empty state: localhost ordinarily inserts labelled samples.
test.beforeEach(async ({ page }) => {
  await page.route('**/portal.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace(/const PREVIEW_MODE = [^;]+;/, 'const PREVIEW_MODE = false;') });
  });
});

test('an empty public fleet does not suggest that resetting filters will restore records', async ({ page }) => {
  await page.route(/\/api\/vehicles(?:\?.*)?$/, route => route.fulfill({ json: [] }));
  await page.goto('/cars.html');
  await expect(page.getByRole('heading', { name: 'No cars are currently available' })).toBeVisible();
  await expect(page.locator('#fleet-grid')).not.toContainText('Reset All');
  await expect(page.locator('#fleet-grid').getByRole('link', { name: 'Manage vehicles' })).toHaveCount(0);
});

test('empty trip results offer a link that removes city and trip-date constraints', async ({ page }) => {
  await page.route(/\/api\/vehicles(?:\?.*)?$/, route => route.fulfill({ json: [] }));
  const query = new URLSearchParams({ city: 'Ahmedabad', startDate: isoFromLocal(localInput(12)), endDate: isoFromLocal(localInput(14)) });
  await page.goto('/cars.html?' + query);
  await expect(page.getByRole('heading', { name: 'No cars available for this search' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse all cars', exact: true }).click();
  await expect(page).toHaveURL(/\/cars\.html$/);
});

test('an administrator sees a useful fleet management link when no cars are publicly bookable', async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageFile('admin') });
  const page = await context.newPage();
  await page.route('**/portal.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/const PREVIEW_MODE = [^;]+;/, 'const PREVIEW_MODE = false;') });
  });
  await page.route(/\/api\/vehicles(?:\?.*)?$/, route => route.fulfill({ json: [] }));
  await page.goto('/cars.html');
  await expect(page.locator('#fleet-grid').getByRole('link', { name: 'Manage vehicles' })).toHaveAttribute('href', 'admin.html?tab=vehicles');
  await context.close();
});

test('default filters include category, fuel and transmission values outside the preset list', async ({ page }) => {
  await page.route(/\/api\/vehicles(?:\?.*)?$/, route => route.fulfill({ json: [{
    id: 'test-crossover', make: 'Test', model: 'Crossover', category: 'Crossover', transmission: 'AMT',
    fuelType: 'Hybrid', year: 2024, seats: 5, pricePerDay: 1800, locationCity: 'Ahmedabad', status: 'ACTIVE',
  }] }));
  await page.goto('/cars.html');
  await expect(page.locator('#fleet-grid .vcard')).toHaveCount(1);
  // A deliberate transmission restriction still filters the unsupported value out.
  await page.locator('.trans-cb[value="Manual"]').uncheck();
  await expect(page.locator('#fleet-grid .vcard')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset All', exact: true }).click();
  await expect(page.locator('#fleet-grid .vcard')).toHaveCount(1);
});
