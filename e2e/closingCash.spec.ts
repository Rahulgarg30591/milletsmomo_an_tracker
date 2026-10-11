import { test, expect } from '@playwright/test';
import { signIn, resetData, today, PINS } from './helpers';

test.describe('closing cash', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('staff save closing stock, then enter the cash; admin sees the difference', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', { data: { role: 'staff', pin: PINS.staff } });
    const headers = { 'x-auth-token': (await login.json()).token };
    // One full plate of Veg Steam paid in cash: ₹89 expected in the drawer.
    await request.post('/api/orders', {
      headers,
      data: { orderDate: today(), orderType: 'dine', paymentMethod: 'cash', items: [{ menuItemId: 1, quantity: 6, isHalf: false }] },
    });

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/closing`);
    await expect(page.getByTestId('closing-cash-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save Closing Stock' }).click();

    // Stays on the page and offers the cash entry.
    const card = page.getByTestId('closing-cash-card');
    await expect(card).toBeVisible();
    await expect(page).toHaveURL(/\/closing$/);
    await card.getByLabel('Cash collected (₹)').fill('80');
    await card.getByRole('button', { name: 'Save Closing Cash' }).click();
    await expect(card.getByTestId('closing-cash-saved')).toHaveText('Saved ₹80');
    // Staff see the amount only.
    await expect(page.getByText(/short|extra/)).toHaveCount(0);

    await signIn(page, 'admin');
    await page.goto(`/admin/closing-stock?date=${today()}`);
    const review = page.getByTestId('closing-cash-review');
    await expect(review.getByTestId('closing-cash-collected')).toHaveText('₹80');
    await expect(review.getByTestId('closing-cash-difference')).toHaveText('−₹9 short');
  });
});

test.describe('admin closing day', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('admin edits closing stock and cash, then copies the day summary', async ({ page, context, request }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const login = await request.post('/api/auth/login', { data: { role: 'admin', pin: PINS.admin } });
    await request.put('/api/expenses', {
      headers: { 'x-auth-token': (await login.json()).token },
      data: { orderDate: today(), items: [{ description: 'milk', amount: 40 }] },
    });
    await signIn(page, 'admin');
    await page.goto(`/admin/closing-stock?date=${today()}`);
    await page.getByRole('button', { name: 'Record Closing Stock' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/closing-stock/${today()}/edit$`));
    await page.getByRole('button', { name: 'Save Closing Stock' }).click();

    const card = page.getByTestId('closing-cash-card');
    await card.getByLabel('Cash collected (₹)').fill('500');
    await card.getByRole('button', { name: 'Save Closing Cash' }).click();
    await expect(card.getByTestId('closing-cash-saved')).toHaveText('Saved ₹500');

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/admin\/closing-stock\?date=/);
    await expect(page.getByTestId('closing-cash-collected')).toHaveText('₹500');
    await expect(page.getByRole('button', { name: 'Edit Closing Cash' })).toBeVisible();

    // One message from the dashboard: sale details, expenses, closing stock.
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Copy Day Summary' }).click();
    await expect(page.getByText('Day summary copied to clipboard!')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^Date: \d{2}-[A-Z][a-z]{2}-\d{4}/);
    expect(text).toContain('Expenses: ₹40');
    expect(text).toContain('Cash Collection: ₹500');
    expect(text).toContain('Total: ₹540');
    expect(text).toContain('1. milk ₹40');
    expect(text).toContain('Left Over:');
    expect(text.indexOf('Minimum Sale')).toBeLessThan(text.indexOf('Left Over:'));
  });
});
