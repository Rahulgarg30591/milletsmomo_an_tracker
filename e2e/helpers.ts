import { Page, expect } from '@playwright/test';
import { Client } from 'pg';
import { E2E_DATABASE_URL } from './dbUrl';

/**
 * Empties the day's activity so each test starts from a known state.
 *
 * The specs share one database and one business day, so without this the
 * second test sees whatever the first one ordered. Reference data — users,
 * menu, supply catalogue — is left alone.
 */
export async function resetData(): Promise<void> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query(`TRUNCATE
      client_activity_logs, staff_operation_logs, day_expenses,
      daily_payment_settlements, daily_closing_stock, supply_verifications,
      supply_order_logs, daily_supply_order_items, daily_supply_orders,
      order_items, orders
      RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

export const PINS = { staff: '9865', admin: '1703' } as const;

/**
 * Signs in through the PIN pad, the way the shop does.
 *
 * Only the login spec should use this. The login endpoint is rate limited to
 * twenty failed attempts a minute, and across a full run the deliberate
 * wrong-PIN test plus the odd mis-tap add up until later sign-ins are
 * throttled — which looks like an unrelated test failing at the end.
 */
export async function signInViaPinPad(page: Page, role: 'staff' | 'admin' = 'staff') {
  await page.goto('/');
  if (role === 'admin') {
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
  }
  for (const digit of PINS[role]) {
    await page.getByRole('button', { name: `PIN digit ${digit}` }).click();
  }
  await expect(page.getByRole('button', { name: 'PIN digit 1' })).toBeHidden();
}

/**
 * Puts a signed-in session in place without going through the PIN pad.
 *
 * Successful logins are not rate limited, and this skips the pad entirely, so
 * a spec about ordering does not fail because of the login screen.
 */
export async function signIn(page: Page, role: 'staff' | 'admin' = 'staff') {
  const response = await page.request.post('/api/auth/login', {
    data: { role, pin: PINS[role] },
  });
  expect(response.status(), 'sign-in should succeed').toBe(200);
  const session = await response.json();

  await page.goto('/');
  await page.evaluate(({ token, role: r, displayName, pin }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', r);
    localStorage.setItem('displayName', displayName);
    sessionStorage.setItem('mm_pin', pin);
  }, { ...session, pin: PINS[role] });

  await page.goto(role === 'admin' ? '/admin' : '/');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

/** Today as the app computes it, so tests and app agree on the business day. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
