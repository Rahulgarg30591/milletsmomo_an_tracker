import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { ShoppingBag, IndianRupee, Clock, CreditCard, TrendingUp, Package } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  orders: <ShoppingBag size={18} />,
  revenue: <IndianRupee size={18} />,
  pending: <Clock size={18} />,
  payment: <CreditCard size={18} />,
  primary: <TrendingUp size={18} />,
  accent: <Package size={18} />,
};

const colorMap: Record<string, { bg: string; fg: string; gradient: string }> = {
  primary: {
    bg: 'rgba(27,107,58,0.08)',
    fg: '#1B6B3A',
    gradient: 'linear-gradient(135deg, rgba(27,107,58,0.08) 0%, rgba(45,138,78,0.04) 100%)',
  },
  accent: {
    bg: 'rgba(232,166,74,0.08)',
    fg: '#D97706',
    gradient: 'linear-gradient(135deg, rgba(232,166,74,0.08) 0%, rgba(217,119,6,0.04) 100%)',
  },
  error: {
    bg: 'rgba(220,38,38,0.08)',
    fg: '#DC2626',
    gradient: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(185,28,28,0.04) 100%)',
  },
  success: {
    bg: 'rgba(45,138,78,0.08)',
    fg: '#2D8A4E',
    gradient: 'linear-gradient(135deg, rgba(45,138,78,0.08) 0%, rgba(6,95,70,0.04) 100%)',
  },
};

interface StatChipProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: 'primary' | 'accent' | 'error' | 'success';
}

export default function StatChip({ label, value, icon, color = 'primary' }: StatChipProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = colorMap[color];
  const iconEl = icon ? iconMap[icon] || iconMap[color] : iconMap[color];

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <Box
        sx={{
          p: 2,
          borderRadius: 3,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
          boxShadow: (theme) => theme.shadows[1],
          border: 1,
          borderColor: 'divider',
          transition: 'box-shadow 0.2s ease',
          '&:hover': {
            boxShadow: (theme) => theme.shadows[3],
          },
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            background: colors.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.fg,
            flexShrink: 0,
          }}
        >
          {iconEl}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'text.secondary',
              mb: 0.25,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.15rem',
              color: 'text.primary',
              letterSpacing: '-0.2px',
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}