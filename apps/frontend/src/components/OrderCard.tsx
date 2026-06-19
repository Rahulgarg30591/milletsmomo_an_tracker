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
  dine: <Utensils size={10} />,
  pack: <Package size={10} />,
};

const paymentIcons = {
  cash: <Banknote size={10} />,
  upi: <Smartphone size={10} />,
  pending: <Clock size={10} />,
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
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ marginBottom: 8 }}
    >
      <Box
        sx={{
          p: { xs: 1.25, md: 1.5 },
          borderRadius: { xs: 1, md: 1.25 },
          backgroundColor: 'background.paper',
          boxShadow: (theme) => theme.shadows[1],
          borderLeft: 2,
          borderLeftColor: isCompleted ? 'grey.400' : 'primary.main',
          opacity: isCompleted ? 0.75 : 1,
          transition: 'box-shadow 0.2s ease, opacity 0.2s ease',
          '&:hover': {
            boxShadow: (theme) => theme.shadows[2],
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, md: 1 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 }, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '0.95rem' }, color: 'text.primary' }}>
              {order.timeLabel}
            </Typography>
            <Box
              sx={{
                px: { xs: 0.5, md: 0.75 },
                py: 0.2,
                borderRadius: 1,
                backgroundColor: typeConfig.bg,
                color: typeConfig.fg,
                fontSize: { xs: '0.6rem', md: '0.7rem' },
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                textTransform: 'capitalize',
                lineHeight: 1.2,
              }}
            >
              {typeIcons[order.orderType]}
              {order.orderType === 'dine' ? 'Dine' : 'Pack'}
            </Box>
            <Box
              sx={{
                px: { xs: 0.5, md: 0.75 },
                py: 0.2,
                borderRadius: 1,
                backgroundColor: paymentConfig.bg,
                color: paymentConfig.fg,
                fontSize: { xs: '0.6rem', md: '0.7rem' },
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                textTransform: 'capitalize',
                lineHeight: 1.2,
              }}
            >
              {paymentIcons[order.paymentMethod]}
              {order.paymentMethod}
            </Box>
          </Box>

          {isCompleted ? (
            <Box
              sx={{
                px: { xs: 0.5, md: 0.75 },
                py: 0.2,
                borderRadius: 1,
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                color: 'text.secondary',
                fontSize: { xs: '0.6rem', md: '0.7rem' },
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                lineHeight: 1.2,
              }}
            >
              <CircleCheck size={10} />
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
                  minWidth: { xs: 28, md: 32 },
                  height: { xs: 28, md: 32 },
                  p: 0,
                  borderRadius: 1,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Check size={14} />
              </Button>

            </Box>
          )}
        </Box>

        <Box sx={{ mb: { xs: 0.75, md: 1 } }}>
          {order.items.map((item, idx) => (
            <Typography key={idx} sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.secondary', lineHeight: { xs: 1.4, md: 1.5 }, fontWeight: 500 }}>
              {item.quantity}x {item.itemName}
              {item.isHalf && (
                <Box component="span" sx={{ color: 'secondary.main', fontWeight: 700, ml: 0.5, fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                  (½)
                </Box>
              )}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.95rem', md: '1.1rem' }, color: 'primary.main', letterSpacing: '-0.2px' }}>
            ₹{order.totalAmount}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}
