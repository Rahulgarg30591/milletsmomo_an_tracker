import { Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { theme } from './theme/theme';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DateSelectPage from './pages/DateSelectPage';
import DayViewPage from './pages/DayViewPage';
import NewOrderPage from './pages/NewOrderPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />
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
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
