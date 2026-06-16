import { useState } from 'react';
import { Box, Button } from '@mui/material';

interface PinPadProps {
  onComplete: (pin: string) => void;
  error: boolean;
  onErrorAck: () => void;
}

export default function PinPad({ onComplete, error, onErrorAck }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (error) onErrorAck();
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        onComplete(next);
      }
    }
  };

  const handleDelete = () => {
    if (error) onErrorAck();
    setPin((p) => p.slice(0, -1));
  };

  const handleClear = () => {
    if (error) onErrorAck();
    setPin('');
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  if (error && !shake) {
    triggerShake();
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <Box sx={{ width: '100%', maxWidth: 320, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mb: 3,
          animation: shake ? 'shake 0.4s ease' : 'none',
          '@keyframes shake': {
            '0%, 100%': { transform: 'translateX(0)' },
            '25%': { transform: 'translateX(-8px)' },
            '50%': { transform: 'translateX(8px)' },
            '75%': { transform: 'translateX(-8px)' },
          },
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: i < pin.length ? '#1B6B3A' : '#D1D5DB',
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {digits.map((digit, i) => {
          if (digit === '') {
            return <Box key={i} />;
          }
          if (digit === 'back') {
            return (
              <Button
                key={i}
                variant="outlined"
                onClick={handleDelete}
                sx={{
                  borderRadius: 2,
                  height: 56,
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  borderColor: '#E5E7EB',
                  color: '#374151',
                }}
              >
                ⌫
              </Button>
            );
          }
          return (
            <Button
              key={i}
              variant="outlined"
              onClick={() => handleDigit(digit)}
              sx={{
                borderRadius: 2,
                height: 56,
                fontSize: '1.4rem',
                fontWeight: 600,
                borderColor: '#E5E7EB',
                color: '#374151',
                '&:active': { transform: 'scale(0.95)', backgroundColor: '#E8F5EE' },
              }}
            >
              {digit}
            </Button>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          onClick={handleClear}
          sx={{
            color: '#6B7280',
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
