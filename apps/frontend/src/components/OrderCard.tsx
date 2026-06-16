import { Box, Button, Typography } from '@mui/material';
import type { Order } from '../types';

const statusColors = {
  dine: { bg: '#EFF6FF', fg: '#1D4ED8', label: '🍽 Dine in' },
  pack: { bg: '#FEF3C7', fg: '#D97706', label: '📦 Pack' },
  cash: { bg: '#D1FAE5', fg: '#065F46', label: '💵 Cash' },
  upi: { bg: '#EDE9FE', fg: '#5B21B6', label: '📱 UPI' },
  pending: { bg: '#FEE2E2', fg: '#DC2626', label: '⏳ Pending' },
  completed: { bg: '#F3F4F6', fg: '#6B7280', label: '✓ Done' },
};

interface OrderCardProps {
  order: Order;
  onComplete: (order: Order) => void;
  onDelete: (order: Order) => void;
}

export default function OrderCard({ order, onComplete, onDelete }: OrderCardProps) {
  const typeConfig = statusColors[order.orderType];
  const paymentConfig = statusColors[order.paymentMethod];
  const isCompleted = order.isCompleted;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: isCompleted ? '3px solid #9CA3AF' : '3px solid #1B6B3A',
        opacity: isCompleted ? 0.75 : 1,
        mb: 1.5,
        animation: 'slideUp 0.25s ease',
        '@keyframes slideUp': {
          '0%': { transform: 'translateY(12px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
            {order.timeLabel}
          </Typography>
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 2,
              backgroundColor: typeConfig.bg,
              color: typeConfig.fg,
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {typeConfig.label}
          </Box>
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 2,
              backgroundColor: paymentConfig.bg,
              color: paymentConfig.fg,
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {paymentConfig.label}
          </Box>
        </Box>

        {isCompleted ? (
          <Box
            sx={{
              px: 1,
              py: 0.3,
              borderRadius: 2,
              backgroundColor: '#F3F4F6',
              color: '#6B7280',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            ✓ Done
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={() => onComplete(order)}
              sx={{
                minWidth: 32,
                height: 32,
                p: 0,
                borderRadius: 2,
                backgroundColor: '#1B6B3A',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                '&:hover': { backgroundColor: '#124D29' },
              }}
            >
              ✓
            </Button>
            <Button
              size="small"
              onClick={() => onDelete(order)}
              sx={{
                minWidth: 32,
                height: 32,
                p: 0,
                borderRadius: 2,
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                fontSize: '0.75rem',
                fontWeight: 700,
                '&:hover': { backgroundColor: '#FECACA' },
              }}
            >
              ✕
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 1 }}>
        {order.items.map((item, idx) => (
          <Typography key={idx} sx={{ fontSize: '0.8rem', color: '#4B5563', lineHeight: 1.5 }}>
            {item.quantity}x {item.itemName}
            {item.isHalf && ' (½)'}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#1B6B3A' }}>
          ₹{order.totalAmount}
        </Typography>
      </Box>
    </Box>
  );
}
