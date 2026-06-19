import { useState, useEffect } from 'react';
import { Box, Button, Paper, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, X, Split } from 'lucide-react';
import { vibrate, haptics } from '../theme/tokens';

interface PaymentModalProps {
  open: boolean;
  totalAmount: number;
  onResolve: (method: 'cash' | 'upi' | 'split', cashAmount?: number, upiAmount?: number) => void;
  onCancel: () => void;
}

export default function PaymentModal({ open, totalAmount, onResolve, onCancel }: PaymentModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [showSplit, setShowSplit] = useState(false);
  const [cashVal, setCashVal] = useState<string>('');
  const [upiVal, setUpiVal] = useState<string>('');

  useEffect(() => {
    if (open) {
      setShowSplit(false);
      setCashVal('');
      setUpiVal('');
    }
  }, [open, totalAmount]);

  const handleCashChange = (val: string) => {
    setCashVal(val);
    const cash = parseFloat(val);
    if (!isNaN(cash) && totalAmount > 0) {
      const upi = Math.max(0, totalAmount - cash);
      setUpiVal(String(upi));
    } else {
      setUpiVal('');
    }
  };

  const handleUpiChange = (val: string) => {
    setUpiVal(val);
    const upi = parseFloat(val);
    if (!isNaN(upi) && totalAmount > 0) {
      const cash = Math.max(0, totalAmount - upi);
      setCashVal(String(cash));
    } else {
      setCashVal('');
    }
  };

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
                ? 'linear-gradient(180deg, #25252D 0%, #1C1C22 100%)'
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

          {!showSplit ? (
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
              <motion.div whileTap={{ scale: 0.97 }} style={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    vibrate(haptics.light);
                    setShowSplit(true);
                  }}
                  startIcon={<Split size={20} />}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    borderColor: isDark ? '#7C3AED' : '#7C3AED',
                    color: isDark ? '#C4A8E8' : '#7C3AED',
                  }}
                >
                  Split
                </Button>
              </motion.div>
            </Box>
          ) : (
            <Box>
              <Box sx={{
                display: 'flex',
                gap: 2,
                mb: 2,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
              }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Cash ₹
                  </Typography>
                  <Box
                    component="input"
                    type="number"
                    value={cashVal}
                    onChange={(e) => handleCashChange(e.target.value)}
                    sx={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: 700,
                      py: 0.75,
                      px: 1,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                      borderRadius: 1.5,
                      background: 'transparent',
                      color: 'inherit',
                      outline: 'none',
                      '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                      '-moz-appearance': 'textfield',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', pt: 2 }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'text.secondary' }}>
                    +
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    UPI ₹
                  </Typography>
                  <Box
                    component="input"
                    type="number"
                    value={upiVal}
                    onChange={(e) => handleUpiChange(e.target.value)}
                    sx={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: 700,
                      py: 0.75,
                      px: 1,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                      borderRadius: 1.5,
                      background: 'transparent',
                      color: 'inherit',
                      outline: 'none',
                      '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                      '-moz-appearance': 'textfield',
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setShowSplit(false)}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                  }}
                >
                  Back
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    vibrate(haptics.medium);
                    const cash = parseFloat(cashVal) || 0;
                    const upi = parseFloat(upiVal) || 0;
                    onResolve('split', cash, upi);
                  }}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.25)',
                  }}
                >
                  Confirm Split
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </motion.div>
    </motion.div>
  );
}