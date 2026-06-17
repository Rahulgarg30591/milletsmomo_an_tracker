import { Box, Typography, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, Slice } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { vibrate, haptics } from '../theme/tokens';

interface MenuItem {
  id: number;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
  preparation: string;
  filling: string;
}

const FILLING_COLORS: Record<string, { bg: string; border: string; activeBg: string; activeBorder: string; text: string; btnBg: string; btnHover: string }> = {
  'Veg': { bg: '#F0FDF4', border: '#86EFAC', activeBg: '#DCFCE7', activeBorder: '#22C55E', text: '#15803D', btnBg: '#22C55E', btnHover: '#16A34A' },
  'Paneer': { bg: '#FFF7ED', border: '#FDBA74', activeBg: '#FFEDD5', activeBorder: '#F97316', text: '#C2410C', btnBg: '#F97316', btnHover: '#EA580C' },
  'Cheese Corn': { bg: '#FEFCE8', border: '#FDE047', activeBg: '#FEF9C3', activeBorder: '#EAB308', text: '#A16207', btnBg: '#EAB308', btnHover: '#CA8A04' },
  'Platter': { bg: '#F3E8FF', border: '#C4B5FD', activeBg: '#EDE9FE', activeBorder: '#8B5CF6', text: '#6B21A8', btnBg: '#8B5CF6', btnHover: '#7C3AED' },
};

interface MenuGridProps {
  items: MenuItem[];
  categoryIndex?: number;
}

export default function MenuGrid({ items, categoryIndex = 0 }: MenuGridProps) {
  const { addItem, incrementItem, decrementItem, toggleHalf, removeItem, draft } = useOrderDraft();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 1,
      }}
    >
      {items.map((item, idx) => {
        const draftItem = draft.items.get(item.id);
        const quantity = draftItem?.quantity || 0;
        const isHalf = draftItem?.isHalf || false;
        const isActive = quantity > 0;
        const colors = FILLING_COLORS[item.filling] || FILLING_COLORS['Veg'];

        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: (categoryIndex * 0.05) + (idx * 0.02),
              type: 'spring',
              stiffness: 400,
              damping: 30
            }}
            style={{ display: 'flex' }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                p: 1,
                borderRadius: 1.5,
                backgroundColor: isActive ? colors.activeBg : colors.bg,
                border: 1.5,
                borderColor: isActive ? colors.activeBorder : colors.border,
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                minHeight: isActive ? 112 : 72,
                '&:hover': {
                  borderColor: isActive ? colors.activeBorder : colors.border,
                  boxShadow: isActive ? `0 2px 8px ${colors.activeBorder}20` : (theme) => theme.shadows[1],
                },
              }}
            >
              {/* Header: centered name + price */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: isActive ? colors.text : 'text.primary',
                    lineHeight: 1.2,
                    textAlign: 'center',
                  }}
                >
                  {item.filling}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: isActive ? colors.text : 'text.secondary',
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
                        borderRadius: 1,
                        py: 0.4,
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        backgroundColor: colors.btnBg,
                        color: '#FFFFFF',
                        boxShadow: 'none',
                        '&:hover': { backgroundColor: colors.btnHover },
                        '&:active': { transform: 'scale(0.97)' },
                      }}
                    >
                      <Plus size={12} style={{ marginRight: 3 }} />
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
                      gap: 6,
                      marginTop: 'auto',
                    }}
                  >
                    {/* Quantity row */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.75,
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          decrementItem(item.id);
                          vibrate(haptics.light);
                        }}
                        sx={{
                          minWidth: 26,
                          width: 26,
                          height: 26,
                          p: 0,
                          borderRadius: '50%',
                          border: 1.5,
                          borderColor: colors.activeBorder,
                          color: colors.text,
                          backgroundColor: '#FFFFFF',
                          '&:hover': { backgroundColor: colors.activeBg },
                          '&:active': { transform: 'scale(0.92)' },
                        }}
                      >
                        <Minus size={12} />
                      </Button>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 26,
                          height: 26,
                          borderRadius: 1,
                          backgroundColor: colors.activeBg,
                          border: 1.5,
                          borderColor: colors.activeBorder,
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: colors.text,
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
                          minWidth: 26,
                          width: 26,
                          height: 26,
                          p: 0,
                          borderRadius: '50%',
                          border: 1.5,
                          borderColor: colors.activeBorder,
                          color: colors.text,
                          backgroundColor: '#FFFFFF',
                          '&:hover': { backgroundColor: colors.activeBg },
                          '&:active': { transform: 'scale(0.92)' },
                        }}
                      >
                        <Plus size={12} />
                      </Button>

                      <Button
                        size="small"
                        onClick={() => {
                          removeItem(item.id);
                          vibrate(haptics.light);
                        }}
                        sx={{
                          minWidth: 24,
                          width: 24,
                          height: 24,
                          p: 0,
                          borderRadius: '50%',
                          color: '#EF4444',
                          '&:hover': { backgroundColor: '#FEE2E2' },
                        }}
                      >
                        <X size={12} />
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
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: !isHalf ? colors.btnBg : '#FFFFFF',
                            color: !isHalf ? '#FFFFFF' : '#6B7280',
                            border: 1.5,
                            borderColor: colors.btnBg,
                            '&:hover': {
                              backgroundColor: !isHalf ? colors.btnHover : colors.activeBg,
                            },
                            lineHeight: 1.4,
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
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: isHalf ? colors.btnBg : '#FFFFFF',
                            color: isHalf ? '#FFFFFF' : '#6B7280',
                            border: 1.5,
                            borderColor: colors.btnBg,
                            '&:hover': {
                              backgroundColor: isHalf ? colors.btnHover : colors.activeBg,
                            },
                            lineHeight: 1.4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                          }}
                        >
                          <Slice size={9} />
                          ½
                        </Button>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          color: colors.text,
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
