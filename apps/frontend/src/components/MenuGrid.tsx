import { Box, Typography, Button, useTheme } from '@mui/material';
import { Minus, Plus, X, Slice } from 'lucide-react';
import { useRef, useCallback, memo } from 'react';
import { useOrderDraft } from '../context/OrderDraftContext';

import { trackSelection, trackQuantityChange } from '../utils/tracking';
import { vibrate, haptics } from '../theme/tokens';

interface MenuItem {
  id: number;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
  preparation: string;
  filling: string;
}

interface DraftItem {
  quantity: number;
  isHalf: boolean;
  isCustom: boolean;
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

interface MenuCellProps {
  item: MenuItem;
  draftItem: DraftItem | undefined;
  isDark: boolean;
  onAdd: (item: MenuItem) => void;
  incrementItem: (id: number) => void;
  decrementItem: (id: number) => void;
  removeItem: (id: number) => void;
  setFull: (id: number) => void;
  setHalf: (id: number) => void;
  setCustom: (id: number) => void;
}

const MenuCellBase = ({
  item, draftItem, isDark, onAdd,
  incrementItem, decrementItem, removeItem, setFull, setHalf, setCustom,
}: MenuCellProps) => {
  const FILLING_COLORS = isDark ? FILLING_COLORS_DARK : FILLING_COLORS_LIGHT;
  const inactiveBtnBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const inactiveBtnColor = isDark ? '#9CA3AF' : '#6B7280';

  const quantity = draftItem?.quantity || 0;
  const isHalf = draftItem?.isHalf || false;
  const isCustom = draftItem?.isCustom || false;
  const isActive = quantity > 0;
  const colors = FILLING_COLORS[item.filling] || FILLING_COLORS['Veg'];

  return (
    <div style={{ display: 'flex' }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          p: { xs: 0.5, md: 0.75 },
          borderRadius: { xs: 0.75, md: 1 },
          backgroundColor: isActive ? colors.activeBg : colors.bg,
          border: { xs: 1, md: 1.5 },
          borderColor: isActive ? colors.activeBorder : colors.border,
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 0.125, md: 0.25 },
          minHeight: { xs: isActive ? (isCustom ? 72 : 48) : 44, md: isActive ? (isCustom ? 84 : 56) : 52 },
          cursor: isActive ? 'default' : 'pointer',
          '&:hover': {
            borderColor: isActive ? colors.activeBorder : colors.border,
          },
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (!isActive) {
            onAdd(item);
          } else if (!isCustom) {
            setFull(item.id);
            trackSelection('new_order', 'plate_size', 'full', { itemId: item.id, itemName: item.displayName, quantity });
            vibrate(haptics.light);
          }
        }}
      >
        {/* Header: centered name */}
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
        </Box>

