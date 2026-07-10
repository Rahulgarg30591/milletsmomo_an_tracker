import { lazy, Suspense, useMemo } from 'react';
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
import { getToday } from './utils/dateUtils';
import PageLoader from './components/PageLoader';

const DayViewPage = lazy(() => import('./pages/DayViewPage'));
const NewOrderPage = lazy(() => import('./pages/NewOrderPage'));
const EditOrderPage = lazy(() => import('./pages/EditOrderPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const SupplyOrderPage = lazy(() => import('./pages/SupplyOrderPage'));
const SupplyVerificationPage = lazy(() => import('./pages/SupplyVerificationPage'));
const ClosingStockPage = lazy(() => import('./pages/ClosingStockPage'));
const StaffLogsPage = lazy(() => import('./pages/StaffLogsPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const PaymentSettlementPage = lazy(() => import('./pages/PaymentSettlementPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const AdminExpensesPage = lazy(() => import('./pages/AdminExpensesPage'));

export default function App() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <AuthProvider>
        <ErrorBoundary>
          <OfflineBanner />
          <AppBar />
          <PageTransition>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Navigate to={`/day/${getToday()}`} replace />} />
                <Route path="/day/:date" element={<ProtectedRoute requiredRole="staff"><DayViewPage /></ProtectedRoute>} />
                <Route path="/day/:date/new" element={<ProtectedRoute requiredRole="staff"><NewOrderPage /></ProtectedRoute>} />
                <Route path="/day/:date/edit/:orderId" element={<ProtectedRoute requiredRole="staff"><EditOrderPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/supply" element={<ProtectedRoute requiredRole="admin"><SupplyOrderPage /></ProtectedRoute>} />
                <Route path="/admin/staff-logs" element={<ProtectedRoute requiredRole="admin"><StaffLogsPage /></ProtectedRoute>} />
                <Route path="/admin/settlement" element={<ProtectedRoute requiredRole="admin"><PaymentSettlementPage /></ProtectedRoute>} />
                <Route path="/day/:date/verify" element={<ProtectedRoute requiredRole="staff"><SupplyVerificationPage /></ProtectedRoute>} />
                <Route path="/day/:date/closing" element={<ProtectedRoute requiredRole="staff"><ClosingStockPage /></ProtectedRoute>} />
                <Route path="/day/:date/stock" element={<ProtectedRoute requiredRole="staff"><StockPage /></ProtectedRoute>} />
                <Route path="/day/:date/expenses" element={<ProtectedRoute requiredRole="staff"><ExpensesPage /></ProtectedRoute>} />
                <Route path="/admin/expenses" element={<ProtectedRoute requiredRole="admin"><AdminExpensesPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to={`/day/${getToday()}`} replace />} />
              </Routes>
            </Suspense>
          </PageTransition>
          <BottomNav />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}