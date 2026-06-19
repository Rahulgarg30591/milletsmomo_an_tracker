import { createTheme, type ThemeOptions } from '@mui/material/styles';
import { palette, gradients, shadows } from './tokens.js';

export function getTheme(mode: 'light' | 'dark' = 'light') {
  const isDark = mode === 'dark';

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: isDark ? '#4ADE80' : palette.primary.light,
        light: isDark ? '#5EE890' : palette.primary.light,
        dark: isDark ? '#0F2E1A' : palette.primary.dark,
        contrastText: isDark ? '#FFFFFF' : palette.primary.contrast,
      },
      secondary: {
        main: isDark ? '#FBBF24' : palette.accent.main,
        light: isDark ? '#FCD34D' : palette.accent.light,
        dark: isDark ? '#78350F' : palette.accent.dark,
        contrastText: isDark ? '#FFFFFF' : palette.accent.contrast,
      },
      error: {
        main: isDark ? '#F87171' : palette.semantic.error,
        light: isDark ? '#2A1010' : palette.semantic.errorLight,
      },
      info: {
        main: isDark ? '#60A5FA' : palette.semantic.info,
        light: isDark ? '#0F172A' : palette.semantic.infoLight,
      },
      success: {
        main: isDark ? '#4ADE80' : palette.semantic.success,
        light: isDark ? '#0F1A14' : palette.semantic.successLight,
      },
      warning: {
        main: isDark ? '#FBBF24' : palette.semantic.warning,
        light: isDark ? '#1A1A1E' : palette.semantic.warningLight,
      },
      background: {
        default: isDark ? '#1C1C22' : '#F0F4F1',
        paper: isDark ? '#25252D' : '#FFFFFF',
      },
      grey: palette.grey,
      text: {
        primary: isDark ? '#E8E8EC' : '#111827',
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
              ? 'rgba(28,28,34,0.9)'
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
              ? 'rgba(28,28,34,0.95)'
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
