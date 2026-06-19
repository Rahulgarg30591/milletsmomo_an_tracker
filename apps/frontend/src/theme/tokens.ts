/**
 * Design tokens — rich color system with light/dark mode support.
 * All hex values are centralized here. No hardcoded colors in components.
 */

export const palette = {
  primary: {
    light: '#1B6B3A',
    main: '#15803D',
    dark: '#124D29',
    contrast: '#FFFFFF',
  },
  accent: {
    light: '#FDE68A',
    main: '#E8A64A',
    dark: '#B45309',
    contrast: '#FFFFFF',
  },
  semantic: {
    success: '#2D8A4E',
    successLight: '#D1FAE5',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    info: '#1D4ED8',
    infoLight: '#EFF6FF',
  },
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
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #1B6B3A 0%, #15803D 50%, #124D29 100%)',
  accent: 'linear-gradient(135deg, #E8A64A 0%, #D97706 100%)',
  hero: 'linear-gradient(135deg, #F0F4F1 0%, #E8F5EE 50%, #FEF3C7 100%)',
  heroDark: 'linear-gradient(135deg, #1C1C22 0%, #25252D 50%, #1E1E24 100%)',
  surface: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
  surfaceDark: 'linear-gradient(180deg, #25252D 0%, #1C1C22 100%)',
  cardHover: 'linear-gradient(135deg, #FFFFFF 0%, #F0F4F1 100%)',
  cardHoverDark: 'linear-gradient(135deg, #25252D 0%, #2E2E36 100%)',
} as const;

export const shadows = {
  xs: '0 1px 2px rgba(0,0,0,0.04)',
  sm: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  md: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)',
  glow: '0 0 20px rgba(27,107,58,0.15)',
  glowDark: '0 0 20px rgba(45,138,78,0.25)',
} as const;

export const statusColors = {
  dineIn: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Dine in' },
  pack: { bg: '#FEF3C7', fg: '#D97706', label: 'Pack' },
  cash: { bg: '#D1FAE5', fg: '#065F46', label: 'Cash' },
  upi: { bg: '#EDE9FE', fg: '#5B21B6', label: 'UPI' },
  split: { bg: '#F3E8FF', fg: '#7C3AED', label: 'Split' },
  pending: { bg: '#FEE2E2', fg: '#DC2626', label: 'Pending' },
  completed: { bg: '#F3F4F6', fg: '#6B7280', label: 'Done' },
} as const;

export const darkStatusColors = {
  dineIn: { bg: '#1E2A4A', fg: '#8CB4E8', label: 'Dine in' },
  pack: { bg: '#3D2E1A', fg: '#E8C46C', label: 'Pack' },
  cash: { bg: '#1A3D2A', fg: '#8CE8B4', label: 'Cash' },
  upi: { bg: '#2E1A4A', fg: '#C4A8E8', label: 'UPI' },
  split: { bg: '#2E1A4A', fg: '#C4A8E8', label: 'Split' },
  pending: { bg: '#3D1A1A', fg: '#E8A8A8', label: 'Pending' },
  completed: { bg: '#2A2A32', fg: '#9CA3AF', label: 'Done' },
} as const;

export const animations = {
  spring: { type: 'spring', stiffness: 400, damping: 30 } as const,
  springBouncy: { type: 'spring', stiffness: 500, damping: 25 } as const,
  springStiff: { type: 'spring', stiffness: 600, damping: 35 } as const,
  easeOut: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] } as const,
  easeInOut: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const,
  popIn: { scale: [0.92, 1], opacity: [0, 1], transition: { type: 'spring', stiffness: 400, damping: 25 } } as const,
  slideUp: { y: [16, 0], opacity: [0, 1], transition: { type: 'spring', stiffness: 400, damping: 30 } } as const,
  fadeIn: { opacity: [0, 1], transition: { duration: 0.25 } } as const,
  shake: { x: [-8, 8, -6, 6, -4, 4, 0], transition: { duration: 0.4 } } as const,
  stagger: { staggerChildren: 0.05, delayChildren: 0.1 } as const,
  staggerSlow: { staggerChildren: 0.08, delayChildren: 0.15 } as const,
} as const;

export const haptics = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  error: [30, 50, 30],
} as const;

export function vibrate(pattern: number | readonly number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern as number | number[]);
  }
}
