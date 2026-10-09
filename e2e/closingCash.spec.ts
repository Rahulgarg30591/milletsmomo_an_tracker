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
