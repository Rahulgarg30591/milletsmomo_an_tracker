import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Box, Typography } from '@mui/material';

export default function PaymentSuccessDecoration({
  show,
  onDone,
}: {
  show: boolean;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 1300);
      return () => clearTimeout(timer);
    }
  }, [show, onDone]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 60px rgba(27,107,58,0.3)',
        }}
      >
        <CheckCircle2 size={64} color="#FFFFFF" strokeWidth={2.5} />
        <Typography
          variant="body1"
          sx={{ color: '#FFFFFF', fontWeight: 700, mt: 1, fontSize: '1rem' }}
        >
          Completed
        </Typography>
      </Box>
    </Box>
  );
}
