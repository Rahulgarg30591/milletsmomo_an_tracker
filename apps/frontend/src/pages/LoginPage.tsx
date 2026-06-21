import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Paper, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { Leaf, Shield, User } from 'lucide-react';
import PinPad from '../components/PinPad';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/authApi';
import { trackLogin } from '../utils/tracking';
import { vibrate, haptics } from '../theme/tokens';
import { getToday } from '../utils/dateUtils';

export default function LoginPage() {
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const redirectPath = searchParams.get('redirect') || null;

  useEffect(() => {
    if (error) {
      vibrate(haptics.error);
    }
  }, [error]);

  const handlePinComplete = async (pin: string) => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await login({ role, pin });
      doLogin(res.token, res.role, res.displayName);
      trackLogin();
      vibrate(haptics.success);
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
      } else if (res.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate(`/day/${getToday()}`, { replace: true });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleErrorAck = useCallback(() => {
    setError(false);
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

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
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
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
            >
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
            </motion.div>
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
                setError(false);
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
                setError(false);
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
            error={error}
            onErrorAck={handleErrorAck}
            loading={loading}
          />
        </Paper>
      </motion.div>
    </Box>
  );
}