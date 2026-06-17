import { useState, useRef, useCallback } from 'react';
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
  const [longPressId, setLongPressId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const handleTouchStart = (itemId: number) => {
    timerRef.current = setTimeout(() => {
      setLongPressId(itemId);
      toggleHalf(itemId);
      vibrate(haptics.medium);
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
      vibrate(haptics.light);
    }
    setLongPressId(null);
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
            whileTap={{ scale: 0.92 }}
          >
            <Box
              onTouchStart={() => handleTouchStart(item.id)}
              onTouchEnd={() => handleTouchEnd(item.id)}
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
                touchAction: 'none',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: (theme) => theme.shadows[2],
                },
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

              {/* Half toggle — visible on all devices */}
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
                    '&:hover': {
                      backgroundColor: isHalf ? 'secondary.dark' : 'action.selected',
                    },
                  }}
                >
                  <Slice size={8} />
                  {isHalf ? '½' : 'Full'}
                </Box>
              )}

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
                  }}
                >
                  {quantity}
                </Box>
              )}

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
                  }}
                >
                  <Slice size={8} style={{ display: 'inline', marginRight: 2 }} />
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