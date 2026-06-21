import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, useTheme, Button } from '@mui/material';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'staff' | 'admin';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { auth, isAuthenticated } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!isAuthenticated()) {
    const redirectTo = `/login?redirect=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRole && auth.role !== requiredRole) {
    return (
      <Box sx={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: 2,
        gap: 2,
      }}>
        <ShieldAlert size={48} color={isDark ? '#F87171' : '#DC2626'} />
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'text.primary', textAlign: 'center' }}>
          Access Denied
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center', maxWidth: 300 }}>
          You don't have permission to view this page. This section requires {requiredRole} role.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft size={16} />}
          onClick={() => window.history.back()}
          sx={{ textTransform: 'none', fontWeight: 600, mt: 1 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
}