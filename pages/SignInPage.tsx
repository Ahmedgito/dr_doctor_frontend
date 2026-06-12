import { useLocation } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import AuthPageLayout from '../components/AuthPageLayout';
import { useClerkAppearance } from '../hooks/useClerkAppearance';

export default function SignInPage() {
  const location = useLocation();
  const appearance = useClerkAppearance();
  const redirectUrl =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  return (
    <AuthPageLayout>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        forceRedirectUrl={redirectUrl}
        appearance={appearance}
      />
    </AuthPageLayout>
  );
}
