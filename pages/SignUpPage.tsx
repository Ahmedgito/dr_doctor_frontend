import { useLocation } from 'react-router-dom';
import { SignUp } from '@clerk/react';

export default function SignUpPage() {
  const location = useLocation();
  const redirectUrl =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
      />
    </div>
  );
}
