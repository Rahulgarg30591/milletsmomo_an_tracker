import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Paper, Typography, useTheme } from '@mui/material';

import { Leaf, Shield, User } from 'lucide-react';
import PinPad from '../components/PinPad';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/authApi';
import { trackLogin, markSessionStart } from '../utils/tracking';
import { vibrate, haptics } from '../theme/tokens';
import { getToday } from '../utils/dateUtils';

export default function LoginPage() {
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login: doLogin, isAuthenticated, auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const redirectPath = searchParams.get('redirect') || null;

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (auth.role === 'admin') {
      navigate(redirectPath?.startsWith('/admin') ? redirectPath : '/admin', { replace: true });
    } else {
      const safeRedirect = redirectPath && !redirectPath.startsWith('/admin') ? redirectPath : `/day/${getToday()}`;
      navigate(safeRedirect, { replace: true });
    }
  }, [isAuthenticated, auth.role, auth.token, navigate, redirectPath]);

  useEffect(() => {
    if (errorMessage) {
      vibrate(haptics.error);
    }
  }, [errorMessage]);

  const handlePinComplete = async (pin: string) => {
    if (loading || isAuthenticated()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await login({ role, pin });
      doLogin(res.token, res.role, res.displayName, pin);
      markSessionStart();
      trackLogin({ role: res.role, displayName: res.displayName });
      vibrate(haptics.success);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        setErrorMessage('Too many login attempts. Wait 15 minutes.');
      } else if (status === 401) {
        setErrorMessage('Invalid PIN. Try again.');
      } else if (!err.response) {
        setErrorMessage('Network error. Check connection.');
      } else {
        setErrorMessage('Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleErrorAck = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, #1C1C22 0%, #25252D 50%, #1E1E24 100%)'
          : 'linear-gradient(135deg, #F0F4F1 0%, #E8F5EE 50%, #FEF3C7 100%)',
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(74,222,128,0.10) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(27,107,58,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(232,166,74,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}
      >
        <Paper
          sx={{
            width: '100%',
            p: { xs: 3, sm: 4 },
            borderRadius: 5,
            background: isDark
              ? 'rgba(37,37,45,0.85)'
              : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 25px 50px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.04)',
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(27,107,58,0.25)',
                color: '#FFFFFF',
              }}
            >
              <Leaf size={36} color="currentColor" strokeWidth={2} />
            </Box>
          </Box>

          <Typography
            variant="h1"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 800,
              textAlign: 'center',
              mb: 0.5,
              color: 'text.primary',
              letterSpacing: '-0.5px',
            }}
          >
            Millets Momo
          </Typography>
          <Typography
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              mb: 4,
              fontSize: '0.95rem',
              fontWeight: 500,
            }}
          >
            Order Tracker
          </Typography>

          {/* Role selector */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 4 }}>
            <Button
              fullWidth
              variant={role === 'staff' ? 'contained' : 'outlined'}
              onClick={() => {
                vibrate(haptics.light);
                setRole('staff');
                setErrorMessage(null);
              }}
              sx={{
                borderRadius: 3,
                py: 1.4,
                fontWeight: 600,
                textTransform: 'none',
                gap: 1,
                borderWidth: 2,
                borderColor: role === 'staff' ? 'primary.main' : 'divider',
                color: role === 'staff' ? 'primary.contrastText' : 'text.primary',
              }}
              startIcon={<User size={18} />}
            >
              Staff
            </Button>
            <Button
              fullWidth
              variant={role === 'admin' ? 'contained' : 'outlined'}
              onClick={() => {
                vibrate(haptics.light);
                setRole('admin');
                setErrorMessage(null);
              }}
              sx={{
                borderRadius: 3,
                py: 1.4,
                fontWeight: 600,
                textTransform: 'none',
                gap: 1,
                borderWidth: 2,
                borderColor: role === 'admin' ? 'primary.main' : 'divider',
                color: role === 'admin' ? 'primary.contrastText' : 'text.primary',
              }}
              startIcon={<Shield size={18} />}
            >
              Admin
            </Button>
          </Box>

          <PinPad
            onComplete={handlePinComplete}
            errorMessage={errorMessage}
            onErrorAck={handleErrorAck}
            loading={loading}
          />
        </Paper>
      </Box>
    </Box>
  );
}