import { Box, Typography, Button, Divider } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';
import { getMenuItem, calculateLineTotal, calculateOrderTotal } from '../utils/pricing';
import { X } from 'lucide-react';

export default function SelectedItemsList() {
  const { draft, removeItem } = useOrderDraft();

  const items = Array.from(draft.items.entries())
    .filter(([, item]) => item.quantity > 0)
    .map(([menuItemId, item]) => {
      const menuItem = getMenuItem(menuItemId);
      const { lineTotal } = calculateLineTotal(menuItemId, item.quantity, item.isHalf, item.isCustom);
      return { menuItemId, ...item, menuItem, lineTotal };
    });

  const total = calculateOrderTotal(items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, isHalf: i.isHalf, isCustom: i.isCustom })));

  if (items.length === 0) return null;

  return (
    <Box sx={{ mb: 1, mt: 2 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: 'text.secondary',
          mb: 0.5,
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.7rem',
        }}
      >
        Order Summary ({items.length} item{items.length > 1 ? 's' : ''})
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {items.map((item) => (
          <Box
            key={item.menuItemId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 0.75,
              px: 1,
              borderRadius: 1,
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.menuItem?.displayName || 'Unknown'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                ×{item.quantity}
              </Typography>
              {item.isHalf && !item.isCustom && (
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#D97706',
                    backgroundColor: '#FEF3C7',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                >
                  ½
                </Typography>
              )}
              {item.isCustom && (
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#7C3AED',
                    backgroundColor: '#EDE9FE',
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                >
                  Custom
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: 'primary.main',
                }}
              >
                ₹{item.lineTotal}
              </Typography>
              <Button
                size="small"
                onClick={() => removeItem(item.menuItemId)}
                sx={{
                  minWidth: 22,
                  width: 22,
                  height: 22,
                  p: 0,
                  borderRadius: '50%',
                  color: 'error.main',
                  '&:hover': { backgroundColor: 'error.light' },
                }}
              >
                <X size={12} />
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
          Total
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'primary.main' }}>
          ₹{total}
        </Typography>
      </Box>
    </Box>
  );
}
