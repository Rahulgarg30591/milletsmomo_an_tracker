import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: <CheckCircle2 size={18} color="#2D8A4E" />,
  error: <XCircle size={18} color="#DC2626" />,
  warning: <AlertCircle size={18} color="#D97706" />,
  info: <Info size={18} color="#1D4ED8" />,
};

const bgColors = {
  success: { bg: '#D1FAE5', border: '#2D8A4E' },
  error: { bg: '#FEE2E2', border: '#DC2626' },
  warning: { bg: '#FEF3C7', border: '#D97706' },
  info: { bg: '#EFF6FF', border: '#1D4ED8' },
};

export default function Toast({
  message,
  type = 'info',
  onClose,
  duration = 3000,
}: ToastProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colors = bgColors[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          minWidth: 280,
          maxWidth: '90vw',
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(26,43,34,0.95)' : colors.bg,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : colors.border}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {icons[type]}
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: isDark ? 'text.primary' : 'text.primary',
              flex: 1,
            }}
          >
            {message}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={100}
          sx={{
            height: 3,
            borderRadius: '0 0 12px 12px',
            backgroundColor: 'transparent',
            '& .MuiLinearProgress-bar': {
              backgroundColor: colors.border,
              animation: `shrink ${duration}ms linear forwards`,
            },
            '@keyframes shrink': {
              '0%': { width: '100%' },
              '100%': { width: '0%' },
            },
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}