import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const COLORS = {
  // ── BRAND (NEW GLOSSY LOOK) ─────────────────────
  primary: '#7FBF31',
  primaryDark: '#6CA62A',
  primaryLight: '#9ED15A',
  accent: '#7FBF31',

  // ── BACKGROUND (Luxurious dark EV feel) ────────
  bgDark: '#221714',        // Main app background
  bgCard: '#2C241F',        // Cards / surfaces (semi-gloss)
  bgCardLight: '#3A322C',   // Elevated elements, chips, buttons
  bgInput: '#2C241F',

  // ── TEXT ───────────────────────────────────────
  textPrimary: '#F8F1E9',
  textSecondary: '#C8B8A8',
  textMuted: '#8F8377',

  // ── STATUS / SEMANTIC ───────────────────────────
  success: '#7FBF31',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // ── MISC ────────────────────────────────────────
  border: '#3F3832',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(34, 23, 20, 0.75)',

  // Service type colors (tinted with green energy)
  emergency: '#EF4444',
  breakdown: '#F97316',
  maintenance: '#7FBF31',
} as const;

// ── GLOSSY HELPERS (use these for modern cards/buttons) ──
export const GLASS = {
  backgroundColor: 'rgba(44, 36, 31, 0.85)',
  borderWidth: 1,
  borderColor: 'rgba(127, 191, 49, 0.25)',
  shadowColor: '#7FBF31',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
  elevation: 12,
};

export const GRADIENT_PRIMARY = ['#7FBF31', '#5E9F25'] as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 80,
};

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
};

export const SHADOW = {
  soft: {
    shadowColor: '#7FBF31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glossy: {
    shadowColor: '#7FBF31',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  heavy: {
    shadowColor: '#7FBF31',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 24,
  },
};