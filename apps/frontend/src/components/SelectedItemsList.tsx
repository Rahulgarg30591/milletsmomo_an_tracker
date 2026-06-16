import { Box, Button, Chip, Typography } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';
import { getMenuItem, calculateLineTotal } from '../utils/pricing';

export default function SelectedItemsList() {
  const { draft, removeItem, incrementItem, decrementItem, toggleHalf } = useOrderDraft();

  const items = Array.from(draft.items.entries())
    .filter(([, item]) => item.quantity > 0)
    .map(([menuItemId, item]) => {
      const menuItem = getMenuItem(menuItemId);
      return { menuItemId, ...item, menuItem };
    });

  if (items.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem' }}>
        No items added yet
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: 1 }}>
        Selected Items
      </Box>
      {items.map((item) => {
        const { lineTotal } = calculateLineTotal(item.menuItemId, item.quantity, item.isHalf);
        return (
          <Box
            key={item.menuItemId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1,
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
                  {item.menuItem?.displayName || 'Unknown'}
                </Typography>
                {item.isHalf && (
                  <Chip
                    size="small"
                    label="½"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: '#FEF3C7',
                      color: '#D97706',
                    }}
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                onClick={() => decrementItem(item.menuItemId)}
                sx={{
                  minWidth: 28,
                  width: 28,
                  height: 28,
                  p: 0,
                  borderRadius: '50%',
                  fontSize: '1rem',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                }}
              >
                −
              </Button>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 24, textAlign: 'center' }}>
                {item.quantity}
              </Typography>
              <Button
                size="small"
                onClick={() => incrementItem(item.menuItemId)}
                sx={{
                  minWidth: 28,
                  width: 28,
                  height: 28,
                  p: 0,
                  borderRadius: '50%',
                  fontSize: '1rem',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                }}
              >
                +
              </Button>

              <Chip
                size="small"
                onClick={() => toggleHalf(item.menuItemId)}
                label={item.isHalf ? 'Half' : 'Full'}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: item.isHalf ? '#FEF3C7' : '#E5E7EB',
                  color: item.isHalf ? '#D97706' : '#6B7280',
                  cursor: 'pointer',
                }}
              />

              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 48, textAlign: 'right', color: '#1B6B3A' }}>
                ₹{lineTotal}
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
                  color: '#DC2626',
                  fontSize: '0.8rem',
                }}
              >
                ✕
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
