import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { signIn, resetData, today, PINS } from './helpers';

async function token(request: APIRequestContext, role: 'staff' | 'admin'): Promise<string> {
  const login = await request.post('/api/auth/login', { data: { role, pin: PINS[role] } });
  return (await login.json()).token;
}

async function openNewOrder(page: Page) {
  await page.getByRole('button', { name: 'New Order' }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole('button', { name: 'Add Veg Steam' })).toBeVisible();
}

/** A takeaway recorded by admin through the API: 1 plate of Veg Steam unless told otherwise. */
async function logTakeaway(request: APIRequestContext, staffName: string, items = [{ menuItemId: 1, quantity: 6, isHalf: false }]) {
  const res = await request.post('/api/admin/takeaways', {
    headers: { 'x-auth-token': await token(request, 'admin') },
    data: { staffName, takeawayDate: today(), items },
  });
  expect(res.status()).toBe(201);
}

test.describe('staff takeaways', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('New Order offers only Dine and Pack', async ({ page }) => {
    await signIn(page, 'staff');
    await openNewOrder(page);
    await expect(page.getByRole('button', { name: 'Dine', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pack', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Staff', exact: true })).toHaveCount(0);
  });

  test('admin logs a takeaway at 25% off, and edits it', async ({ page }) => {
    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Takeaways' }).click();
    await expect(page).toHaveURL(/\/admin\/takeaways\?month=\d{4}-\d{2}$/);

    await page.getByRole('button', { name: 'Log Takeaway' }).click();
    const dialog = page.getByRole('dialog');
    // Not without a name.
    await dialog.getByRole('button', { name: 'Save Takeaway' }).click();
    await expect(dialog.getByText('Enter the staff member’s name')).toBeVisible();

    await dialog.getByLabel('Staff name').fill('Ramesh');
    // The first item defaults to one full plate of Veg Steam: ₹89 on the menu.
    await expect(dialog.getByTestId('takeaway-preview-owed')).toHaveText('Owes ₹66.75');
    await dialog.getByRole('button', { name: 'More plates of item 1' }).click();
    await expect(dialog.getByTestId('takeaway-preview-owed')).toHaveText('Owes ₹133.5');
    await dialog.getByRole('button', { name: 'Save Takeaway' }).click();

    const row = page.getByTestId('takeaway-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Ramesh');
    await expect(row).toContainText('₹133.5');
    await expect(page.getByTestId('takeaway-month-owed')).toHaveText('₹133.5');

    await page.getByRole('button', { name: 'Edit takeaway for Ramesh' }).click();
    await expect(dialog.getByLabel('Staff name')).toHaveValue('Ramesh');
    await dialog.getByRole('button', { name: 'Fewer plates of item 1' }).click();
    await dialog.getByRole('button', { name: 'Half' }).click();
    // Half plate of Veg Steam: ₹50 on the menu.
    await expect(dialog.getByTestId('takeaway-preview-owed')).toHaveText('Owes ₹37.5');
    await dialog.getByRole('button', { name: 'Update Takeaway' }).click();
    await expect(row).toContainText('₹37.5');
    await expect(row).toContainText('edited');

    await page.getByRole('button', { name: 'Remove takeaway for Ramesh' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(row).toHaveCount(0);
  });

  test('a takeaway is not a sale, but it leaves stock', async ({ page, request }) => {
    // One Veg packet (24 momos) left over yesterday; staff took one plate today.
    const yesterday = new Date(`${today()}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await request.post('/api/supply/closing-stock', {
      headers: { 'x-auth-token': await token(request, 'admin') },
      data: {
        orderDate: yesterday.toISOString().slice(0, 10),
        items: [{ supplyItemId: 1, packetsLeft: 1, piecesLeft: 0, wastagePieces: 0, hasConflict: false, conflictReason: null }],
      },
    });
    await logTakeaway(request, 'Ramesh');

    await signIn(page, 'staff');
    await page.goto(`/day/${today()}`);
    await expect(page.getByText('0 orders')).toBeVisible();

    await page.goto(`/day/${today()}/closing`);
    // 24 - 6 taken = 18 expected in stock.
    await expect(page.getByText('18 momos')).toBeVisible();
  });

  test('names used before are suggested', async ({ page, request }) => {
    await logTakeaway(request, 'Mahesh');
    await signIn(page, 'admin');
    await page.goto('/admin/leaves');
    await page.getByRole('button', { name: 'Mark Absent' }).click();
    await page.getByRole('dialog').getByLabel('Staff name').fill('mah');
    await expect(page.getByRole('option', { name: 'Mahesh' })).toBeVisible();
  });
});

test.describe('admin views', () => {
  test.beforeEach(async () => {
    await resetData();
  });

  test('admin sees what each staff member owes for the month', async ({ page, request }) => {
    await logTakeaway(request, 'Ramesh');
    await logTakeaway(request, 'Ramesh', [{ menuItemId: 1, quantity: 3, isHalf: true }]);
    await logTakeaway(request, 'Suresh');

    await signIn(page, 'admin');
    await page.goto('/admin/takeaways');
    // (89 + 50 + 89) at 75%.
    await expect(page.getByTestId('takeaway-month-owed')).toHaveText('₹171');
    await expect(page.getByTestId('takeaway-row')).toHaveCount(3);
    const first = page.getByTestId('takeaway-staff-row').first();
    await expect(first).toContainText('Ramesh');
    await expect(first).toContainText('₹104.25');
  });

  test('admin marks a staff member absent, edits and removes the leave', async ({ page }) => {
    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Leaves' }).click();
    await expect(page).toHaveURL(/\/admin\/leaves\?month=\d{4}-\d{2}$/);

    await page.getByRole('button', { name: 'Mark Absent' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Staff name').fill('Ramesh');
    await dialog.getByLabel('Reason (optional)').fill('Fever');
    await dialog.getByRole('button', { name: 'Mark Absent' }).click();

    const row = page.getByTestId('leave-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Ramesh');
    await expect(row).toContainText('Fever');
    await expect(page.getByTestId('leave-month-count')).toHaveText('1 leave');
    await expect(page.getByTestId('leave-staff-row')).toContainText('1 day');

    await page.getByRole('button', { name: 'Edit leave for Ramesh' }).click();
    await expect(dialog.getByLabel('Reason (optional)')).toHaveValue('Fever');
    await dialog.getByLabel('Reason (optional)').fill('Family function');
    await dialog.getByRole('button', { name: 'Update Leave' }).click();
    await expect(row).toContainText('Family function');
    await expect(row).toContainText('edited');

    await page.getByRole('button', { name: 'Remove leave for Ramesh' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByTestId('leave-month-count')).toHaveText('0 leaves');
  });

  test('the same person cannot be marked absent twice on one day', async ({ page, request }) => {
    await request.post('/api/admin/leaves', {
      headers: { 'x-auth-token': await token(request, 'admin') },
      data: { staffName: 'Ramesh', leaveDate: today() },
    });

    await signIn(page, 'admin');
    await page.goto('/admin/leaves');
    await page.getByRole('button', { name: 'Mark Absent' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Staff name').fill('ramesh');
    await dialog.getByRole('button', { name: 'Mark Absent' }).click();

    await expect(page.getByText('already marked absent on that date')).toBeVisible();
    await expect(page.getByTestId('leave-row')).toHaveCount(1);
  });

  test('a leave needs a name', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/leaves');
    await page.getByRole('button', { name: 'Mark Absent' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Mark Absent' }).click();
    await expect(dialog.getByText('Enter the staff member’s name')).toBeVisible();
  });

  test('staff cannot open the admin staff pages', async ({ page }) => {
    await signIn(page, 'staff');
    for (const path of ['/admin/leaves', '/admin/takeaways']) {
      await page.goto(path);
      await expect(page.getByText('Access Denied')).toBeVisible();
    }
  });
});
