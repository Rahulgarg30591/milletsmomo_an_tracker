import { Box, Button, Chip, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, Slice } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { getMenuItem, calculateLineTotal } from '../utils/pricing';
import { vibrate, haptics } from '../theme/tokens';

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
      <Box
        sx={{
          py: 6,
          textAlign: 'center',
          borderRadius: 4,
          backgroundColor: 'background.paper',
          border: '1px dashed',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem', fontWeight: 500 }}>
          No items added yet
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5 }}>
          Tap the menu grid to add items
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
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
        Selected Items
      </Typography>
      <AnimatePresence>
        {items.map((item) => {
          const { lineTotal } = calculateLineTotal(item.menuItemId, item.quantity, item.isHalf);
          return (
            <motion.div
              key={item.menuItemId}
              initial={{ opacity: 0, x: -12, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'text.primary' }}>
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
                          backgroundColor: 'secondary.light',
                          color: 'secondary.main',
                        }}
                        icon={<Slice size={10} />}
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => {
                      vibrate(haptics.light);
                      decrementItem(item.menuItemId);
                    }}
                    sx={{
                      minWidth: 28,
                      width: 28,
                      height: 28,
                      p: 0,
                      borderRadius: '50%',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <Minus size={14} />
                  </Button>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 24, textAlign: 'center', color: 'text.primary' }}>
                    {item.quantity}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      vibrate(haptics.light);
                      incrementItem(item.menuItemId);
                    }}
                    sx={{
                      minWidth: 28,
                      width: 28,
                      height: 28,
                      p: 0,
                      borderRadius: '50%',
                      border: 1,
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <Plus size={14} />
                  </Button>

                  <Chip
                    size="small"
                    onClick={() => {
                      vibrate(haptics.light);
                      toggleHalf(item.menuItemId);
                    }}
                    label={item.isHalf ? 'Half' : 'Full'}
                    sx={{
                      height: 24,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: item.isHalf ? 'secondary.light' : 'action.hover',
                      color: item.isHalf ? 'secondary.main' : 'text.secondary',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: item.isHalf ? 'secondary.light' : 'action.selected',
                      },
                    }}
                  />

                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 48, textAlign: 'right', color: 'primary.main' }}>
                    ₹{lineTotal}
                  </Typography>

                  <Button
                    size="small"
                    onClick={() => {
                      vibrate(haptics.light);
                      removeItem(item.menuItemId);
                    }}
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
                    <X size={14} />
                  </Button>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}