import { Box, Button, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { Check, Utensils, Package, Banknote, Smartphone, Clock, CircleCheck } from 'lucide-react';
import type { Order } from '../types';
import { statusColors, darkStatusColors, vibrate, haptics } from '../theme/tokens';

interface OrderCardProps {
  order: Order;
  onComplete: (order: Order) => void;
}

const typeIcons = {
  dine: <Utensils size={12} />,
  pack: <Package size={12} />,
};

const paymentIcons = {
  cash: <Banknote size={12} />,
  upi: <Smartphone size={12} />,
  pending: <Clock size={12} />,
};

export default function OrderCard({ order, onComplete }: OrderCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? darkStatusColors : statusColors;
  const typeConfig = colors[order.orderType === 'dine' ? 'dineIn' : 'pack'];
  const paymentConfig = colors[order.paymentMethod === 'pending' ? 'pending' : order.paymentMethod === 'cash' ? 'cash' : 'upi'];
  const isCompleted = order.isCompleted;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ marginBottom: 12 }}
    >
      <Box
        sx={{
          p: 2.5,
          borderRadius: 4,
          backgroundColor: 'background.paper',
          boxShadow: (theme) => theme.shadows[1],
          borderLeft: isCompleted ? 3 : 3,
          borderLeftColor: isCompleted ? 'grey.400' : 'primary.main',
          opacity: isCompleted ? 0.8 : 1,
          transition: 'box-shadow 0.2s ease, opacity 0.2s ease',
          '&:hover': {
            boxShadow: (theme) => theme.shadows[3],
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>
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
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textTransform: 'capitalize',
              }}
            >
              {typeIcons[order.orderType]}
              {order.orderType === 'dine' ? 'Dine' : 'Pack'}
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
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textTransform: 'capitalize',
              }}
            >
              {paymentIcons[order.paymentMethod]}
              {order.paymentMethod}
            </Box>
          </Box>

          {isCompleted ? (
            <Box
              sx={{
                px: 1,
                py: 0.3,
                borderRadius: 2,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <CircleCheck size={12} />
              Done
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                size="small"
                onClick={() => {
                  vibrate(haptics.medium);
                  onComplete(order);
                }}
                aria-label="Complete order"
                sx={{
                  minWidth: 36,
                  height: 36,
                  p: 0,
                  borderRadius: 2,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Check size={18} />
              </Button>

            </Box>
          )}
        </Box>

        <Box sx={{ mb: 1.5 }}>
          {order.items.map((item, idx) => (
            <Typography key={idx} sx={{ fontSize: '0.95rem', color: 'text.secondary', lineHeight: 1.6, fontWeight: 500 }}>
              {item.quantity}x {item.itemName}
              {item.isHalf && (
                <Box component="span" sx={{ color: 'secondary.main', fontWeight: 700, ml: 0.5 }}>
                  (½ plate)
                </Box>
              )}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'primary.main', letterSpacing: '-0.2px' }}>
            ₹{order.totalAmount}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}