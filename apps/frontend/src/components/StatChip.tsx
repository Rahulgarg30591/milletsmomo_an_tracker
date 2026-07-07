import { Box, Typography, useTheme } from '@mui/material';
import { ShoppingBag, IndianRupee, Clock, CreditCard, TrendingUp, Package } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  orders: <ShoppingBag size={18} />,
  revenue: <IndianRupee size={18} />,
  pending: <Clock size={18} />,
  payment: <CreditCard size={18} />,
  primary: <TrendingUp size={18} />,
  accent: <Package size={18} />,
};

const colorMap: Record<string, { bg: string; fg: string; gradient: string; glow?: string }> = {
  primary: {
    bg: 'rgba(27,107,58,0.08)',
    fg: '#1B6B3A',
    gradient: 'linear-gradient(135deg, rgba(27,107,58,0.08) 0%, rgba(45,138,78,0.04) 100%)',
    glow: '',
  },
  accent: {
    bg: 'rgba(232,166,74,0.08)',
    fg: '#D97706',
    gradient: 'linear-gradient(135deg, rgba(232,166,74,0.08) 0%, rgba(217,119,6,0.04) 100%)',
    glow: '',
  },
  error: {
    bg: 'rgba(220,38,38,0.08)',
    fg: '#DC2626',
    gradient: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(185,28,28,0.04) 100%)',
    glow: '',
  },
  success: {
    bg: 'rgba(45,138,78,0.08)',
    fg: '#2D8A4E',
    gradient: 'linear-gradient(135deg, rgba(45,138,78,0.08) 0%, rgba(6,95,70,0.04) 100%)',
    glow: '',
  },
};

const darkColorMap: Record<string, { bg: string; fg: string; gradient: string; glow: string }> = {
  primary: {
    bg: 'rgba(74,222,128,0.10)',
    fg: '#4ADE80',
    gradient: 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(45,138,78,0.06) 100%)',
    glow: '0 0 12px rgba(74,222,128,0.15)',
  },
  accent: {
    bg: 'rgba(251,191,36,0.10)',
    fg: '#FBBF24',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(217,119,6,0.06) 100%)',
    glow: '0 0 12px rgba(251,191,36,0.15)',
  },
  error: {
    bg: 'rgba(248,113,113,0.10)',
    fg: '#F87171',
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(185,28,28,0.06) 100%)',
    glow: '0 0 12px rgba(248,113,113,0.15)',
  },
  success: {
    bg: 'rgba(74,222,128,0.10)',
    fg: '#4ADE80',
    gradient: 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(6,95,70,0.06) 100%)',
    glow: '0 0 12px rgba(74,222,128,0.15)',
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
  const colors = isDark ? darkColorMap[color] : colorMap[color];
  const iconEl = icon ? iconMap[icon] || iconMap[color] : iconMap[color];

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        background: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
        boxShadow: isDark ? '0 0 0 1px rgba(255,255,255,0.06)' : (theme) => theme.shadows[1],
        border: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'divider',
        '&:hover': {
          boxShadow: isDark ? colors.glow : (theme) => theme.shadows[3],
          borderColor: isDark ? colors.bg : 'divider',
        },
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          background: colors.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.fg,
          flexShrink: 0,
          boxShadow: isDark ? colors.glow : 'none',
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
  );
}
