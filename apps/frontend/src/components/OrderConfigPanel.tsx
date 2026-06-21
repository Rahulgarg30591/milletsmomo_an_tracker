import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { keyframes } from '@emotion/react';
import { Utensils, Package, Banknote, Smartphone, Clock, Split } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { calculateOrderTotal } from '../utils/pricing';
import { trackButtonClick } from '../utils/tracking';
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
  const { draft, setOrderType, setPaymentMethod, setSplitAmounts, validationErrors } = useOrderDraft();
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
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  }), []);

  // Active / inactive colors that work on both light and dark
  const activeBg = isDark ? '#1A3D2A' : '#E8F5EE';
  const activeBorder = isDark ? '#4ADE80' : '#1B6B3A';
  const activeColor = isDark ? '#4ADE80' : '#1B6B3A';
  const inactiveBg = isDark ? '#2A2A32' : '#F9FAFB';
  const inactiveBorder = isDark ? '#3D3D44' : '#E5E7EB';
  const inactiveColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Box>
      <Box
        ref={typeRef}
        sx={{
          mb: { xs: 1, md: 1.5 },
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
        <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 0.75 } }}>
          {typeConfig.map((type) => {
            const isActive = draft.orderType === type.key;
            return (
              <Button
                key={type.key}
                fullWidth
                size="small"
                onClick={() => {
                  vibrate(haptics.light);
                  trackButtonClick('new_order', `select_type_${type.key}`);
                  setOrderType(type.key);
                }}
                startIcon={type.icon}
                sx={{
                  borderRadius: { xs: 0.75, md: 1 },
                  py: { xs: 0.5, md: 0.75 },
                  fontWeight: 600,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  textTransform: 'none',
                  backgroundColor: isActive ? activeBg : inactiveBg,
                  color: isActive ? activeColor : inactiveColor,
                  border: { xs: 1, md: 1.5 },
                  borderColor: isActive ? activeBorder : inactiveBorder,
                  '&:hover': {
                    backgroundColor: activeBg,
                    borderColor: activeBorder,
                    color: activeColor,
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
        <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 0.75 } }}>
          {paymentConfig.map((method) => {
            const isActive = draft.paymentMethod === method.key;
            const isPending = method.key === 'pending';

            const activeColor2 = isPending
              ? (isDark ? '#F87171' : '#DC2626')
              : activeColor;
            const activeBg2 = isPending
              ? (isDark ? '#3D1A1A' : '#FEE2E2')
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
                  trackButtonClick('new_order', `select_payment_${method.key}`);
                  setPaymentMethod(method.key);
                }}
                startIcon={method.icon}
                sx={{
                  borderRadius: { xs: 0.75, md: 1 },
                  py: { xs: 0.5, md: 0.75 },
                  fontWeight: 600,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  textTransform: 'none',
                  backgroundColor: isActive ? activeBg2 : inactiveBg,
                  color: isActive ? activeColor2 : inactiveColor,
                  border: { xs: 1, md: 1.5 },
                  borderColor: isActive ? activeBorder2 : inactiveBorder,
                  '&:hover': {
                    backgroundColor: activeBg2,
                    borderColor: activeBorder2,
                    color: activeColor2,
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
    </Box>
  );
});

export default OrderConfigPanelInner;
