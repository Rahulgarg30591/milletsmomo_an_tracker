import { useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';

interface MenuGridProps {
  menuItems: { id: number; displayName: string; fullPrice: number; halfPrice: number }[];
}

export default function MenuGrid({ menuItems }: MenuGridProps) {
  const { addItem, toggleHalf, draft } = useOrderDraft();
  const [longPressId, setLongPressId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = (itemId: number) => {
    timerRef.current = setTimeout(() => {
      setLongPressId(itemId);
      toggleHalf(itemId);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, 500);
  };

  const handleTouchEnd = (itemId: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (longPressId !== itemId) {
      addItem(itemId);
    }
    setLongPressId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: number) => {
    e.preventDefault();
    toggleHalf(itemId);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
        mb: 2,
      }}
    >
      {menuItems.map((item) => {
        const draftItem = draft.items.get(item.id);
        const quantity = draftItem?.quantity || 0;
        const isHalf = draftItem?.isHalf || false;

        return (
          <Box
            key={item.id}
            onTouchStart={() => handleTouchStart(item.id)}
            onTouchEnd={() => handleTouchEnd(item.id)}
            onContextMenu={(e) => handleContextMenu(e, item.id)}
            sx={{
              position: 'relative',
              p: 1.5,
              borderRadius: 2,
              backgroundColor: quantity > 0 ? '#E8F5EE' : '#FFFFFF',
              border: '1px solid',
              borderColor: quantity > 0 ? '#1B6B3A' : '#E5E7EB',
              cursor: 'pointer',
              userSelect: 'none',
              touchAction: 'none',
              transition: 'all 0.15s',
              '&:active': {
                transform: 'scale(0.95)',
                backgroundColor: '#E8F5EE',
              },
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#111827',
                lineHeight: 1.2,
                mb: 0.5,
              }}
            >
              {item.displayName}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.65rem',
                color: '#6B7280',
              }}
            >
              ₹{item.fullPrice}
            </Typography>
            {quantity > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  minWidth: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#1B6B3A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  px: 0.5,
                }}
              >
                {quantity}
              </Box>
            )}
            {isHalf && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  px: 1,
                  py: 0.3,
                  borderRadius: 1,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                ½ plate
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
