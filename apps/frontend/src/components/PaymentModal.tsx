import { useEffect } from 'react';
import { Box, Button, Paper, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, X } from 'lucide-react';
import { vibrate, haptics } from '../theme/tokens';

interface PaymentModalProps {
  open: boolean;
  onResolve: (method: 'cash' | 'upi') => void;
  onCancel: () => void;
}

export default function PaymentModal({ open, onResolve, onCancel }: PaymentModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper
          sx={{
            borderRadius: '24px 24px 0 0',
            p: 3,
            background: isDark
              ? 'linear-gradient(180deg, #1A2B22 0%, #0F1A14 100%)'
              : 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: 'text.primary' }}>
              Collect Payment
            </Typography>
            <Button
              size="small"
              onClick={onCancel}
              sx={{ minWidth: 0, p: 0.5, color: 'text.secondary' }}
            >
              <X size={20} />
            </Button>
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 3 }}>
            This order was pending. How did the customer pay?
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <motion.div whileTap={{ scale: 0.97 }} style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => {
                  vibrate(haptics.medium);
                  onResolve('cash');
                }}
                startIcon={<Banknote size={20} />}
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
                  boxShadow: '0 4px 14px rgba(27,107,58,0.25)',
                }}
              >
                Cash
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.97 }} style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => {
                  vibrate(haptics.medium);
                  onResolve('upi');
                }}
                startIcon={<Smartphone size={20} />}
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
                  boxShadow: '0 4px 14px rgba(29,78,216,0.25)',
                }}
              >
                UPI
              </Button>
            </motion.div>
          </Box>
        </Paper>
      </motion.div>
    </motion.div>
  );
}