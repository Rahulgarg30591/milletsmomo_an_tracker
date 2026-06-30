import React, { createContext, useContext, useState, useCallback } from 'react';
import { flushLogs, trackLogout } from '../utils/tracking';

interface AuthState {
  token: string | null;
  role: string | null;
  displayName: string | null;
}

interface AuthContextType {
  auth: AuthState;
  login: (token: string, role: string, displayName: string) => void;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const displayName = localStorage.getItem('displayName');
    return { token, role, displayName };
  });

  const login = useCallback((token: string, role: string, displayName: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('displayName', displayName);
    setAuth({ token, role, displayName });
  }, []);

  const logout = useCallback(async () => {
    trackLogout({ role: auth.role, displayName: auth.displayName });
    await flushLogs();
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('displayName');
    sessionStorage.removeItem('mm_session_start');
    setAuth({ token: null, role: null, displayName: null });
  }, [auth.role, auth.displayName]);

  const isAuthenticated = useCallback(() => {
    return !!auth.token;
  }, [auth.token]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
