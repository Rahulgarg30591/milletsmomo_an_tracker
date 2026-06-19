import { Box, Typography, Button, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, X, Slice } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { calculateLineTotal } from '../utils/pricing';
import { vibrate, haptics } from '../theme/tokens';

interface MenuItem {
  id: number;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
  preparation: string;
  filling: string;
}

const FILLING_COLORS_LIGHT: Record<string, { bg: string; border: string; activeBg: string; activeBorder: string; text: string; btnBg: string; btnHover: string }> = {
  'Veg': { bg: '#F0FDF4', border: '#86EFAC', activeBg: '#DCFCE7', activeBorder: '#22C55E', text: '#15803D', btnBg: '#22C55E', btnHover: '#16A34A' },
  'Paneer': { bg: '#FFF7ED', border: '#FDBA74', activeBg: '#FFEDD5', activeBorder: '#F97316', text: '#C2410C', btnBg: '#F97316', btnHover: '#EA580C' },
  'Cheese Corn': { bg: '#FEFCE8', border: '#FDE047', activeBg: '#FEF9C3', activeBorder: '#EAB308', text: '#A16207', btnBg: '#EAB308', btnHover: '#CA8A04' },
  'Platter': { bg: '#F3E8FF', border: '#C4B5FD', activeBg: '#EDE9FE', activeBorder: '#8B5CF6', text: '#6B21A8', btnBg: '#8B5CF6', btnHover: '#7C3AED' },
};

const FILLING_COLORS_DARK: Record<string, { bg: string; border: string; activeBg: string; activeBorder: string; text: string; btnBg: string; btnHover: string }> = {
  'Veg': { bg: '#1A2E20', border: '#2D8A4E', activeBg: '#1E3D28', activeBorder: '#4ADE80', text: '#4ADE80', btnBg: '#2D8A4E', btnHover: '#1B6B3A' },
  'Paneer': { bg: '#3D2E1A', border: '#D97706', activeBg: '#4A351E', activeBorder: '#FBBF24', text: '#FBBF24', btnBg: '#D97706', btnHover: '#B45309' },
  'Cheese Corn': { bg: '#3D351A', border: '#EAB308', activeBg: '#4A3D1E', activeBorder: '#FCD34D', text: '#FCD34D', btnBg: '#EAB308', btnHover: '#CA8A04' },
  'Platter': { bg: '#2E1A4A', border: '#7C3AED', activeBg: '#3D1E5A', activeBorder: '#C4A8E8', text: '#C4A8E8', btnBg: '#7C3AED', btnHover: '#6B21A8' },
};

interface MenuGridProps {
  items: MenuItem[];
  categoryIndex?: number;
}

