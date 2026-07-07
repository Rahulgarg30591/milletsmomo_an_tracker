import { useState, useEffect, useCallback } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { keyframes } from '@emotion/react';
import { Delete, ArrowLeft } from 'lucide-react';
import { vibrate, haptics } from '../theme/tokens';

const shakeAnim = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
`;

interface PinPadProps {
  onComplete: (pin: string) => void;
  error: boolean;
  onErrorAck: () => void;
  loading?: boolean;
}

export default function PinPad({ onComplete, error, onErrorAck, loading }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  useEffect(() => {
    if (error) {
      triggerShake();
    }
  }, [error, triggerShake]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (loading) return;
      if (error) onErrorAck();
      if (pin.length < 4) {
        vibrate(haptics.light);
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          onComplete(next);
        }
      }
    },
    [pin, error, onErrorAck, onComplete, loading]
  );

  const handleDelete = useCallback(() => {
    if (loading) return;
    if (error) onErrorAck();
    vibrate(haptics.light);
    setPin((p) => p.slice(0, -1));
  }, [error, onErrorAck, loading]);

  const handleClear = useCallback(() => {
    if (loading) return;
    if (error) onErrorAck();
    vibrate(haptics.light);
    setPin('');
  }, [error, onErrorAck, loading]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      const key = e.key;
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleDigit(key);
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (key === 'Enter' && pin.length === 4) {
        e.preventDefault();
        onComplete(pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, handleClear, onComplete, pin, loading]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <Box sx={{ width: '100%', maxWidth: 320, mx: 'auto' }}>
      {/* PIN dots */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mb: 3,
          animation: shake ? `${shakeAnim} 0.4s ease-in-out` : 'none',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: i < pin.length
                ? error ? 'error.main' : 'primary.main'
                : 'action.disabledBackground',
              boxShadow: i < pin.length && !error ? '0 0 8px rgba(27,107,58,0.3)' : 'none',
            }}
          />
        ))}
      </Box>

      {/* Error message */}
      {error && (
        <Box
          sx={{
            textAlign: 'center',
            mb: 2,
            py: 1,
            px: 2,
            borderRadius: 2,
            backgroundColor: 'error.light',
            color: 'error.main',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Invalid PIN. Please try again.
        </Box>
      )}

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} color="primary" />
        </Box>
      )}

      {/* Keypad */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {digits.map((digit, i) => {
          if (digit === '') {
            return <Box key={i} />;
          }
          if (digit === 'back') {
            return (
              <Button
                key={i}
                fullWidth
                variant="outlined"
                onClick={handleDelete}
                disabled={loading}
                aria-label="Delete last digit"
                sx={{
                  borderRadius: 2.5,
                  height: 64,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { backgroundColor: 'action.hover', borderColor: 'primary.light' },
                  '&:active': { transform: 'scale(0.92)' },
                }}
              >
                <ArrowLeft size={22} />
              </Button>
            );
          }
          return (
            <Button
              key={i}
              fullWidth
              variant="outlined"
              onClick={() => handleDigit(digit)}
              disabled={loading}
              aria-label={`PIN digit ${digit}`}
              sx={{
                borderRadius: 2.5,
                height: 64,
                fontSize: '1.5rem',
                fontWeight: 600,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': { backgroundColor: 'action.hover', borderColor: 'primary.light' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: 2,
                },
                '&:active': { transform: 'scale(0.92)' },
              }}
            >
              {digit}
            </Button>
          );
        })}
      </Box>

      {/* Clear button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          onClick={handleClear}
          disabled={loading}
          startIcon={<Delete size={16} />}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.9rem',
          }}
        >
          Clear
        </Button>
      </Box>
    </Box>
  );
}
