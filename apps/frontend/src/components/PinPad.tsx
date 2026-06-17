import { useState, useEffect, useCallback } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { Delete, ArrowLeft } from 'lucide-react';
import { vibrate, haptics } from '../theme/tokens';

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
      <motion.div
        animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={i < pin.length ? { scale: [1, 1.2, 1] } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: i < pin.length
                  ? error ? 'error.main' : 'primary.main'
                  : 'action.disabledBackground',
                transition: 'background-color 0.2s ease',
                boxShadow: i < pin.length && !error ? '0 0 8px rgba(27,107,58,0.3)' : 'none',
              }}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
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
        </motion.div>
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
              <motion.div key={i} whileTap={{ scale: 0.92 }}>
                <Button
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
                  }}
                >
                  <ArrowLeft size={22} />
                </Button>
              </motion.div>
            );
          }
          return (
            <motion.div key={i} whileTap={{ scale: 0.92 }}>
              <Button
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
                }}
              >
                {digit}
              </Button>
            </motion.div>
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