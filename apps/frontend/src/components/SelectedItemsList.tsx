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
      const { lineTotal } = calculateLineTotal(menuItemId, item.quantity, item.isHalf);
      return { menuItemId, ...item, menuItem, lineTotal };
    });

  const total = calculateOrderTotal(items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, isHalf: i.isHalf })));

  if (items.length === 0) return null;

  return (
    <Box sx={{ mb: 2, mt: 3 }}>
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
        Order Summary ({items.length} item{items.length > 1 ? 's' : ''})
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
        }}
      >
        {items.map((item) => (
          <Box
            key={item.menuItemId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              px: 1.5,
              borderRadius: 2,
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
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
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                ×{item.quantity}
              </Typography>
              {item.isHalf && (
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
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'primary.main',
                }}
              >
                ₹{item.lineTotal}
              </Typography>
              <Button
                size="small"
                onClick={() => removeItem(item.menuItemId)}
                sx={{
                  minWidth: 24,
                  width: 24,
                  height: 24,
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
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
          Total
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'primary.main' }}>
          ₹{total}
        </Typography>
      </Box>
    </Box>
  );
}
