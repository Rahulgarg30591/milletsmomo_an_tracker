import { Box, Button } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';

const statusColors = {
  dine: { bg: '#EFF6FF', fg: '#1D4ED8', label: '🍽 Dine in' },
  pack: { bg: '#FEF3C7', fg: '#D97706', label: '📦 Pack' },
  cash: { bg: '#D1FAE5', fg: '#065F46', label: '💵 Cash' },
  upi: { bg: '#EDE9FE', fg: '#5B21B6', label: '📱 UPI' },
  pending: { bg: '#FEE2E2', fg: '#DC2626', label: '⏳ Pending' },
};

export default function OrderConfigPanel() {
  const { draft, setOrderType, setPaymentMethod } = useOrderDraft();

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: 0.5 }}>
          Order Type
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(['dine', 'pack'] as const).map((type) => (
            <Button
              key={type}
              size="small"
              onClick={() => setOrderType(type)}
              sx={{
                flex: 1,
                borderRadius: 3,
                py: 0.8,
                fontWeight: 600,
                fontSize: '0.8rem',
                textTransform: 'none',
                backgroundColor: draft.orderType === type ? statusColors[type].bg : 'transparent',
                color: draft.orderType === type ? statusColors[type].fg : '#6B7280',
                border: '1.5px solid',
                borderColor: draft.orderType === type ? statusColors[type].fg : '#E5E7EB',
                '&:hover': {
                  backgroundColor: statusColors[type].bg,
                },
              }}
            >
              {statusColors[type].label}
            </Button>
          ))}
        </Box>
      </Box>

      <Box>
        <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: 0.5 }}>
          Payment
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(['cash', 'upi', 'pending'] as const).map((method) => (
            <Button
              key={method}
              size="small"
              onClick={() => setPaymentMethod(method)}
              sx={{
                flex: 1,
                borderRadius: 3,
                py: 0.8,
                fontWeight: 600,
                fontSize: '0.8rem',
                textTransform: 'none',
                backgroundColor: draft.paymentMethod === method ? statusColors[method].bg : 'transparent',
                color: draft.paymentMethod === method ? statusColors[method].fg : '#6B7280',
                border: '1.5px solid',
                borderColor: draft.paymentMethod === method ? statusColors[method].fg : '#E5E7EB',
                '&:hover': {
                  backgroundColor: statusColors[method].bg,
                },
              }}
            >
              {statusColors[method].label}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
