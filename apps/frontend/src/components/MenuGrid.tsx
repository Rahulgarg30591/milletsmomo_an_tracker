import { useRef, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { Slice } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { vibrate, haptics } from '../theme/tokens';

interface MenuGridProps {
  menuItems: { id: number; displayName: string; fullPrice: number; halfPrice: number }[];
}

export default function MenuGrid({ menuItems }: MenuGridProps) {
  const { addItem, toggleHalf, draft } = useOrderDraft();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (itemId: number, e: React.TouchEvent) => {
    isLongPressRef.current = false;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      toggleHalf(itemId);
      vibrate(haptics.medium);
    }, 500);
  };

  const handleTouchEnd = (itemId: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPressRef.current) {
      addItem(itemId);
      vibrate(haptics.light);
    }
    isLongPressRef.current = false;
    touchStartRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !timerRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      isLongPressRef.current = false;
    }
  };

  const handleClick = (itemId: number) => {
    if (isLongPressRef.current) return;
    addItem(itemId);
    vibrate(haptics.light);
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: number) => {
    e.preventDefault();
    toggleHalf(itemId);
    vibrate(haptics.medium);
  };

  const handleHalfToggle = useCallback(
    (e: React.MouseEvent, itemId: number) => {
      e.stopPropagation();
      toggleHalf(itemId);
      vibrate(haptics.medium);
    },
    [toggleHalf]
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1,
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02, type: 'spring', stiffness: 400, damping: 30 }}
          >
            <Box
              onClick={() => handleClick(item.id)}
              onTouchStart={(e) => handleTouchStart(item.id, e)}
              onTouchEnd={() => handleTouchEnd(item.id)}
              onTouchMove={handleTouchMove}
              onContextMenu={(e) => handleContextMenu(e, item.id)}
              sx={{
                position: 'relative',
                p: 1.5,
                borderRadius: 2.5,
                backgroundColor: isActive ? 'primary.light' : 'background.paper',
                border: 1.5,
                borderColor: isActive ? 'primary.main' : 'divider',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.15s ease',
                '&:active': {
                  transform: 'scale(0.95)',
                  backgroundColor: 'primary.light',
                },
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: (theme) => theme.shadows[2],
                },
                minHeight: 64,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                {item.displayName}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                ₹{item.fullPrice}
              </Typography>

              {/* Half toggle — visible when item is selected */}
              {isActive && (
                <Box
                  onClick={(e) => handleHalfToggle(e, item.id)}
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    px: 0.75,
                    py: 0.2,
                    borderRadius: 1,
                    backgroundColor: isHalf ? 'secondary.main' : 'action.hover',
                    color: isHalf ? 'secondary.contrastText' : 'text.secondary',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    transition: 'all 0.15s ease',
                    zIndex: 2,
                    '&:active': {
                      transform: 'translateX(-50%) scale(0.92)',
                    },
                    '&:hover': {
                      backgroundColor: isHalf ? 'secondary.dark' : 'action.selected',
                    },
                  }}
                >
                  <Slice size={8} />
                  {isHalf ? '½' : 'Full'}
                </Box>
              )}

              {/* Quantity badge */}
              {quantity > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    minWidth: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    px: 0.5,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 2,
                  }}
                >
                  {quantity}
                </Box>
              )}

              {/* Half indicator when not active but half is set (shouldn't happen normally) */}
              {isHalf && !isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    px: 1,
                    py: 0.3,
                    borderRadius: 1,
                    backgroundColor: 'secondary.main',
                    color: 'secondary.contrastText',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    zIndex: 2,
                  }}
                >
                  <Slice size={8} />
                  ½ plate
                </Box>
              )}
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}
