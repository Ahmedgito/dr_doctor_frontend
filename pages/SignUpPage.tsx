import { useLocation } from 'react-router-dom';
import { SignUp } from '@clerk/react';
import AuthPageLayout from '../components/AuthPageLayout';
import { useClerkAppearance } from '../hooks/useClerkAppearance';

export default function SignUpPage() {
  const location = useLocation();
  const appearance = useClerkAppearance();
  const redirectUrl =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  return (
    <AuthPageLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
        appearance={appearance}
      />
    </AuthPageLayout>
  );
}
