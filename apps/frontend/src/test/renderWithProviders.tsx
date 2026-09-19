import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from '../context/AuthContext';
import { getTheme } from '../theme/theme';
import { makeToken } from './handlers';

/** Puts a signed-in user in storage before the provider reads it. */
export function signIn(role: 'staff' | 'admin' = 'staff'): void {
  localStorage.setItem('token', makeToken(role));
  localStorage.setItem('role', role);
  localStorage.setItem('displayName', role === 'admin' ? 'Owner' : 'Cart Staff');
  sessionStorage.setItem('mm_pin', role === 'admin' ? '1703' : '9865');
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  // Retries and caching make assertions depend on timing, so both are off.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={getTheme('light')}>
            <CssBaseline />
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
