import { Box, Button, Typography } from '@mui/material';
import { Utensils, Package, Banknote, Smartphone, Clock } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { statusColors, darkStatusColors } from '../theme/tokens';
import { useTheme } from '@mui/material/styles';

const typeConfig = [
  { key: 'dine' as const, label: 'Dine in', icon: <Utensils size={14} /> },
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
  const colors = isDark ? darkStatusColors : statusColors;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            mb: 0.75,
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
              onClick={() => setOrderType(type.key)}
              startIcon={type.icon}
              sx={{
                borderRadius: 3,
                py: 0.8,
                fontWeight: 600,
                fontSize: '0.8rem',
                textTransform: 'none',
                backgroundColor: draft.orderType === type.key ? colors.dineIn.bg : 'transparent',
                color: draft.orderType === type.key ? colors.dineIn.fg : 'text.secondary',
                border: 1.5,
                borderColor: draft.orderType === type.key ? 'primary.main' : 'divider',
                '&:hover': {
                  backgroundColor: colors.dineIn.bg,
                  borderColor: 'primary.main',
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
            mb: 0.75,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.7rem',
          }}
        >
          Payment
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {paymentConfig.map((method) => {
            const colorKey = method.key === 'pending' ? 'pending' : method.key === 'cash' ? 'cash' : 'upi';
            const c = colors[colorKey];
            return (
              <Button
                key={method.key}
                fullWidth
                size="small"
                onClick={() => setPaymentMethod(method.key)}
                startIcon={method.icon}
                sx={{
                  borderRadius: 3,
                  py: 0.8,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  backgroundColor: draft.paymentMethod === method.key ? c.bg : 'transparent',
                  color: draft.paymentMethod === method.key ? c.fg : 'text.secondary',
                  border: 1.5,
                  borderColor: draft.paymentMethod === method.key ? c.fg : 'divider',
                  '&:hover': {
                    backgroundColor: c.bg,
                    borderColor: c.fg,
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