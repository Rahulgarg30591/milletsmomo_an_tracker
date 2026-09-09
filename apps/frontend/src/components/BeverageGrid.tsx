import { Box, Typography, Button, useTheme } from '@mui/material';
import { Minus, Plus, X } from 'lucide-react';
import { memo } from 'react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { trackQuantityChange } from '../utils/tracking';
import { vibrate, haptics } from '../theme/tokens';
import type { MenuItem } from '../types';

type BeverageColors = {
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  text: string;
};

const COLORS_LIGHT: Record<string, BeverageColors> = {
  'Cold Drink': { bg: '#EFF6FF', border: '#93C5FD', activeBg: '#DBEAFE', activeBorder: '#3B82F6', text: '#1D4ED8' },
  'Water': { bg: '#ECFEFF', border: '#67E8F9', activeBg: '#CFFAFE', activeBorder: '#06B6D4', text: '#0E7490' },
};

const COLORS_DARK: Record<string, BeverageColors> = {
  'Cold Drink': { bg: '#16233D', border: '#2563EB', activeBg: '#1B2E52', activeBorder: '#60A5FA', text: '#93C5FD' },
  'Water': { bg: '#0E2A30', border: '#0E7490', activeBg: '#123840', activeBorder: '#22D3EE', text: '#67E8F9' },
};

const FALLBACK_LIGHT: BeverageColors = { bg: '#F3F4F6', border: '#D1D5DB', activeBg: '#E5E7EB', activeBorder: '#6B7280', text: '#374151' };
const FALLBACK_DARK: BeverageColors = { bg: '#2A2A32', border: '#4B5563', activeBg: '#33333C', activeBorder: '#9CA3AF', text: '#D1D5DB' };

interface BeverageCellProps {
  item: MenuItem;
  quantity: number;
  isDark: boolean;
  onAdd: (item: MenuItem) => void;
  onIncrement: (item: MenuItem) => void;
  onDecrement: (item: MenuItem) => void;
  onRemove: (item: MenuItem) => void;
}

const BeverageCellBase = ({
  item, quantity, isDark, onAdd, onIncrement, onDecrement, onRemove,
}: BeverageCellProps) => {
  const palette = isDark ? COLORS_DARK : COLORS_LIGHT;
  const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const colors = palette[item.displayName] || fallback;
  const isActive = quantity > 0;

  const stepperButtonSx = {
    flex: 1,
    minWidth: 0,
    height: { xs: 24, md: 28 },
    p: 0,
    borderRadius: { xs: 0.5, md: 0.75 },
    border: { xs: 1, md: 1.5 },
    borderColor: colors.activeBorder,
    color: colors.text,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    '&:hover': { backgroundColor: colors.activeBg },
    '&:active': { transform: 'scale(0.92)' },
  } as const;

  return (
    <Box
      sx={{
        width: '100%',
        p: { xs: 0.75, md: 1 },
        borderRadius: { xs: 0.75, md: 1 },
        backgroundColor: isActive ? colors.activeBg : colors.bg,
        border: { xs: 1, md: 1.5 },
        borderColor: isActive ? colors.activeBorder : colors.border,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 0.375, md: 0.5 },
        minHeight: { xs: isActive ? 76 : 52, md: isActive ? 86 : 60 },
        cursor: isActive ? 'default' : 'pointer',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (!isActive) onAdd(item);
      }}
      role={isActive ? undefined : 'button'}
      aria-label={isActive ? undefined : `Add ${item.displayName}`}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.125 }}>
        <Typography
          sx={{
            fontSize: { xs: '0.75rem', md: '0.85rem' },
            fontWeight: 700,
            color: isActive ? colors.text : 'text.primary',
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {item.displayName}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: '0.6rem', md: '0.7rem' },
            fontWeight: 600,
            color: 'text.secondary',
            lineHeight: 1.2,
          }}
        >
          ₹{item.fullPrice} each
        </Typography>
      </Box>

      {isActive && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 }, marginTop: 'auto' }}>
          <Button
            size="small"
            onClick={() => onDecrement(item)}
            aria-label={`Reduce ${item.displayName}`}
            sx={stepperButtonSx}
          >
            <Minus size={10} />
          </Button>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: { xs: 24, md: 28 },
              borderRadius: { xs: 0.5, md: 0.75 },
              backgroundColor: colors.activeBg,
              border: { xs: 1, md: 1.5 },
              borderColor: colors.activeBorder,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.7rem', md: '0.8rem' }, color: colors.text, lineHeight: 1 }}>
              {quantity}
            </Typography>
          </Box>

          <Button
            size="small"
            onClick={() => onIncrement(item)}
            aria-label={`Add another ${item.displayName}`}
            sx={stepperButtonSx}
          >
            <Plus size={10} />
          </Button>

          <Button
            size="small"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.displayName}`}
            sx={{
              minWidth: { xs: 20, md: 24 },
              width: { xs: 20, md: 24 },
              height: { xs: 20, md: 24 },
              p: 0,
              borderRadius: '50%',
              color: 'error.main',
              border: '1px solid',
              borderColor: 'error.main',
              flexShrink: 0,
              '&:hover': { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : 'error.light' },
            }}
          >
            <X size={9} />
          </Button>
        </Box>
      )}
    </Box>
  );
};

const BeverageCell = memo(BeverageCellBase);

/**
 * Order-entry grid for flat-priced beverages.
 *
 * Separate from MenuGrid because momo cells are built around plate sizing
 * (Full / Half / Custom), which does not apply to a per-unit drink.
 */
export default function BeverageGrid({ items }: { items: MenuItem[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { draft, addUnit, incrementItem, decrementItem, removeItem } = useOrderDraft();

  const track = (item: MenuItem, quantity: number) =>
    trackQuantityChange('new_order', item.displayName, quantity, false, {
      itemId: item.id,
      beverage: true,
    });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { xs: 0.5, md: 0.75 },
      }}
    >
      {items.map((item) => {
        const quantity = draft.items.get(item.id)?.quantity || 0;
        return (
          <BeverageCell
            key={item.id}
            item={item}
            quantity={quantity}
            isDark={isDark}
            onAdd={(bev) => {
              vibrate(haptics.light);
              addUnit(bev.id);
              track(bev, 1);
            }}
            onIncrement={(bev) => {
              vibrate(haptics.light);
              incrementItem(bev.id);
              track(bev, quantity + 1);
            }}
            onDecrement={(bev) => {
              vibrate(haptics.light);
              decrementItem(bev.id);
              track(bev, Math.max(0, quantity - 1));
            }}
            onRemove={(bev) => {
              vibrate(haptics.light);
              removeItem(bev.id);
              track(bev, 0);
            }}
          />
        );
      })}
    </Box>
  );
}
