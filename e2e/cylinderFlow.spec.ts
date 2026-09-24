import { test, expect } from '@playwright/test';
import { signIn, resetData, today } from './helpers';

test.describe('cylinder refills', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('staff log a refill from the expenses page and it counts toward the day', async ({ page }) => {
    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/expenses`);

    await page.getByRole('button', { name: 'Cylinder', exact: true }).click();
    const save = page.getByRole('button', { name: 'Save Cylinder' });
    await expect(save).toBeDisabled();

    await page.getByRole('radio', { name: /Indane/ }).click();
    await page.getByLabel('Price (₹)').fill('905');
    await save.click();

    const row = page.getByTestId('cylinder-refill');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Indane');
    await expect(row).toContainText('₹905');
    await expect(page.getByText('₹905.00')).toBeVisible();
  });

  test('a refill logged by mistake can be removed', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', { data: { role: 'staff', pin: '9865' } });
    const { token } = await login.json();
    await request.post('/api/cylinders', {
      headers: { 'x-auth-token': token },
      data: { refillDate: today(), brand: 'HP', amount: 950 },
    });

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/expenses`);
    await page.getByRole('button', { name: 'Remove HP cylinder' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByTestId('cylinder-refill')).toHaveCount(0);
  });

  test('admin sees the month’s refills and the staff log', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', { data: { role: 'staff', pin: '9865' } });
    const { token } = await login.json();
    for (const [brand, amount] of [['HP', 950], ['BP', 910]] as const) {
      await request.post('/api/cylinders', {
        headers: { 'x-auth-token': token },
        data: { refillDate: today(), brand, amount },
      });
    }

    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Cylinders' }).click();
    await expect(page).toHaveURL(/\/admin\/cylinders\?month=\d{4}-\d{2}$/);
    await expect(page.getByTestId('cylinder-month-total')).toHaveText('₹1,860');
    await expect(page.getByTestId('cylinder-month-row')).toHaveCount(2);

    await page.goto('/admin/staff-logs');
    await page.getByRole('button', { name: 'Staff Operations' }).click();
    await expect(page.getByText(/Cylinder refill logged: HP/)).toBeVisible();
  });

  test('staff record where a cylinder came from, then correct the entry', async ({ page }) => {
    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/expenses`);

    await page.getByRole('button', { name: 'Cylinder', exact: true }).click();
    await page.getByRole('radio', { name: /HP/ }).click();
    await page.getByLabel('Price (₹)').fill('950');
    await page.getByLabel('Taken from (optional)').fill('Gupta Gas Agency');
    await page.getByRole('button', { name: 'Save Cylinder' }).click();

    const row = page.getByTestId('cylinder-refill');
    await expect(row).toContainText('from Gupta Gas Agency');

    await page.getByRole('button', { name: 'Edit HP cylinder' }).click();
    await expect(page.getByLabel('Price (₹)')).toHaveValue('950');
    await expect(page.getByLabel('Taken from (optional)')).toHaveValue('Gupta Gas Agency');
    await page.getByRole('radio', { name: /BP/ }).click();
    await page.getByLabel('Price (₹)').fill('915');
    await page.getByRole('button', { name: 'Update Cylinder' }).click();

    await expect(row).toHaveCount(1);
    await expect(row).toContainText('BP');
    await expect(row).toContainText('₹915');
    await expect(row).toContainText('edited');
  });

  test('a source used before is offered as a suggestion', async ({ page, request }) => {
    const login = await request.post('/api/auth/login', { data: { role: 'staff', pin: '9865' } });
    const { token } = await login.json();
    await request.post('/api/cylinders', {
      headers: { 'x-auth-token': token },
      data: { refillDate: today(), brand: 'HP', amount: 950, source: 'Sharma Traders' },
    });

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/expenses`);
    await page.getByRole('button', { name: 'Cylinder', exact: true }).click();
    await page.getByLabel('Taken from (optional)').fill('Sha');
    await expect(page.getByRole('option', { name: 'Sharma Traders' })).toBeVisible();
  });

  test('typing a price replaces the remembered one instead of adding to it', async ({ page }) => {
    await signIn(page, 'staff');
    await page.goto(`/day/${today()}/expenses`);
    await page.evaluate(() => localStorage.setItem('mm_cylinder_last_price', JSON.stringify({ INDANE: 905 })));

    await page.getByRole('button', { name: 'Cylinder', exact: true }).click();
    await page.getByRole('radio', { name: /Indane/ }).click();
    const price = page.getByLabel('Price (₹)');
    await expect(price).toHaveValue('905');
    // Tap then type, as staff do; fill() would hide the bug by clearing first.
    await price.click();
    await page.keyboard.type('910');
    await expect(price).toHaveValue('910');
  });
});
