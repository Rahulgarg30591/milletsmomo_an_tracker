import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { palette, gradients, shadows } from './tokens.js';

export function getTheme(mode: 'light' | 'dark' = 'light') {
  const isDark = mode === 'dark';

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: palette.primary.light,
        light: isDark ? '#2D8A4E' : palette.primary.light,
        dark: isDark ? '#0F2E1A' : palette.primary.dark,
        contrastText: palette.primary.contrast,
      },
      secondary: {
        main: palette.accent.main,
        light: isDark ? '#FCD34D' : palette.accent.light,
        dark: isDark ? '#78350F' : palette.accent.dark,
        contrastText: palette.accent.contrast,
      },
      error: {
        main: palette.semantic.error,
        light: isDark ? '#450A0A' : palette.semantic.errorLight,
      },
      info: {
        main: palette.semantic.info,
        light: isDark ? '#172554' : palette.semantic.infoLight,
      },
      success: {
        main: palette.semantic.success,
        light: isDark ? '#064E3B' : palette.semantic.successLight,
      },
      warning: {
        main: palette.semantic.warning,
        light: isDark ? '#451A03' : palette.semantic.warningLight,
      },
      background: {
        default: isDark ? '#0F1A14' : '#F0F4F1',
        paper: isDark ? '#1A2B22' : '#FFFFFF',
      },
      grey: palette.grey,
      text: {
        primary: isDark ? '#F0FDF4' : '#111827',
        secondary: isDark ? '#9CA3AF' : '#6B7280',
      },
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
      button: { fontWeight: 600, textTransform: 'none' as const, letterSpacing: '0.025em' },
      h1: { fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2 },
      h2: { fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.25 },
      h3: { fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.3 },
      h4: { fontWeight: 600, letterSpacing: '-0.1px', lineHeight: 1.35 },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.5 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 600,
            transition: 'all 0.2s ease',
            '&:active': { transform: 'scale(0.97)' },
          },
          containedPrimary: {
            background: gradients.primary,
            boxShadow: shadows.glow,
            '&:hover': {
              boxShadow: isDark ? shadows.glowDark : shadows.glow,
            },
          },
          containedSecondary: {
            background: gradients.accent,
            boxShadow: `0 4px 14px ${isDark ? 'rgba(232,166,74,0.25)' : 'rgba(232,166,74,0.2)'}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isDark ? shadows.md : shadows.sm,
            background: isDark ? gradients.surfaceDark : gradients.surface,
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            '&:hover': {
              boxShadow: isDark ? shadows.lg : shadows.md,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 20, fontWeight: 600, fontSize: '0.8125rem' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            background: isDark ? gradients.surfaceDark : gradients.surface,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'rgba(15,26,20,0.85)'
              : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            boxShadow: 'none',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'rgba(15,26,20,0.9)'
              : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            boxShadow: shadows.xl,
          },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
}