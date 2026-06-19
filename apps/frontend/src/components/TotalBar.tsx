import { Box, Button, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useOrderDraft } from '../context/OrderDraftContext';
import { calculateOrderTotal } from '../utils/pricing';
import { vibrate, haptics } from '../theme/tokens';

interface TotalBarProps {
  onSubmit: () => void;
}

export default function TotalBar({ onSubmit }: TotalBarProps) {
  const { getItemList } = useOrderDraft();
  const items = getItemList();
  const total = calculateOrderTotal(items);
  const hasItems = items.length > 0;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 56, md: 0 },
        left: 0,
        right: 0,
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(15,26,20,0.85)' : 'rgba(255,255,255,0.85)',
        borderTop: 1,
        borderColor: 'divider',
        p: { xs: 1, md: 1.5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: { xs: 1, md: 1.5 },
      }}
    >
      <Box>
        <Typography sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' }, color: 'text.secondary', fontWeight: 500, mb: { xs: 0.125, md: 0.25 }, lineHeight: 1 }}>
          Total
        </Typography>
        <AnimatePresence mode="wait">
          <motion.div
            key={total}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <Typography
              sx={{
                fontSize: { xs: '1.15rem', md: '1.5rem' },
                fontWeight: 800,
                color: 'text.primary',
                letterSpacing: '-0.3px',
                lineHeight: 1,
              }}
            >
              ₹{total}
            </Typography>
          </motion.div>
        </AnimatePresence>
      </Box>
      <motion.div whileTap={{ scale: 0.97 }} style={{ flexShrink: 0 }}>
        <Button
          variant="contained"
          disabled={!hasItems}
          onClick={() => {
            vibrate(haptics.medium);
            onSubmit();
          }}
          size="small"
          endIcon={<ArrowRight size={16} />}
          sx={{
            borderRadius: { xs: 0.75, md: 1 },
            px: { xs: 2.5, md: 4 },
            py: { xs: 0.75, md: 1 },
            fontWeight: 700,
            fontSize: { xs: '0.85rem', md: '1rem' },
            textTransform: 'none',
            background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
            boxShadow: '0 4px 14px rgba(27,107,58,0.25)',
            '&:disabled': {
              background: 'linear-gradient(135deg, #9CA3AF, #6B7280)',
              boxShadow: 'none',
              color: 'rgba(255,255,255,0.7)',
            },
            minHeight: 0,
            lineHeight: 1.2,
          }}
        >
          <ShoppingBag size={16} style={{ marginRight: 6 }} />
          Place
        </Button>
      </motion.div>
    </Box>
  );
}
