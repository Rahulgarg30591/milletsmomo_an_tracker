import { Box, Button, Typography, useTheme } from '@mui/material';
import { Check, Utensils, Package, Banknote, Smartphone, Clock, CircleCheck, Split, Pencil } from 'lucide-react';
import { memo } from 'react';
import type { Order } from '../types';
import { statusColors, darkStatusColors, vibrate, haptics } from '../theme/tokens';
import { formatQuantity } from '../utils/formatQuantity';

interface OrderCardProps {
  order: Order;
  onComplete: (order: Order) => void;
  onEdit?: (order: Order) => void;
}

const typeIcons = {
  dine: <Utensils size={10} />,
  pack: <Package size={10} />,
};

const paymentIcons = {
  cash: <Banknote size={10} />,
  upi: <Smartphone size={10} />,
  split: <Split size={10} />,
  pending: <Clock size={10} />,
};

function OrderCardBase({ order, onComplete, onEdit }: OrderCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? darkStatusColors : statusColors;
  const typeConfig = colors[order.orderType === 'dine' ? 'dineIn' : 'pack'];
  const getPaymentConfig = () => {
    if (order.paymentMethod === 'pending') return colors.pending;
    if (order.paymentMethod === 'cash') return colors.cash;
    if (order.paymentMethod === 'upi') return colors.upi;
    return colors.split || colors.cash;
  };
  const paymentConfig = getPaymentConfig();
  const isCompleted = order.isCompleted;

  return (
    <Box
      data-order-id={order.id}
      sx={{
        mb: 1,
        p: { xs: 1.25, md: 1.5 },
        borderRadius: { xs: 1, md: 1.25 },
        backgroundColor: 'background.paper',
        boxShadow: (theme) => theme.shadows[1],
        borderLeft: 2,
        borderLeftColor: isCompleted ? 'grey.400' : 'primary.main',
        opacity: isCompleted ? 0.75 : 1,
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
              {order.paymentMethod === 'split' ? 'Split' : order.paymentMethod}
            </Box>
            {order.paymentMethod === 'split' && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box sx={{ px: 0.5, py: 0.2, borderRadius: 1, backgroundColor: isDark ? '#1A3D2A' : '#D1FAE5', color: isDark ? '#8CE8B4' : '#065F46', fontSize: { xs: '0.6rem', md: '0.7rem' }, fontWeight: 700, lineHeight: 1.2 }}>
                  ₹{order.cashAmount} cash
                </Box>
                <Box sx={{ px: 0.5, py: 0.2, borderRadius: 1, backgroundColor: isDark ? '#2E1A4A' : '#EDE9FE', color: isDark ? '#C4A8E8' : '#5B21B6', fontSize: { xs: '0.6rem', md: '0.7rem' }, fontWeight: 700, lineHeight: 1.2 }}>
                  ₹{order.upiAmount} upi
                </Box>
              </Box>
            )}
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
              {onEdit && (
                <Button
                  size="small"
                  onClick={() => {
                    vibrate(haptics.light);
                    onEdit(order);
                  }}
                  aria-label="Edit order"
                  sx={{
                    minWidth: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                    p: 0,
                    borderRadius: 1,
                    backgroundColor: 'transparent',
                    color: 'text.secondary',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: 'primary.main',
                      borderColor: 'primary.main',
                    },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <Pencil size={14} />
                </Button>
              )}
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
              {formatQuantity(item.quantity)} {item.itemName}
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
  );
}

const OrderCard = memo(OrderCardBase);
export default OrderCard;
