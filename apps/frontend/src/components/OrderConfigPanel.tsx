import { Box, Button, Typography, useTheme } from '@mui/material';
import { Utensils, Package, Banknote, Smartphone, Clock } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { vibrate, haptics } from '../theme/tokens';

const typeConfig = [
  { key: 'dine' as const, label: 'Dine', icon: <Utensils size={12} /> },
  { key: 'pack' as const, label: 'Pack', icon: <Package size={12} /> },
];

const paymentConfig = [
  { key: 'cash' as const, label: 'Cash', icon: <Banknote size={12} /> },
  { key: 'upi' as const, label: 'UPI', icon: <Smartphone size={12} /> },
  { key: 'pending' as const, label: 'Pending', icon: <Clock size={12} /> },
];

export default function OrderConfigPanel() {
  const { draft, setOrderType, setPaymentMethod } = useOrderDraft();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Active / inactive colors that work on both light and dark
  const activeBg = isDark ? '#1A3D2A' : '#E8F5EE';
  const activeBorder = isDark ? '#4ADE80' : '#1B6B3A';
  const activeColor = isDark ? '#4ADE80' : '#1B6B3A';
  const inactiveBg = isDark ? '#2A2A32' : '#F9FAFB';
  const inactiveBorder = isDark ? '#3D3D44' : '#E5E7EB';
  const inactiveColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Box>
      <Box sx={{ mb: { xs: 1, md: 1.5 } }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: { xs: 0.375, md: 0.5 },
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          Type
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

      <Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: { xs: 0.375, md: 0.5 },
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: { xs: '0.6rem', md: '0.7rem' },
          }}
        >
          Payment
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
      </Box>
    </Box>
  );
}
