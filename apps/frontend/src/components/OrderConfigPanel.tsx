import { Box, Button, Typography, useTheme } from '@mui/material';
import { Utensils, Package, Banknote, Smartphone, Clock } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { vibrate, haptics } from '../theme/tokens';

const typeConfig = [
  { key: 'dine' as const, label: 'Dine In', icon: <Utensils size={14} /> },
  { key: 'pack' as const, label: 'Pack', icon: <Package size={14} /> },
];

const paymentConfig = [
  { key: 'cash' as const, label: 'Cash', icon: <Banknote size={14} /> },
  { key: 'upi' as const, label: 'UPI', icon: <Smartphone size={14} /> },
  { key: 'pending' as const, label: 'Pending', icon: <Clock size={14} /> },
];

export default function OrderConfigPanel() {
  const { draft, setOrderType, setPaymentMethod } = useOrderDraft();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const activeBg = isDark ? 'rgba(27,107,58,0.15)' : '#E8F5EE';
  const activeBorder = '#1B6B3A';
  const inactiveBg = isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB';
  const inactiveBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: 1,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.7rem',
          }}
        >
          Order Type
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {typeConfig.map((type) => (
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
                borderRadius: 3,
                py: 1,
                fontWeight: 600,
                fontSize: '0.85rem',
                textTransform: 'none',
                backgroundColor: draft.orderType === type.key ? activeBg : inactiveBg,
                color: draft.orderType === type.key ? '#1B6B3A' : 'text.secondary',
                border: 1.5,
                borderColor: draft.orderType === type.key ? activeBorder : inactiveBorder,
                '&:hover': {
                  backgroundColor: activeBg,
                  borderColor: activeBorder,
                },
              }}
            >
              {type.label}
            </Button>
          ))}
        </Box>
      </Box>

      <Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: 1,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.7rem',
          }}
        >
          Payment Method
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {paymentConfig.map((method) => {
            const isActive = draft.paymentMethod === method.key;
            const isPending = method.key === 'pending';
            const activeColor = isPending ? '#DC2626' : '#1B6B3A';
            const activeBg2 = isPending ? '#FEE2E2' : activeBg;
            const activeBorder2 = isPending ? '#DC2626' : activeBorder;

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
                  borderRadius: 3,
                  py: 1,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  backgroundColor: isActive ? activeBg2 : inactiveBg,
                  color: isActive ? activeColor : 'text.secondary',
                  border: 1.5,
                  borderColor: isActive ? activeBorder2 : inactiveBorder,
                  '&:hover': {
                    backgroundColor: activeBg2,
                    borderColor: activeBorder2,
                  },
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
