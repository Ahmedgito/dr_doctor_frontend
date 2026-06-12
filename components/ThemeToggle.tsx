import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type ThemeToggleProps = {
  size?: 'sm' | 'md';
  className?: string;
};

export default function ThemeToggle({ size = 'md', className = '' }: ThemeToggleProps) {
  const { isDarkMode, toggleTheme } = useTheme();
  const iconSize = size === 'sm' ? 18 : 20;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Light mode' : 'Dark mode'}
      className={
        size === 'sm'
          ? `p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all active:scale-95 ${className}`
          : `p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all active:scale-95 ${className}`
      }
    >
      {isDarkMode ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
    </button>
  );
}
