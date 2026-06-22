import { Box, Typography, IconButton, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { getMenuItem, calculateLineTotal, calculateOrderTotal } from '../utils/pricing';
import { formatQuantity } from '../utils/formatQuantity';
import { vibrate, haptics } from '../theme/tokens';

export default function SelectedItemsList() {
  const { draft, removeItem, incrementByPlate, decrementByPlate } = useOrderDraft();
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

  const step = (item: { isHalf: boolean; isCustom: boolean }) => {
    if (item.isHalf) return 3;
    if (item.isCustom) return 1;
    return 6;
  };

  const stepLabel = (item: { isHalf: boolean; isCustom: boolean }) => {
    if (item.isHalf) return '½';
    if (item.isCustom) return 'cst';
    return 'pcs';
  };

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
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const s = step(item);
            const sl = stepLabel(item);
            return (
              <motion.div
                key={item.menuItemId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: -20, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <Box
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 }, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.75rem', md: '0.85rem' },
                          color: 'text.primary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.isCustom && item.menuItem?.preparation || 'Steam'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375 }}>
                        {item.isHalf && !item.isCustom && (
                          <Box
                            component="span"
                            sx={{
                              fontSize: { xs: '0.55rem', md: '0.65rem' },
                              fontWeight: 700,
                              color: isDark ? '#FBBF24' : '#D97706',
                              backgroundColor: isDark ? '#3D2E1A' : '#FEF3C7',
                              px: { xs: 0.375, md: 0.5 },
                              py: 0.05,
                              borderRadius: { xs: 0.5, md: 0.75 },
                              lineHeight: 1.4,
                            }}
                          >
                            ½
                          </Box>
                        )}
                         {item.isCustom && (
                          <>
                            <Box
                              component="span"
                              sx={{
                                fontSize: { xs: '0.55rem', md: '0.65rem' },
                                fontWeight: 700,
                                color: isDark ? '#8CB4E8' : '#2563EB',
                                backgroundColor: isDark ? '#1A2E4A' : '#EFF6FF',
                                px: { xs: 0.375, md: 0.5 },
                                py: 0.05,
                                borderRadius: { xs: 0.5, md: 0.75 },
                                lineHeight: 1.4,
                              }}
                            >
                              {item.menuItem?.displayName || 'Unknown'}
                            </Box>
                            <Box
                              component="span"
                              sx={{
                                fontSize: { xs: '0.55rem', md: '0.65rem' },
                                fontWeight: 700,
                                color: isDark ? '#C4A8E8' : '#7C3AED',
                                backgroundColor: isDark ? '#2E1A4A' : '#EDE9FE',
                                px: { xs: 0.375, md: 0.5 },
                                py: 0.05,
                                borderRadius: { xs: 0.5, md: 0.75 },
                                lineHeight: 1.4,
                              }}
                            >
                              Cst
                            </Box>
                          </>
                        )}
                        <Typography
                          sx={{
                            fontSize: { xs: '0.6rem', md: '0.7rem' },
                            color: 'text.secondary',
                            fontWeight: 500,
                          }}
                        >
                          {formatQuantity(item.quantity)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.375, md: 0.5 }, flexShrink: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        borderRadius: { xs: 0.75, md: 1 },
                        border: `1px solid ${isDark ? '#3D3D44' : '#E5E7EB'}`,
                        overflow: 'hidden',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (item.quantity - s <= 0) {
                            vibrate(haptics.light);
                            removeItem(item.menuItemId);
                          } else {
                            vibrate(haptics.light);
                            decrementByPlate(item.menuItemId);
                          }
                        }}
                        sx={{
                          width: { xs: 26, md: 30 },
                          height: { xs: 26, md: 30 },
                          borderRadius: 0,
                          color: item.quantity - s <= 0 ? 'error.main' : 'text.secondary',
                          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                        }}
                      >
                        {item.quantity - s <= 0 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </IconButton>
                      <Box
                        sx={{
                          minWidth: { xs: 28, md: 34 },
                          height: { xs: 26, md: 30 },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderLeft: `1px solid ${isDark ? '#3D3D44' : '#E5E7EB'}`,
                          borderRight: `1px solid ${isDark ? '#3D3D44' : '#E5E7EB'}`,
                          px: 0.5,
                        }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={item.quantity}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}
                          >
                            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.8rem' }, color: 'text.primary', lineHeight: 1 }}>
                              {item.quantity}
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '0.45rem', md: '0.5rem' }, color: 'text.secondary', fontWeight: 600, lineHeight: 1 }}>
                              {sl}
                            </Typography>
                          </motion.div>
                        </AnimatePresence>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => {
                          vibrate(haptics.light);
                          incrementByPlate(item.menuItemId);
                        }}
                        sx={{
                          width: { xs: 26, md: 30 },
                          height: { xs: 26, md: 30 },
                          borderRadius: 0,
                          color: 'primary.main',
                          '&:hover': { backgroundColor: isDark ? 'rgba(27,107,58,0.12)' : 'rgba(27,107,58,0.06)' },
                        }}
                      >
                        <Plus size={12} />
                      </IconButton>
                    </Box>

                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.75rem', md: '0.85rem' },
                        color: 'primary.main',
                        minWidth: { xs: 36, md: 44 },
                        textAlign: 'right',
                      }}
                    >
                      ₹{item.lineTotal}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Box>
      <Box
        sx={{
          mt: { xs: 0.75, md: 1 },
          pt: { xs: 0.75, md: 1 },
          borderTop: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 0.75, md: 1 },
        }}
      >
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
