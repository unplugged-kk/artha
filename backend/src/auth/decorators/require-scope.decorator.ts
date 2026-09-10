import { SetMetadata } from "@nestjs/common";

export const REQUIRE_SCOPE_KEY = "require_scope";

/**
 * Decorator that specifies required PAT scopes for an endpoint.
 * When a request is authenticated via PAT (Personal Access Token),
 * the guard checks that the token has all required scopes.
 * JWT-authenticated requests bypass scope checks.
 */
export const RequireScope = (...scopes: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, scopes);
