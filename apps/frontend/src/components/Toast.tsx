import { Box, Typography } from '@mui/material';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        px: 3,
        py: 1.5,
        borderRadius: 3,
        backgroundColor: '#111827',
        color: '#FFFFFF',
        fontWeight: 600,
        fontSize: '0.9rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        animation: 'slideUpFade 0.25s ease',
        '@keyframes slideUpFade': {
          '0%': { transform: 'translateX(-50%) translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateX(-50%) translateY(0)', opacity: 1 },
        },
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{message}</Typography>
    </Box>
  );
}
