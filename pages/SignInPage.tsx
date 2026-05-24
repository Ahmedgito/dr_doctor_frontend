import { useLocation } from 'react-router-dom';
import { SignIn } from '@clerk/react';

export default function SignInPage() {
  const location = useLocation();
  const redirectUrl =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
