import type { ReactNode } from 'react';
import ThemeToggle from './ThemeToggle';

/** Sign-in / sign-up shell matching the main app background. */
export default function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center p-6 relative overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-400/30 dark:bg-teal-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 w-full flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-900/20">
            <img src="/assets/black_logo.png" alt="" className="w-6 h-6 object-contain dark:hidden" />
            <img src="/assets/logo.png" alt="" className="w-6 h-6 object-contain hidden dark:block" />
          </div>
          <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-500">
            dr.doctor
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
