import { Box, Button, Paper, Typography } from '@mui/material';

interface PaymentModalProps {
  open: boolean;
  onResolve: (method: 'cash' | 'upi') => void;
  onCancel: () => void;
}

export default function PaymentModal({ open, onResolve, onCancel }: PaymentModalProps) {
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.25s ease',
        '@keyframes fadeIn': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      }}
    >
      <Paper
        sx={{
          borderRadius: '20px 20px 0 0',
          p: 3,
          animation: 'slideUp 0.25s ease',
          '@keyframes slideUp': {
            '0%': { transform: 'translateY(100%)' },
            '100%': { transform: 'translateY(0)' },
          },
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5, color: '#111827' }}>
          Collect Payment
        </Typography>
        <Typography sx={{ color: '#6B7280', fontSize: '0.9rem', mb: 3 }}>
          This order was pending. How did the customer pay?
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => onResolve('cash')}
            sx={{
              borderRadius: 3,
              py: 1.5,
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              backgroundColor: '#1B6B3A',
              '&:hover': { backgroundColor: '#124D29' },
            }}
          >
            💵 Cash
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={() => onResolve('upi')}
            sx={{
              borderRadius: 3,
              py: 1.5,
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              backgroundColor: '#1D4ED8',
              '&:hover': { backgroundColor: '#1E40AF' },
            }}
          >
            📱 UPI
          </Button>
        </Box>

        <Button
          fullWidth
          variant="outlined"
          onClick={onCancel}
          sx={{
            borderRadius: 3,
            py: 1.2,
            fontWeight: 600,
            textTransform: 'none',
            borderColor: '#E5E7EB',
            color: '#6B7280',
          }}
        >
          Cancel
        </Button>
      </Paper>
    </Box>
  );
}
