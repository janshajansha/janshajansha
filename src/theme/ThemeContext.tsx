import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'react-native';
import { ColorPalette, darkPalette, lightPalette } from './themes';

const THEME_STORAGE_KEY = 'ev360_theme_preference';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  colors:       ColorPalette;
  isDark:       boolean;
  mode:         ThemeMode;
  setMode:      (mode: ThemeMode) => void;
  toggleTheme:  () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors:      darkPalette,
  isDark:      true,
  mode:        'dark',
  setMode:     () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme(); // 'dark' | 'light' | null
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Load persisted preference on mount
  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setModeState(saved);
        }
      })
      .catch(() => {}); // ignore — default to dark
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, newMode);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  // Resolve actual dark/light based on mode
  const isDark =
    mode === 'system'
      ? systemScheme === 'dark'
      : mode === 'dark';

  const colors = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme — call this in any component to get the current palette and helpers.
 *
 * Usage:
 *   const { colors, isDark, toggleTheme } = useTheme();
 *   <View style={{ backgroundColor: colors.bgDark }}>
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}