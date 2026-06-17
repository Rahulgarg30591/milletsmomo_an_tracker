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
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(15,26,20,0.85)' : 'rgba(255,255,255,0.85)',
        borderTop: 1,
        borderColor: 'divider',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500, mb: 0.25 }}>
          Total Amount
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
                fontSize: '1.5rem',
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
          size="large"
          endIcon={<ArrowRight size={18} />}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.2,
            fontWeight: 700,
            fontSize: '1rem',
            textTransform: 'none',
            background: 'linear-gradient(135deg, #1B6B3A, #2D8A4E)',
            boxShadow: '0 4px 14px rgba(27,107,58,0.25)',
            '&:disabled': {
              background: 'linear-gradient(135deg, #9CA3AF, #6B7280)',
              boxShadow: 'none',
              color: 'rgba(255,255,255,0.7)',
            },
          }}
        >
          <ShoppingBag size={18} style={{ marginRight: 8 }} />
          Place Order
        </Button>
      </motion.div>
    </Box>
  );
}