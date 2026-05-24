import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ProtectedRoute from './components/ProtectedRoute';

function RootLayout() {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/sign-in"
    >
      <Routes>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<App />} />
        </Route>
      </Routes>
    </ClerkProvider>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <RootLayout />
    </BrowserRouter>
  );
}
