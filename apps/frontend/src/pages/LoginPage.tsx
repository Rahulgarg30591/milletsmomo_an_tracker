import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Typography } from '@mui/material';
import PinPad from '../components/PinPad';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/authApi';

export default function LoginPage() {
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  const handlePinComplete = async (pin: string) => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await login({ role, pin });
      doLogin(res.token, res.role, res.displayName);
      if (res.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dates');
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleErrorAck = () => {
    setError(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F4F1',
        p: 2,
      }}
    >
      <Paper
        sx={{
          width: '100%',
          maxWidth: 400,
          p: 4,
          borderRadius: 5,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)',
          animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          '@keyframes popIn': {
            '0%': { transform: 'scale(0.92)', opacity: 0 },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 4,
              backgroundColor: '#E8F5EE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}
          >
            🍽
          </Box>
        </Box>

        <Typography
          variant="h1"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 800,
            textAlign: 'center',
            mb: 1,
            color: '#111827',
            letterSpacing: '-0.5px',
          }}
        >
          Millets Momo
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            color: '#6B7280',
            mb: 4,
            fontSize: '0.95rem',
          }}
        >
          Order Tracker
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
          <Button
            fullWidth
            variant={role === 'staff' ? 'contained' : 'outlined'}
            onClick={() => setRole('staff')}
            sx={{
              borderRadius: 3,
              py: 1.2,
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: role === 'staff' ? '#1B6B3A' : 'transparent',
              borderColor: role === 'staff' ? '#1B6B3A' : '#E5E7EB',
              color: role === 'staff' ? '#FFFFFF' : '#374151',
            }}
          >
            Staff
          </Button>
          <Button
            fullWidth
            variant={role === 'admin' ? 'contained' : 'outlined'}
            onClick={() => setRole('admin')}
            sx={{
              borderRadius: 3,
              py: 1.2,
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: role === 'admin' ? '#1B6B3A' : 'transparent',
              borderColor: role === 'admin' ? '#1B6B3A' : '#E5E7EB',
              color: role === 'admin' ? '#FFFFFF' : '#374151',
            }}
          >
            Admin
          </Button>
        </Box>

        {error && (
          <Typography
            sx={{
              color: '#DC2626',
              textAlign: 'center',
              mb: 2,
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            Invalid PIN. Please try again.
          </Typography>
        )}

        <PinPad
          onComplete={handlePinComplete}
          error={error}
          onErrorAck={handleErrorAck}
        />
      </Paper>
    </Box>
  );
}
