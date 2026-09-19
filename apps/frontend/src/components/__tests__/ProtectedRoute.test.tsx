import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { renderWithProviders, signIn } from '../../test/renderWithProviders';
import { makeToken } from '../../test/handlers';

const Secret = () => <div>secret content</div>;
const Login = () => <div>login screen</div>;

function renderGuarded(requiredRole?: 'staff' | 'admin') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/secret"
        element={<ProtectedRoute requiredRole={requiredRole}><Secret /></ProtectedRoute>}
      />
    </Routes>,
    { route: '/secret' },
  );
}

describe('ProtectedRoute', () => {
  it('sends a signed-out visitor to the login screen', () => {
    renderGuarded();
    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('lets a signed-in user through when no role is required', () => {
    signIn('staff');
    renderGuarded();
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('lets the matching role through', () => {
    signIn('admin');
    renderGuarded('admin');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('refuses a signed-in user who holds the wrong role', () => {
    signIn('staff');
    renderGuarded('admin');
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('says which role the page needs', () => {
    signIn('staff');
    renderGuarded('admin');
    expect(screen.getByText(/requires admin role/i)).toBeInTheDocument();
  });

  it('offers a way back rather than stranding the user', () => {
    signIn('staff');
    renderGuarded('admin');
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('treats an expired token as signed out', () => {
    localStorage.setItem('token', makeToken('staff', -60));
    localStorage.setItem('role', 'staff');
    renderGuarded('staff');
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('treats a malformed token as signed out', () => {
    localStorage.setItem('token', 'not-a-token');
    localStorage.setItem('role', 'admin');
    renderGuarded('admin');
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });
});
