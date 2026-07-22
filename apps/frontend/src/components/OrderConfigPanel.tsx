import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Box, Button, Typography, TextField, useTheme } from '@mui/material';
import { keyframes } from '@emotion/react';
import { Utensils, Package, Banknote, Smartphone, Clock, Split } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { calculateOrderTotal } from '../utils/pricing';
import { trackSelection } from '../utils/tracking';
import { vibrate, haptics } from '../theme/tokens';

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(3px); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
`;

const typeConfig = [
  { key: 'dine' as const, label: 'Dine', icon: <Utensils size={12} /> },
  { key: 'pack' as const, label: 'Pack', icon: <Package size={12} /> },
];

const paymentConfig = [
  { key: 'cash' as const, label: 'Cash', icon: <Banknote size={12} /> },
  { key: 'upi' as const, label: 'UPI', icon: <Smartphone size={12} /> },
  { key: 'split' as const, label: 'Split', icon: <Split size={12} /> },
  { key: 'pending' as const, label: 'Pending', icon: <Clock size={12} /> },
];

export interface OrderConfigPanelHandle {
  scrollToError: (field: 'type' | 'payment') => void;
}

const OrderConfigPanelInner = forwardRef<OrderConfigPanelHandle>(function OrderConfigPanelInner(_props, ref) {
  const { draft, setOrderType, setPaymentMethod, setSplitAmounts, setComment, validationErrors } = useOrderDraft();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const typeRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  const items = draft.items;
  const itemList = Array.from(items.entries()).map(([menuItemId, item]) => ({ menuItemId, ...item }));
  const total = calculateOrderTotal(itemList);

  const [cashVal, setCashVal] = useState<string>('');
  const [upiVal, setUpiVal] = useState<string>('');

  // Reset to blank when switching away from split
  useEffect(() => {
    if (draft.paymentMethod !== 'split') {
      setCashVal('');
      setUpiVal('');
    }
  }, [draft.paymentMethod]);

  const handleCashChange = (val: string) => {
    setCashVal(val);
    const cash = parseFloat(val);
    if (!isNaN(cash) && total > 0) {
      const upi = Math.max(0, total - cash);
      setUpiVal(String(upi));
      setSplitAmounts(cash, upi);
    } else {
      setUpiVal('');
      setSplitAmounts(0, 0);
    }
  };

  const handleUpiChange = (val: string) => {
    setUpiVal(val);
    const upi = parseFloat(val);
    if (!isNaN(upi) && total > 0) {
      const cash = Math.max(0, total - upi);
      setCashVal(String(cash));
      setSplitAmounts(cash, upi);
    } else {
      setCashVal('');
      setSplitAmounts(0, 0);
    }
  };

  const cashNum = parseFloat(cashVal);
  const upiNum = parseFloat(upiVal);
  const isSplitValid = !isNaN(cashNum) && !isNaN(upiNum) && Math.abs(cashNum + upiNum - total) < 0.01;

  useImperativeHandle(ref, () => ({
    scrollToError: (field: 'type' | 'payment') => {
      const target = field === 'type' ? typeRef.current : paymentRef.current;
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    },
  }), []);

  // Active = solid filled green (clearly highlighted); inactive = subtle
  const activeBg = isDark ? '#2D8A4E' : '#1B6B3A';
  const activeBorder = isDark ? '#4ADE80' : '#1B6B3A';
  const activeColor = '#FFFFFF';
  const inactiveBg = isDark ? '#2A2A32' : '#F9FAFB';
  const inactiveBorder = isDark ? '#3D3D44' : '#E5E7EB';
  const inactiveColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Box>
      <Box
        ref={typeRef}
        sx={{
          mb: { xs: 1, md: 1.5 },
          scrollMarginTop: 72,
          animation: validationErrors.type ? `${shake} 0.4s ease-in-out` : 'none',
          borderRadius: { xs: 0.75, md: 1 },
          ...(validationErrors.type ? {
            border: `2px solid ${isDark ? '#F87171' : '#DC2626'}`,
            p: 1,
            animation: `${shake} 0.4s ease-in-out, ${pulseGlow} 1.5s ease-in-out 1`,
          } : {}),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: validationErrors.type ? (isDark ? '#F87171' : '#DC2626') : 'text.secondary',
            mb: { xs: 0.375, md: 0.5 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          Type
          {validationErrors.type && (
            <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 600, color: isDark ? '#F87171' : '#DC2626', textTransform: 'none', letterSpacing: 0 }}>
              Required
            </Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, md: 0.75 } }}>
          {typeConfig.map((type) => {
            const isActive = draft.orderType === type.key;
            return (
              <Button
                key={type.key}
                fullWidth
                size="small"
                onClick={() => {
                  vibrate(haptics.light);
                  trackSelection('new_order', 'order_type', type.label, { orderType: type.key });
                  setOrderType(type.key);
                }}
                startIcon={type.icon}
                sx={{
                  flex: { xs: '1 1 40%', md: 1 },
                  borderRadius: { xs: 0.75, md: 1 },
                  py: { xs: 0.5, md: 0.75 },
                  fontWeight: isActive ? 800 : 600,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  textTransform: 'none',
                  backgroundColor: isActive ? activeBg : inactiveBg,
                  color: isActive ? activeColor : inactiveColor,
                  border: { xs: 1, md: 1.5 },
                  borderColor: isActive ? activeBorder : inactiveBorder,
                  boxShadow: isActive ? `0 2px 8px ${isDark ? 'rgba(74,222,128,0.3)' : 'rgba(27,107,58,0.25)'}` : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: isActive ? activeBg : (isDark ? '#333338' : '#F0F1F3'),
                    borderColor: isActive ? activeBorder : (isDark ? '#5A5A64' : '#D1D5DB'),
                  },
                  minHeight: 0,
                  lineHeight: 1.2,
                }}
              >
                {type.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      <Box
        ref={paymentRef}
        sx={{
          scrollMarginTop: 72,
          animation: validationErrors.payment ? `${shake} 0.4s ease-in-out` : 'none',
          borderRadius: { xs: 0.75, md: 1 },
          ...(validationErrors.payment ? {
            border: `2px solid ${isDark ? '#F87171' : '#DC2626'}`,
            p: 1,
            animation: `${shake} 0.4s ease-in-out, ${pulseGlow} 1.5s ease-in-out 1`,
          } : {}),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: validationErrors.payment ? (isDark ? '#F87171' : '#DC2626') : 'text.secondary',
            mb: { xs: 0.375, md: 0.5 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          Payment
          {validationErrors.payment && (
            <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 600, color: isDark ? '#F87171' : '#DC2626', textTransform: 'none', letterSpacing: 0 }}>
              Required
            </Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, md: 0.75 } }}>
          {paymentConfig.map((method) => {
            const isActive = draft.paymentMethod === method.key;
            const isPending = method.key === 'pending';

            const activeColor2 = '#FFFFFF';
            const activeBg2 = isPending
              ? (isDark ? '#DC2626' : '#DC2626')
              : activeBg;
            const activeBorder2 = isPending
              ? (isDark ? '#F87171' : '#DC2626')
              : activeBorder;

            return (
              <Button
                key={method.key}
                fullWidth
                size="small"
                onClick={() => {
                  vibrate(haptics.light);
                  trackSelection('new_order', 'payment_method', method.label, { paymentMethod: method.key });
                  setPaymentMethod(method.key);
                }}
                startIcon={method.icon}
                sx={{
                  flex: { xs: '1 1 40%', md: 1 },
                  borderRadius: { xs: 0.75, md: 1 },
                  py: { xs: 0.5, md: 0.75 },
                  fontWeight: isActive ? 800 : 600,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  textTransform: 'none',
                  backgroundColor: isActive ? activeBg2 : inactiveBg,
                  color: isActive ? activeColor2 : inactiveColor,
                  border: { xs: 1, md: 1.5 },
                  borderColor: isActive ? activeBorder2 : inactiveBorder,
                  boxShadow: isActive
                    ? `0 2px 8px ${isPending ? (isDark ? 'rgba(248,113,113,0.3)' : 'rgba(220,38,38,0.25)') : (isDark ? 'rgba(74,222,128,0.3)' : 'rgba(27,107,58,0.25)')}`
                    : 'none',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    backgroundColor: isActive ? activeBg2 : (isDark ? '#333338' : '#F0F1F3'),
                    borderColor: isActive ? activeBorder2 : (isDark ? '#5A5A64' : '#D1D5DB'),
                  },
                  minHeight: 0,
                  lineHeight: 1.2,
                }}
              >
                {method.label}
              </Button>
            );
          })}
        </Box>

        {/* Split payment inputs */}
        {draft.paymentMethod === 'split' && total > 0 && (
          <Box sx={{
            mt: 1,
            p: { xs: 1, md: 1.25 },
            borderRadius: { xs: 0.75, md: 1 },
            border: `1px solid ${isSplitValid ? (isDark ? 'rgba(45,138,78,0.2)' : 'rgba(27,107,58,0.15)') : (isDark ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.15)')}`,
            background: isSplitValid ? (isDark ? 'rgba(45,138,78,0.04)' : 'rgba(27,107,58,0.03)') : (isDark ? 'rgba(220,38,38,0.04)' : 'rgba(220,38,38,0.03)'),
            display: 'flex',
            gap: { xs: 1, md: 1.5 },
            alignItems: 'center',
          }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' }, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.375 }}>
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
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  py: 0.5,
                  px: 0.75,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                  borderRadius: 1,
                  background: 'transparent',
                  color: 'inherit',
                  outline: 'none',
                  '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                  '-moz-appearance': 'textfield',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary', mt: 1.5 }}>
              +
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.7rem' }, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.375 }}>
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
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  py: 0.5,
                  px: 0.75,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : theme.palette.divider}`,
                  borderRadius: 1,
                  background: 'transparent',
                  color: 'inherit',
                  outline: 'none',
                  '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                  '-moz-appearance': 'textfield',
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mt: 1.5 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: isSplitValid ? (isDark ? '#4ADE80' : '#16A34A') : (isDark ? '#F87171' : '#DC2626'), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isSplitValid ? '✓' : '!'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 500 }}>
                ₹{total}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ mt: { xs: 1, md: 1.5 } }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: { xs: 0.375, md: 0.5 },
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          Comment
          <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
            (optional)
          </Typography>
        </Typography>
        <TextField
          fullWidth
          multiline
          maxRows={2}
          size="small"
          value={draft.comment ?? ''}
          onChange={(e) => setComment(e.target.value || null)}
          placeholder="Add a note for this order…"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: { xs: 0.75, md: 1 },
              fontSize: { xs: '0.8rem', md: '0.85rem' },
              backgroundColor: isDark ? '#2A2A32' : '#F9FAFB',
            },
          }}
        />
      </Box>
    </Box>
  );
});

export default OrderConfigPanelInner;
