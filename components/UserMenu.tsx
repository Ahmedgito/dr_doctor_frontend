import { UserButton, useClerk, useUser } from '@clerk/react';
import { LogOut } from 'lucide-react';

type UserMenuProps = {
  /** @deprecated use variant="compact" */
  compact?: boolean;
  variant?: 'default' | 'compact' | 'sidebar';
};

function LogoutButton({ className = '' }: { className?: string }) {
  const { signOut } = useClerk();

  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: '/sign-in' })}
      aria-label="Sign out"
      title="Sign out"
      className={`p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ${className}`}
    >
      <LogOut size={18} />
    </button>
  );
}

export default function UserMenu({ compact = false, variant }: UserMenuProps) {
  const resolvedVariant = variant ?? (compact ? 'compact' : 'default');
  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'User';

  const email = user?.primaryEmailAddress?.emailAddress;

  if (!isLoaded) {
    if (resolvedVariant === 'sidebar') {
      return (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-2.5 w-32 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center rounded-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 animate-pulse ${
          resolvedVariant === 'compact' ? 'h-9 w-28' : 'h-10 w-36'
        }`}
      />
    );
  }

  if (resolvedVariant === 'sidebar') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-10 h-10',
              userButtonTrigger: 'focus:shadow-none',
            },
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={displayName}>
            {displayName}
          </p>
          {email && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={email}>
              {email}
            </p>
          )}
        </div>
        <LogoutButton className="flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div
        className={`flex items-center rounded-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shadow-sm ${
          resolvedVariant === 'compact' ? 'gap-2 pl-3 pr-1.5 py-1' : 'gap-2.5 pl-4 pr-1.5 py-1.5'
        }`}
      >
        <span
          className={`font-semibold text-slate-800 dark:text-slate-100 truncate ${
            resolvedVariant === 'compact' ? 'text-xs max-w-[88px]' : 'text-sm max-w-[140px]'
          }`}
          title={displayName}
        >
          {displayName}
        </span>
        <UserButton
          appearance={{
            elements: {
              avatarBox: resolvedVariant === 'compact' ? 'w-7 h-7' : 'w-8 h-8',
              userButtonTrigger: 'focus:shadow-none',
            },
          }}
        />
      </div>
      <LogoutButton />
    </div>
  );
}
