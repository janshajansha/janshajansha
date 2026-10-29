export interface ColorPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  bgDark: string;
  bgCard: string;
  bgCardLight: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  white: string;
  black: string;
  transparent: string;
  overlay: string;
  emergency: string;
  breakdown: string;
  maintenance: string;
}

export const darkPalette: ColorPalette = {
  primary: '#7FBF31',
  primaryDark: '#6CA62A',
  primaryLight: '#9ED15A',
  accent: '#7FBF31',
  bgDark: '#221714',
  bgCard: '#2C241F',
  bgCardLight: '#3A322C',
  bgInput: '#2C241F',
  textPrimary: '#F8F1E9',
  textSecondary: '#C8B8A8',
  textMuted: '#8F8377',
  success: '#7FBF31',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  border: '#3F3832',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(34, 23, 20, 0.75)',
  emergency: '#EF4444',
  breakdown: '#F97316',
  maintenance: '#7FBF31',
};

export const lightPalette: ColorPalette = {
  // Light mode (kept minimal – most users stay in dark)
  primary: '#6CA62A',
  primaryDark: '#5E9F25',
  primaryLight: '#9ED15A',
  accent: '#7FBF31',
  bgDark: '#F8F4ED',
  bgCard: '#FFFFFF',
  bgCardLight: '#F5F0E8',
  bgInput: '#F8F4ED',
  textPrimary: '#221714',
  textSecondary: '#5C5248',
  textMuted: '#8F8377',
  success: '#6CA62A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  border: '#E5D9CC',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(34, 23, 20, 0.4)',
  emergency: '#DC2626',
  breakdown: '#EA580C',
  maintenance: '#6CA62A',
};