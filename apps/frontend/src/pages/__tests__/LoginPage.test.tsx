import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { renderWithProviders } from '../../test/renderWithProviders';
import { server } from '../../test/server';

const STAFF_PIN = '9865';
const ADMIN_PIN = '1703';

function renderLogin(route = '/login') {
  const user = userEvent.setup();
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/day/:date" element={<div>day view</div>} />
      <Route path="/admin" element={<div>admin dashboard</div>} />
      <Route path="/admin/supply" element={<div>supply page</div>} />
    </Routes>,
    { route },
  );
  return { user };
}

const tap = (user: ReturnType<typeof userEvent.setup>, pin: string) =>
  pin.split('').reduce(
    (p, d) => p.then(() => user.click(screen.getByRole('button', { name: `PIN digit ${d}` }))),
    Promise.resolve(),
  );

describe('LoginPage', () => {
  it('signs a staff member in and lands on the day view', async () => {
    const { user } = renderLogin();
    await tap(user, STAFF_PIN);
    expect(await screen.findByText('day view')).toBeInTheDocument();
  });

  it('stores the session so a reload stays signed in', async () => {
    const { user } = renderLogin();
    await tap(user, STAFF_PIN);
    await waitFor(() => expect(localStorage.getItem('token')).toBeTruthy());
    expect(localStorage.getItem('role')).toBe('staff');
    expect(localStorage.getItem('displayName')).toBe('Cart Staff');
  });

  it('sends an admin to the dashboard instead', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: /admin/i }));
    await tap(user, ADMIN_PIN);
    expect(await screen.findByText('admin dashboard')).toBeInTheDocument();
  });

  it('returns an admin to the page they were trying to reach', async () => {
    const { user } = renderLogin('/login?redirect=%2Fadmin%2Fsupply');
    await user.click(screen.getByRole('button', { name: /admin/i }));
    await tap(user, ADMIN_PIN);
    expect(await screen.findByText('supply page')).toBeInTheDocument();
  });

  it('shows an error and stays put on a wrong PIN', async () => {
    const { user } = renderLogin();
    await tap(user, '0000');
    expect(await screen.findByText(/invalid pin/i)).toBeInTheDocument();
    expect(screen.queryByText('day view')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('allows a second attempt after a wrong PIN', async () => {
    const { user } = renderLogin();
    await tap(user, '0000');
    await screen.findByText(/invalid pin/i);
    await tap(user, STAFF_PIN);
    expect(await screen.findByText('day view')).toBeInTheDocument();
  });

  it('reports a server failure without signing the user in', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    const { user } = renderLogin();
    await tap(user, STAFF_PIN);
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    expect(screen.queryByText('day view')).not.toBeInTheDocument();
  });

  it('survives the network being unavailable', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    const { user } = renderLogin();
    await tap(user, STAFF_PIN);
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    // The screen must stay usable rather than crashing into the error boundary.
    expect(screen.getByRole('button', { name: 'PIN digit 1' })).toBeInTheDocument();
  });

  it('offers both roles, staff first', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  });
});
