import type { ClerkAppearanceTheme } from '@clerk/shared/types';

const FONT = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

/**
 * Clerk appearance aligned with dr.doctor (teal accent, slate surfaces, glass panels).
 */
export function getClerkAppearance(isDark: boolean): ClerkAppearanceTheme {
  if (isDark) {
    return {
      variables: {
        fontFamily: FONT,
        fontFamilyButtons: FONT,
        borderRadius: '0.75rem',
        colorPrimary: '#14b8a6',
        colorDanger: '#f87171',
        colorSuccess: '#2dd4bf',
        colorWarning: '#fbbf24',
        colorBackground: '#0f172a',
        colorInputBackground: 'rgba(255, 255, 255, 0.06)',
        colorInputText: '#f1f5f9',
        colorText: '#f1f5f9',
        colorTextSecondary: '#94a3b8',
        colorNeutral: '#64748b',
      },
      elements: {
        rootBox: 'font-sans',
        card: 'rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl',
        headerTitle: 'text-slate-100',
        headerSubtitle: 'text-slate-400',
        socialButtonsBlockButton:
          'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 rounded-xl',
        socialButtonsBlockButtonText: 'text-slate-100 font-medium',
        dividerLine: 'bg-white/10',
        dividerText: 'text-slate-500',
        formFieldLabel: 'text-slate-300',
        formFieldInput:
          'rounded-xl border border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-teal-500/20',
        formButtonPrimary:
          'rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30',
        footerActionText: 'text-slate-400',
        footerActionLink: 'text-teal-400 hover:text-teal-300',
        identityPreviewText: 'text-slate-200',
        identityPreviewEditButton: 'text-teal-400',
        formResendCodeLink: 'text-teal-400',
        otpCodeFieldInput: 'border-white/10 bg-white/5 text-slate-100',
        alertText: 'text-slate-300',
        userButtonPopoverCard:
          'rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl',
        userButtonPopoverActionButton:
          'rounded-lg text-slate-200 hover:bg-white/10 focus:bg-white/10',
        userButtonPopoverActionButtonText: 'text-slate-200',
        userButtonPopoverActionButtonIcon: 'text-slate-400',
        userButtonPopoverFooter: 'border-t border-white/10 bg-white/[0.02]',
        userPreviewMainIdentifier: 'text-slate-100 font-semibold',
        userPreviewSecondaryIdentifier: 'text-slate-400',
        userButtonAvatarBox: 'ring-2 ring-teal-500/30',
      },
    };
  }

  return {
    variables: {
      fontFamily: FONT,
      fontFamilyButtons: FONT,
      borderRadius: '0.75rem',
      colorPrimary: '#0d9488',
      colorDanger: '#dc2626',
      colorSuccess: '#0d9488',
      colorWarning: '#d97706',
      colorBackground: '#ffffff',
      colorInputBackground: '#f8fafc',
      colorInputText: '#1e293b',
      colorText: '#1e293b',
      colorTextSecondary: '#64748b',
      colorNeutral: '#94a3b8',
    },
    elements: {
      rootBox: 'font-sans',
      card: 'rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl',
      headerTitle: 'text-slate-800',
      headerSubtitle: 'text-slate-500',
      socialButtonsBlockButton:
        'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl',
      socialButtonsBlockButtonText: 'text-slate-800 font-medium',
      dividerLine: 'bg-slate-200',
      dividerText: 'text-slate-500',
      formFieldLabel: 'text-slate-700',
      formFieldInput:
        'rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-teal-500/50 focus:ring-teal-500/20',
      formButtonPrimary:
        'rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/20',
      footerActionText: 'text-slate-500',
      footerActionLink: 'text-teal-600 hover:text-teal-500',
      identityPreviewText: 'text-slate-800',
      identityPreviewEditButton: 'text-teal-600',
      formResendCodeLink: 'text-teal-600',
      otpCodeFieldInput: 'border-slate-200 bg-slate-50 text-slate-900',
      alertText: 'text-slate-600',
      userButtonPopoverCard:
        'rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl',
      userButtonPopoverActionButton:
        'rounded-lg text-slate-700 hover:bg-slate-100 focus:bg-slate-100',
      userButtonPopoverActionButtonText: 'text-slate-700',
      userButtonPopoverActionButtonIcon: 'text-slate-500',
      userButtonPopoverFooter: 'border-t border-slate-100 bg-slate-50/50',
      userPreviewMainIdentifier: 'text-slate-800 font-semibold',
      userPreviewSecondaryIdentifier: 'text-slate-500',
      userButtonAvatarBox: 'ring-2 ring-teal-500/20',
    },
  };
}
