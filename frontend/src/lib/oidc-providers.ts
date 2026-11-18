/**
 * Provider connection names (as the identity provider reports them in
 * `GET /auth/methods` `oidcConnections` and on linked identities) mapped to the
 * brand a person recognises. Brand names are proper nouns and stay untranslated;
 * the sentence around them ("Continue with {provider}") is in the catalogs.
 */
const BRANDS: Record<string, string> = {
  'google-oauth2': 'Google',
  linkedin: 'LinkedIn',
  twitter: 'X',
  apple: 'Apple',
  github: 'GitHub',
  windowslive: 'Microsoft',
};

/** The provider's own email-and-password database connection. */
export const EMAIL_CONNECTION = 'Username-Password-Authentication';

/**
 * Whether a connection (or an identity's provider) is the provider's email and
 * password store. Identities report it as `auth0`, connections by name.
 */
export function isEmailConnection(connection: string): boolean {
  return connection === EMAIL_CONNECTION || connection === 'auth0';
}

/** Brand name for a known connection, or the connection name itself. */
export function oidcProviderBrand(connection: string): string {
  return BRANDS[connection] ?? connection;
}
