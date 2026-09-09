import { useState, useEffect, useCallback, useRef } from 'react';
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
  errorMessage: string | null;
  onErrorAck: () => void;
  loading?: boolean;
  statusMessage?: string | null;
}

export default function PinPad({ onComplete, errorMessage, onErrorAck, loading, statusMessage }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  useEffect(() => {
    if (errorMessage) {
      triggerShake();
      setPin('');
    }
  }, [errorMessage, triggerShake]);

  // Taps that land in one React batch all see the same `pin`, so reading it
  // from the closure silently dropped digits when tapping quickly. The
  // functional update keeps every tap, and an effect submits once full.
  const handleDigit = useCallback(
    (digit: string) => {
      if (loading) return;
      if (errorMessage) onErrorAck();
      vibrate(haptics.light);
      setPin((prev) => (prev.length < 4 ? prev + digit : prev));
    },
    [errorMessage, onErrorAck, loading]
  );

  const submittedPin = useRef<string | null>(null);

  useEffect(() => {
    if (pin.length === 0) {
      submittedPin.current = null;
      return;
    }
    if (pin.length < 4 || submittedPin.current === pin) return;
    submittedPin.current = pin;
    onComplete(pin);
  }, [pin, onComplete]);

  const handleDelete = useCallback(() => {
    if (loading) return;
    if (errorMessage) onErrorAck();
    vibrate(haptics.light);
    setPin((p) => p.slice(0, -1));
  }, [errorMessage, onErrorAck, loading]);

  const handleClear = useCallback(() => {
    if (loading) return;
    if (errorMessage) onErrorAck();
    vibrate(haptics.light);
    setPin('');
  }, [errorMessage, onErrorAck, loading]);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, handleClear, loading]);

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
                ? errorMessage ? 'error.main' : 'primary.main'
                : 'action.disabledBackground',
              boxShadow: i < pin.length && !errorMessage ? '0 0 8px rgba(27,107,58,0.3)' : 'none',
            }}
          />
        ))}
      </Box>

      {/* Error message */}
      {errorMessage && (
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
          {errorMessage}
        </Box>
      )}

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={24} color="primary" />
          {statusMessage && (
            <Box sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center' }}>
              {statusMessage}
            </Box>
          )}
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
