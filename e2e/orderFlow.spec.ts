import { test, expect, Page } from '@playwright/test';
import { signIn, resetData } from './helpers';

/** Adds one full plate of the first Steam item and configures the order. */
/** Opens the order screen and waits for the menu to finish rendering. */
async function openNewOrder(page: Page) {
  await page.getByRole('button', { name: 'New Order' }).click();
  await expect(page).toHaveURL(/\/new$/);
  // The menu arrives from the API; without this the page is a shell and a
  // click on any tile races the render.
  await expect(page.getByRole('button', { name: 'Add Veg Steam' })).toBeVisible();
}

async function buildOrder(page: Page, opts: { type?: 'Dine' | 'Pack'; payment?: string } = {}) {
  await openNewOrder(page);
  await page.getByRole('button', { name: 'Add Veg Steam' }).click();

  await page.getByRole('button', { name: opts.type ?? 'Dine', exact: true }).click();
  await page.getByRole('button', { name: opts.payment ?? 'Cash', exact: true }).click();
}

test.describe('placing an order', () => {
  test.beforeEach(async ({ page }) => {
    await resetData();
    await signIn(page, 'staff');
  });

  test('a staff member can place an order and see it on the day', async ({ page }) => {
    await buildOrder(page);
    await page.getByRole('button', { name: /place/i }).click();

    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText('Veg Steam')).toBeVisible();
    await expect(page.getByText('₹89').first()).toBeVisible();
  });

  test('an order can be completed from the day view', async ({ page }) => {
    await buildOrder(page);
    await page.getByRole('button', { name: /place/i }).click();
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}$/);

    // An open order offers both actions; a completed one offers neither.
    const complete = page.getByRole('button', { name: 'Complete order' });
    await expect(complete).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit order' })).toBeVisible();

    await complete.click();

    await expect(page.getByRole('button', { name: 'Complete order' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit order' })).toBeHidden();
    // It leaves the active list but stays on the day's books; the completed
    // section is collapsed, so the summary count is what proves it.
    await expect(page.getByText('No active orders')).toBeVisible();
    await expect(page.getByText('1 orders')).toBeVisible();
  });

  test('the total updates as items are added', async ({ page }) => {
    await openNewOrder(page);
    await page.getByRole('button', { name: 'Add Veg Steam' }).click();
    await expect(page.getByText('₹89').first()).toBeVisible();
    // Tapping an already-selected tile adds another plate.
    await page.getByRole('button', { name: /Veg Steam, \d+ selected/ }).click();
    await expect(page.getByText('₹178').first()).toBeVisible();
  });

  test('an order cannot be placed without a type and payment method', async ({ page }) => {
    await openNewOrder(page);
    await page.getByRole('button', { name: 'Add Veg Steam' }).click();
    await page.getByRole('button', { name: /place/i }).click();
    // Still on the order screen, with the missing fields called out.
    await expect(page).toHaveURL(/\/new$/);
    await expect(page.getByText('Required').first()).toBeVisible();
  });

  test('a beverage is priced per unit', async ({ page }) => {
    await openNewOrder(page);
    await page.getByRole('button', { name: 'Add Cold Drink' }).click();
    await expect(page.getByText('₹10').first()).toBeVisible();
  });

  test('the day starts with no orders', async ({ page }) => {
    await expect(page.getByText(/no active orders/i)).toBeVisible();
  });
});