export default function MenuGrid({ items, categoryIndex = 0 }: MenuGridProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { addItem, incrementItem, decrementItem, removeItem, setFull, setHalf, setCustom, draft } = useOrderDraft();
  const FILLING_COLORS = isDark ? FILLING_COLORS_DARK : FILLING_COLORS_LIGHT;
  const inactiveBtnBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const inactiveBtnColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 0.5, md: 0.75 },
      }}
    >
      {items.map((item, idx) => {
        const draftItem = draft.items.get(item.id);
        const quantity = draftItem?.quantity || 0;
        const isHalf = draftItem?.isHalf || false;
        const isCustom = draftItem?.isCustom || false;
        const isActive = quantity > 0;
        const colors = FILLING_COLORS[item.filling] || FILLING_COLORS['Veg'];
        const { lineTotal } = isActive ? calculateLineTotal(item.id, quantity, isHalf, isCustom) : { lineTotal: 0 };

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
                p: { xs: 0.5, md: 0.75 },
                borderRadius: { xs: 0.75, md: 1 },
                backgroundColor: isActive ? colors.activeBg : colors.bg,
                border: { xs: 1, md: 1.5 },
                borderColor: isActive ? colors.activeBorder : colors.border,
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 0.125, md: 0.25 },
                minHeight: { xs: isActive ? (isCustom ? 90 : 68) : 52, md: isActive ? (isCustom ? 112 : 88) : 72 },
                '&:hover': {
                  borderColor: isActive ? colors.activeBorder : colors.border,
                },
              }}
            >
              {/* Header: centered name + price */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 0.125, md: 0.25 } }}>
                <Typography
                  sx={{
                    fontSize: { xs: '0.75rem', md: '0.85rem' },
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
                    fontSize: { xs: '0.6rem', md: '0.7rem' },
                    fontWeight: 600,
                    color: isActive ? colors.text : 'text.secondary',
                  }}
                >
                  ₹{item.fullPrice} / ₹{item.halfPrice}
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
                        borderRadius: { xs: 0.75, md: 1 },
                        py: { xs: 0.25, md: 0.4 },
                        fontWeight: 700,
                        fontSize: { xs: '0.65rem', md: '0.75rem' },
                        textTransform: 'none',
                        backgroundColor: colors.btnBg,
                        color: '#FFFFFF',
                        boxShadow: 'none',
                        minHeight: 0,
                        lineHeight: 1.2,
                        '&:hover': { backgroundColor: colors.btnHover },
                        '&:active': { transform: 'scale(0.97)' },
                      }}
                    >
                      <Plus size={11} style={{ marginRight: 2 }} />
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
                      gap: 2,
                      marginTop: 'auto',
                    }}
                  >
                    {/* Full / Half / Custom toggle + line total + remove */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: { xs: 0.25, md: 0.5 },
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: { xs: 0.25, md: 0.5 } }}>
                        <Button
                          size="small"
                          onClick={() => {
                            setFull(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: 0,
                            px: { xs: 0.5, md: 0.75 },
                            py: { xs: 0.125, md: 0.25 },
                            borderRadius: { xs: 0.75, md: 1 },
                            fontSize: { xs: '0.55rem', md: '0.65rem' },
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: !isHalf && !isCustom ? colors.btnBg : inactiveBtnBg,
                            color: !isHalf && !isCustom ? '#FFFFFF' : inactiveBtnColor,
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.btnBg,
                            '&:hover': {
                              backgroundColor: !isHalf && !isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                            },
                            lineHeight: 1.3,
                          }}
                        >
                          Full
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setHalf(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: 0,
                            px: { xs: 0.5, md: 0.75 },
                            py: { xs: 0.125, md: 0.25 },
                            borderRadius: { xs: 0.75, md: 1 },
                            fontSize: { xs: '0.55rem', md: '0.65rem' },
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: isHalf && !isCustom ? colors.btnBg : inactiveBtnBg,
                            color: isHalf && !isCustom ? '#FFFFFF' : inactiveBtnColor,
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.btnBg,
                            '&:hover': {
                              backgroundColor: isHalf && !isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                            },
                            lineHeight: 1.3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.25,
                          }}
                        >
                          <Slice size={8} />
                          ½
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setCustom(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: 0,
                            px: { xs: 0.5, md: 0.75 },
                            py: { xs: 0.125, md: 0.25 },
                            borderRadius: { xs: 0.75, md: 1 },
                            fontSize: { xs: '0.55rem', md: '0.65rem' },
                            fontWeight: 700,
                            textTransform: 'none',
                            backgroundColor: isCustom ? colors.btnBg : inactiveBtnBg,
                            color: isCustom ? '#FFFFFF' : inactiveBtnColor,
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.btnBg,
                            '&:hover': {
                              backgroundColor: isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                            },
                            lineHeight: 1.3,
                          }}
                        >
                          Cst
                        </Button>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: { xs: '0.7rem', md: '0.8rem' },
                            color: colors.text,
                          }}
                        >
                          ₹{lineTotal}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => {
                            removeItem(item.id);
                            vibrate(haptics.light);
                          }}
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

                    {/* Quantity row - only when custom */}
                    {isCustom && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: { xs: 0.25, md: 0.5 },
                        }}
                      >
                        <Button
                          size="small"
                          onClick={() => {
                            decrementItem(item.id);
                            vibrate(haptics.light);
                          }}
                          sx={{
                            minWidth: { xs: 22, md: 26 },
                            width: { xs: 22, md: 26 },
                            height: { xs: 22, md: 26 },
                            p: 0,
                            borderRadius: '50%',
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.activeBorder,
                            color: colors.text,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                            '&:hover': { backgroundColor: colors.activeBg },
                            '&:active': { transform: 'scale(0.92)' },
                          }}
                        >
                          <Minus size={10} />
                        </Button>

                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: { xs: 22, md: 26 },
                            height: { xs: 22, md: 26 },
                            borderRadius: { xs: 0.75, md: 1 },
                            backgroundColor: colors.activeBg,
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.activeBorder,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800,
                              fontSize: { xs: '0.75rem', md: '0.85rem' },
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
                            minWidth: { xs: 22, md: 26 },
                            width: { xs: 22, md: 26 },
                            height: { xs: 22, md: 26 },
                            p: 0,
                            borderRadius: '50%',
                            border: { xs: 1, md: 1.5 },
                            borderColor: colors.activeBorder,
                            color: colors.text,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                            '&:hover': { backgroundColor: colors.activeBg },
                            '&:active': { transform: 'scale(0.92)' },
                          }}
                        >
                          <Plus size={10} />
                        </Button>

                        {/* Spacer to align with toggle row remove button */}
                        <Box sx={{ width: { xs: 18, md: 22 }, height: { xs: 18, md: 22 } }} />
                      </Box>
                    )}
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
