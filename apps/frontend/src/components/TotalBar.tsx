import { Box, Button, Typography } from '@mui/material';
import { useOrderDraft } from '../context/OrderDraftContext';
import { calculateOrderTotal } from '../utils/pricing';

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
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500 }}>
          Total Amount
        </Typography>
        <Typography
          sx={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#111827',
            letterSpacing: '-0.3px',
          }}
        >
          ₹{total}
        </Typography>
      </Box>
      <Button
        variant="contained"
        disabled={!hasItems}
        onClick={onSubmit}
        sx={{
          borderRadius: 3,
          px: 4,
          py: 1.2,
          fontWeight: 700,
          fontSize: '1rem',
          textTransform: 'none',
          backgroundColor: '#1B6B3A',
          '&:disabled': {
            backgroundColor: '#D1D5DB',
            color: '#9CA3AF',
          },
        }}
      >
        Place Order
      </Button>
    </Box>
  );
}
