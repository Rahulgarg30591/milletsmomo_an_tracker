import { Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { useThemeMode } from './context/ThemeContext';
import { getTheme } from './theme/theme';
import ErrorBoundary from './components/ErrorBoundary';
import AppBar from './components/AppBar';
import BottomNav from './components/BottomNav';
import OfflineBanner from './components/OfflineBanner';
import PageTransition from './components/animations/PageTransition';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DateSelectPage from './pages/DateSelectPage';
import DayViewPage from './pages/DayViewPage';
import NewOrderPage from './pages/NewOrderPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  const { mode } = useThemeMode();
  const theme = getTheme(mode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <AuthProvider>
        <ErrorBoundary>
          <OfflineBanner />
          <AppBar />
          <PageTransition>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route
                path="/dates"
                element={
                  <ProtectedRoute requiredRole="staff">
                    <DateSelectPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/day/:date"
                element={
                  <ProtectedRoute requiredRole="staff">
                    <DayViewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/day/:date/new"
                element={
                  <ProtectedRoute requiredRole="staff">
                    <NewOrderPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </PageTransition>
          <BottomNav />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}