        {/* Body */}
        {!isActive ? (
          <Box sx={{ height: { xs: 20, md: 24 }, marginTop: 'auto' }} />
        ) : (
          <Box
            sx={{
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
              <Box sx={{ display: 'flex', flex: 1, gap: { xs: 0.25, md: 0.5 } }}>
                <Button
                  size="small"
                  onClick={() => {
                    setFull(item.id);
                    trackSelection('new_order', 'plate_size', 'full', { itemId: item.id, itemName: item.displayName, quantity });
                    vibrate(haptics.light);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: { xs: 0.25, md: 0.5 },
                    py: { xs: 0.05, md: 0.1 },
                    borderRadius: { xs: 0.5, md: 0.75 },
                    fontSize: { xs: '0.5rem', md: '0.6rem' },
                    fontWeight: 700,
                    textTransform: 'none',
                    backgroundColor: !isHalf && !isCustom ? colors.btnBg : inactiveBtnBg,
                    color: !isHalf && !isCustom ? '#FFFFFF' : inactiveBtnColor,
                    border: { xs: 1, md: 1.5 },
                    borderColor: colors.btnBg,
                    '&:hover': {
                      backgroundColor: !isHalf && !isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                    },
                    lineHeight: 1.2,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                    <span>Full</span>
                    {!isHalf && !isCustom && (
                      <span style={{ fontSize: '0.45rem', opacity: 0.8 }}>{quantity}</span>
                    )}
                  </Box>
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setHalf(item.id);
                    trackSelection('new_order', 'plate_size', 'half', { itemId: item.id, itemName: item.displayName, quantity });
                    vibrate(haptics.light);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: { xs: 0.25, md: 0.5 },
                    py: { xs: 0.05, md: 0.1 },
                    borderRadius: { xs: 0.5, md: 0.75 },
                    fontSize: { xs: '0.5rem', md: '0.6rem' },
                    fontWeight: 700,
                    textTransform: 'none',
                    backgroundColor: isHalf && !isCustom ? colors.btnBg : inactiveBtnBg,
                    color: isHalf && !isCustom ? '#FFFFFF' : inactiveBtnColor,
                    border: { xs: 1, md: 1.5 },
                    borderColor: colors.btnBg,
                    '&:hover': {
                      backgroundColor: isHalf && !isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                    },
                    lineHeight: 1.2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                    <span><Slice size={7} />½</span>
                    {isHalf && !isCustom && (
                      <span style={{ fontSize: '0.45rem', opacity: 0.8 }}>{quantity}</span>
                    )}
                  </Box>
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setCustom(item.id);
                    trackSelection('new_order', 'plate_size', 'custom', { itemId: item.id, itemName: item.displayName, quantity });
                    vibrate(haptics.light);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    px: { xs: 0.25, md: 0.5 },
                    py: { xs: 0.05, md: 0.1 },
                    borderRadius: { xs: 0.5, md: 0.75 },
                    fontSize: { xs: '0.5rem', md: '0.6rem' },
                    fontWeight: 700,
                    textTransform: 'none',
                    backgroundColor: isCustom ? colors.btnBg : inactiveBtnBg,
                    color: isCustom ? '#FFFFFF' : inactiveBtnColor,
                    border: { xs: 1, md: 1.5 },
                    borderColor: colors.btnBg,
                    '&:hover': {
                      backgroundColor: isCustom ? colors.btnHover : isDark ? 'rgba(255,255,255,0.1)' : colors.activeBg,
                    },
                    lineHeight: 1.2,
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                    <span>Cst</span>
                    {isCustom && (
                      <span style={{ fontSize: '0.45rem', opacity: 0.8 }}>{quantity}</span>
                    )}
                  </Box>
                </Button>
              </Box>

              <Button
                size="small"
                onClick={() => {
                  removeItem(item.id);
                  trackQuantityChange('new_order', item.displayName, 0, false, { itemId: item.id, filling: item.filling });
                  vibrate(haptics.light);
                }}
                sx={{
                  minWidth: { xs: 16, md: 20 },
                  width: { xs: 16, md: 20 },
                  height: { xs: 16, md: 20 },
                  p: 0,
                  borderRadius: '50%',
                  color: 'error.main',
                  border: '1px solid',
                  borderColor: 'error.main',
                  '&:hover': { backgroundColor: 'error.light' },
                }}
              >
                <X size={9} />
              </Button>
            </Box>

            {/* Quantity row - only when custom */}
            {isCustom && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.25, md: 0.5 },
                }}
              >
                <Button
                  size="small"
                  onClick={() => {
                    decrementItem(item.id);
                    trackQuantityChange('new_order', item.displayName, Math.max(0, quantity - 1), isHalf, { itemId: item.id, isCustom: true });
                    vibrate(haptics.light);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    height: { xs: 22, md: 26 },
                    p: 0,
                    borderRadius: { xs: 0.5, md: 0.75 },
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
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: { xs: 22, md: 26 },
                    borderRadius: { xs: 0.5, md: 0.75 },
                    backgroundColor: colors.activeBg,
                    border: { xs: 1, md: 1.5 },
                    borderColor: colors.activeBorder,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '0.7rem', md: '0.8rem' },
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
                    trackQuantityChange('new_order', item.displayName, quantity + 1, isHalf, { itemId: item.id, isCustom: true });
                    vibrate(haptics.light);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    height: { xs: 22, md: 26 },
                    p: 0,
                    borderRadius: { xs: 0.5, md: 0.75 },
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
              </Box>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
};

const MenuCell = memo(MenuCellBase);

export default function MenuGrid({ items }: MenuGridProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { addItem, incrementItem, decrementItem, removeItem, setFull, setHalf, setCustom, draft } = useOrderDraft();
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  const onAdd = useCallback((item: MenuItem) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      addItem(item.id);
      trackQuantityChange('new_order', item.displayName, 1, false, { itemId: item.id, filling: item.filling, double: true });
      vibrate(haptics.light);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        addItem(item.id);
        trackQuantityChange('new_order', item.displayName, 1, false, { itemId: item.id, filling: item.filling });
        vibrate(haptics.light);
      }, 250);
    }
  }, [addItem]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 0.5, md: 0.75 },
      }}
    >
      {items.map((item) => (
        <MenuCell
          key={item.id}
          item={item}
          draftItem={draft.items.get(item.id)}
          isDark={isDark}
          onAdd={onAdd}
          incrementItem={incrementItem}
          decrementItem={decrementItem}
          removeItem={removeItem}
          setFull={setFull}
          setHalf={setHalf}
          setCustom={setCustom}
        />
      ))}
    </Box>
  );
}
