import { Box, Typography, Button, Divider, useTheme } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';
import { getMenuItem, calculateLineTotal, calculateOrderTotal } from '../utils/pricing';
import { X } from 'lucide-react';

export default function SelectedItemsList() {
  const { draft, removeItem } = useOrderDraft();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
    <Box sx={{ mb: { xs: 0.5, md: 1 }, mt: { xs: 1.25, md: 2 } }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: 'text.secondary',
          mb: { xs: 0.375, md: 0.5 },
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: { xs: '0.6rem', md: '0.7rem' },
        }}
      >
        Summary ({items.length} item{items.length > 1 ? 's' : ''})
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 0.375, md: 0.5 },
        }}
      >
        {items.map((item) => (
          <Box
            key={item.menuItemId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: { xs: 0.5, md: 0.75 },
              px: { xs: 0.75, md: 1 },
              borderRadius: { xs: 0.75, md: 1 },
              backgroundColor: 'background.paper',
              border: { xs: 1, md: 1.5 },
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
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
                  fontSize: { xs: '0.65rem', md: '0.75rem' },
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
                    fontSize: { xs: '0.6rem', md: '0.7rem' },
                    fontWeight: 700,
                    color: isDark ? '#FBBF24' : '#D97706',
                    backgroundColor: isDark ? '#3D2E1A' : '#FEF3C7',
                    px: { xs: 0.5, md: 0.75 },
                    py: { xs: 0.125, md: 0.25 },
                    borderRadius: { xs: 0.75, md: 1 },
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  ½
                </Typography>
              )}
              {item.isCustom && (
                <Typography
                  sx={{
                    fontSize: { xs: '0.6rem', md: '0.7rem' },
                    fontWeight: 700,
                    color: isDark ? '#C4A8E8' : '#7C3AED',
                    backgroundColor: isDark ? '#2E1A4A' : '#EDE9FE',
                    px: { xs: 0.5, md: 0.75 },
                    py: { xs: 0.125, md: 0.25 },
                    borderRadius: { xs: 0.75, md: 1 },
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  Cst
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, flexShrink: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '0.75rem', md: '0.85rem' },
                  color: 'primary.main',
                }}
              >
                ₹{item.lineTotal}
              </Typography>
              <Button
                size="small"
                onClick={() => removeItem(item.menuItemId)}
                sx={{
                  minWidth: { xs: 18, md: 22 },
                  width: { xs: 18, md: 22 },
                  height: { xs: 18, md: 22 },
                  p: 0,
                  borderRadius: '50%',
                  color: 'error.main',
                  '&:hover': { backgroundColor: 'error.light' },
                }}
              >
                <X size={10} />
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
      <Divider sx={{ my: { xs: 0.75, md: 1 } }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 0.75, md: 1 } }}>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.primary' }}>
          Total
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.95rem', md: '1.1rem' }, color: 'primary.main' }}>
          ₹{total}
        </Typography>
      </Box>
    </Box>
  );
}
