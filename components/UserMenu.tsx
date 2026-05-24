import { UserButton, useUser } from '@clerk/react';

export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useUser();

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'User';

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <span
        className={`font-medium text-slate-700 dark:text-slate-200 truncate ${
          compact ? 'text-xs max-w-[100px]' : 'text-sm max-w-[160px]'
        }`}
        title={displayName}
      >
        {displayName}
      </span>
      <UserButton
        appearance={{
          elements: {
            avatarBox: compact ? 'w-8 h-8' : 'w-9 h-9',
          },
        }}
      />
    </div>
  );
}
