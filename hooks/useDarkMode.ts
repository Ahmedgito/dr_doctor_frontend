import { useTheme } from '../context/ThemeContext';

/** @deprecated Prefer `useTheme().isDarkMode` — kept for Clerk appearance hook. */
export function useDarkMode(): boolean {
  return useTheme().isDarkMode;
}
