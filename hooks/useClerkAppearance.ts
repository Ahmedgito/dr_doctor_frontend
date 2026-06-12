import { useMemo } from 'react';
import type { ClerkAppearanceTheme } from '@clerk/shared/types';

import { getClerkAppearance } from '../lib/clerkAppearance';
import { useTheme } from '../context/ThemeContext';

export function useClerkAppearance(): ClerkAppearanceTheme {
  const { isDarkMode } = useTheme();
  return useMemo(() => getClerkAppearance(isDarkMode), [isDarkMode]);
}
