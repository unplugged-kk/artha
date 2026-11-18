'use client';

import { useTranslations } from 'next-intl';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { isEmailConnection, oidcProviderBrand } from '@/lib/oidc-providers';

interface OidcSignInButtonsProps {
  /** Provider connections from `GET /auth/methods`; empty keeps the single SSO button. */
  connections: string[];
  variant: 'primary' | 'outline';
  onSelect: (connection?: string) => void;
}

function LockIcon() {
  return (
    <svg
      className="w-5 h-5 mr-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Brand marks drawn inline: nothing is fetched from a third party. */
function ProviderIcon({ connection }: { connection: string }) {
  const className = 'w-5 h-5 mr-2 shrink-0';
  if (isEmailConnection(connection)) {
    return <EnvelopeIcon className={className} aria-hidden="true" />;
  }
  if (connection === 'google-oauth2') {
    return (
      <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    );
  }
  if (connection === 'windowslive') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
      </svg>
    );
  }
  if (connection === 'twitter') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  // shortcut: a monogram stands in for brands without a bundled mark (Apple,
  // GitHub, LinkedIn, custom connections); add a glyph here if one is wanted.
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-100`}
    >
      {oidcProviderBrand(connection).charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The login page's provider buttons: one per configured connection, each
 * preselecting it, or today's single SSO button when none are configured.
 */
export function OidcSignInButtons({ connections, variant, onSelect }: OidcSignInButtonsProps) {
  const t = useTranslations('auth');

  if (connections.length === 0) {
    return (
      <Button type="button" variant={variant} size="lg" onClick={() => onSelect()} className="w-full">
        <LockIcon />
        {t('signIn.ssoButton')}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <Button
          key={connection}
          type="button"
          variant={variant}
          size="lg"
          onClick={() => onSelect(connection)}
          className="w-full"
        >
          <ProviderIcon connection={connection} />
          {isEmailConnection(connection)
            ? t('signIn.continueWithEmail')
            : t('signIn.continueWith', { provider: oidcProviderBrand(connection) })}
        </Button>
      ))}
    </div>
  );
}
