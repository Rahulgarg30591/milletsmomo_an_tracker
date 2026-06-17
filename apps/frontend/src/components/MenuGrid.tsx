import { Box, Typography, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, Slice } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { vibrate, haptics } from '../theme/tokens';

interface MenuGridProps {
  menuItems: { id: number; displayName: string; fullPrice: number; halfPrice: number }[];
}

export default function MenuGrid({ menuItems }: MenuGridProps) {
  const { addItem, incrementItem, decrementItem, toggleHalf, removeItem, draft } = useOrderDraft();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 1.5,
        mb: 2,
      }}
    >
      {menuItems.map((item, idx) => {
        const draftItem = draft.items.get(item.id);
        const quantity = draftItem?.quantity || 0;
        const isHalf = draftItem?.isHalf || false;
        const isActive = quantity > 0;

        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02, type: 'spring', stiffness: 400, damping: 30 }}
            style={{ display: 'flex' }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                p: 1.5,
                borderRadius: 3,
                backgroundColor: isActive ? '#FFF8E1' : 'background.paper',
                border: 2,
                borderColor: isActive ? '#F59E0B' : 'divider',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minHeight: isActive ? 140 : 90,
                '&:hover': {
                  borderColor: isActive ? '#F59E0B' : 'primary.light',
                  boxShadow: isActive ? '0 4px 16px rgba(245,158,11,0.12)' : (theme) => theme.shadows[1],
                },
              }}
            >
              {/* Header row: name + price */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: isActive ? '#92400E' : 'text.primary',
                    lineHeight: 1.2,
                    flex: 1,
                  }}
                >
                  {item.displayName}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isActive ? '#B45309' : 'text.secondary',
                    flexShrink: 0,
                  }}
                >
                  ₹{isHalf ? item.halfPrice : item.fullPrice}
                </Typography>
              </Box>

              {/* Body */}
              <AnimatePresence mode="wait">
                {!isActive ? (
                  <motion.div
                    key="add"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{ marginTop: 'auto' }}
                  >
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={() => {
                        addItem(item.id);
                        vibrate(haptics.light);
                      }}
                      sx={{
                        borderRadius: 2,
                        py: 0.6,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        textTransform: 'none',
                        backgroundColor: '#F59E0B',
                        color: '#FFFFFF',
                        boxShadow: 'none',
                        '&:hover': { backgroundColor: '#D97706' },
                        '&:active': { transform: 'scale(0.97)' },
                      }}
                    >
                      <Plus size={14} style={{ marginRight: 4 }} />
                      Add
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="controls"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 'auto',
                    }}
                  >
                    {/* Quantity row */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          decrementItem(item.id);
                          vibrate(haptics.light);
                        }}
                        sx={{
                          minWidth: 32,
                          width: 32,
                          height: 32,
                          p: 0,
                          borderRadius: '50%',
                          border: 1.5,
                          borderColor: '#F59E0B',
                          color: '#B45309',
                          backgroundColor: '#FFFFFF',
                          '&:hover': { backgroundColor: '#FEF3C7' },
                          '&:active': { transform: 'scale(0.92)' },
                        }}
                      >
                        <Minus size={14} />
                      </Button>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 32,
                          height: 32,
                          borderRadius: 1.5,
                          backgroundColor: '#FEF3C7',
                          border: 1.5,
                          borderColor: '#F59E0B',
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '1rem',
                            color: '#92400E',
                            lineHeight: 1,
                          }}
                        >
                          {quantity}
                        </Typography>
                      </Box>

                      <Button
                        size="small"
                        onClick={() => {
                          incrementItem(item.id);
                          vibrate(haptics.light);
                        }}
                        sx={{
                          minWidth: 32,
                          width: 32,
                          height: 32,
                          p: 0,
                          borderRadius: '50%',
                          border: 1.5,
                          borderColor: '#F59E0B',
                          color: '#B45309',
                          backgroundColor: '#FFFFFF',
                          '&:hover': { backgroundColor: '#FEF3C7' },
                          '&:active': { transform: 'scale(0.92)' },
                        }}
                      >
                        <Plus size={14} />
                      </Button>

                      <Button
                        size="small"
                        onClick={() => {
                          removeItem(item.id);
                          vibrate(haptics.light);
                        }}
                        sx={{
                          minWidth: 28,
                          width: 28,
                          height: 28,
                          p: 0,
                          borderRadius: '50%',
                          color: '#EF4444',
                          '&:hover': { backgroundColor: '#FEE2E2' },
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </Box>

                    {/* Half/Full toggle + line total */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button
                          size="small"
                          onClick={() => {
                            if (isHalf) toggleHalf(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: 0,
                            px: 1,
                            py: 0.3,
                            borderRadius: 1.5,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: !isHalf ? '#F59E0B' : '#FFFFFF',
                            color: !isHalf ? '#FFFFFF' : '#6B7280',
                            border: 1.5,
                            borderColor: '#F59E0B',
                            '&:hover': {
                              backgroundColor: !isHalf ? '#D97706' : '#FEF3C7',
                            },
                            lineHeight: 1.5,
                          }}
                        >
                          Full
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            if (!isHalf) toggleHalf(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: 0,
                            px: 1,
                            py: 0.3,
                            borderRadius: 1.5,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: isHalf ? '#F59E0B' : '#FFFFFF',
                            color: isHalf ? '#FFFFFF' : '#6B7280',
                            border: 1.5,
                            borderColor: '#F59E0B',
                            '&:hover': {
                              backgroundColor: isHalf ? '#D97706' : '#FEF3C7',
                            },
                            lineHeight: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                          }}
                        >
                          <Slice size={10} />
                          ½
                        </Button>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          color: '#92400E',
                        }}
                      >
                        ₹{quantity * (isHalf ? item.halfPrice : item.fullPrice)}
                      </Typography>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}
