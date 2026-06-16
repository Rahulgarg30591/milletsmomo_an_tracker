import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1B6B3A',
      light: '#E8F5EE',
      dark: '#124D29',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D97706',
      light: '#FEF3C7',
      contrastText: '#FFFFFF',
    },
    error: { main: '#DC2626', light: '#FEE2E2' },
    info: { main: '#1D4ED8', light: '#EFF6FF' },
    success: { main: '#2D8A4E', light: '#D1FAE5' },
    background: { default: '#F0F4F1', paper: '#FFFFFF' },
    grey: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    text: { primary: '#111827', secondary: '#6B7280' },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    fontSize: 14,
    button: { fontWeight: 600, textTransform: 'none' },
    h1: { fontWeight: 800, letterSpacing: '-0.5px' },
    h2: { fontWeight: 700, letterSpacing: '-0.3px' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        containedPrimary: {
          '&:active': { backgroundColor: '#124D29', transform: 'scale(0.97)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 20, fontWeight: 600 } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
  },
});
