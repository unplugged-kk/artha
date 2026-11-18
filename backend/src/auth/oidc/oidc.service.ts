import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as client from "openid-client";

export interface OidcTokenResult {
  access_token: string;
  sub: string;
  /** "iss" claim, already checked against the discovered issuer. */
  iss: string;
  /** "amr" (Authentication Methods References) claim from the ID token. */
  amr?: string[];
  /** "acr" (Authentication Context Class Reference) claim from the ID token. */
  acr?: string;
  /**
   * "auth_time" claim: when the end-user actually authenticated, in seconds
   * since the epoch. Requested via `max_age`, and what separates a fresh
   * credential prompt from a reused SSO session. Absent when the provider does
   * not supply it, which the re-authentication flow treats as "not fresh"
   * rather than as "fine".
   */
  auth_time?: number;
}

@Injectable()
export class OidcService implements OnModuleInit {
  private config: client.Configuration | null = null;
  private readonly logger = new Logger(OidcService.name);
  private _enabled = false;
  private callbackUrl: string;
  private readonly isAuth0: boolean;
  private readonly logoutRedirect: boolean;
  /** Auth0 connections offered as login buttons; empty for other providers. */
  readonly connections: string[];

  constructor(private configService: ConfigService) {
    this.callbackUrl =
      this.configService.get<string>("OIDC_CALLBACK_URL") ||
      "http://localhost:3001/api/v1/auth/oidc/callback";
    const provider = (
      this.configService.get<string>("OIDC_PROVIDER") || "generic"
    ).toLowerCase();
    if (provider !== "generic" && provider !== "auth0") {
      throw new Error('OIDC_PROVIDER must be "generic" or "auth0"');
    }
    this.isAuth0 = provider === "auth0";
    this.logoutRedirect =
      (
        this.configService.get<string>("OIDC_LOGOUT_REDIRECT") || "false"
      ).toLowerCase() === "true";
    const connections = (
      this.configService.get<string>("OIDC_CONNECTIONS") || ""
    )
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    // `connection` is an Auth0 parameter; a generic provider would ignore it and
    // every button would open the same page.
    if (connections.length > 0 && !this.isAuth0) {
      this.logger.warn(
        "OIDC_CONNECTIONS is ignored unless OIDC_PROVIDER=auth0",
      );
    }
    this.connections = this.isAuth0 ? [...new Set(connections)] : [];
  }

  async onModuleInit() {
    await this.initialize();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  async initialize(): Promise<boolean> {
    const issuerUrl = this.configService.get<string>("OIDC_ISSUER_URL");
    const clientId = this.configService.get<string>("OIDC_CLIENT_ID");
    const clientSecret = this.configService.get<string>("OIDC_CLIENT_SECRET");

    this._enabled = false;
    this.config = null;
    if (!issuerUrl && !clientId && !clientSecret) {
      this.logger.log("OIDC not configured - OIDC login disabled");
      return false;
    }

    if (!issuerUrl || !clientId || !clientSecret) {
      throw new Error(
        "OIDC requires issuer URL, client ID and client secret together",
      );
    }
    for (const [name, value] of [
      ["OIDC_ISSUER_URL", issuerUrl],
      ["OIDC_CALLBACK_URL", this.callbackUrl],
    ]) {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error(`${name} must be an absolute URL`);
      }
      const localCallback =
        name === "OIDC_CALLBACK_URL" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        (!localCallback && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        url.hash ||
        url.search
      ) {
        throw new Error(
          `${name} requires HTTPS (HTTP is allowed only for a loopback callback) without credentials, query or fragment`,
        );
      }
    }

    try {
      this.config = await client.discovery(
        new URL(issuerUrl),
        clientId,
        clientSecret,
      );
      this.logger.log(
        `Discovered OIDC issuer: ${this.config.serverMetadata().issuer}`,
      );

      this._enabled = true;
      this.logger.log("OIDC initialized successfully");
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize OIDC: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate authorization URL for OIDC login.
   *
   * `forceReauthentication` adds `prompt=login` and `max_age=0`, which ask the
   * provider to challenge the user again rather than silently re-using its
   * existing session. That is the whole point of a re-authentication: without it
   * the round trip is a redirect the user never notices, and it proves nothing
   * beyond what the Artha session already proved (P2-005). Both parameters are
   * sent because providers honour them unevenly -- `prompt=login` is the RFC 6749
   * spelling, `max_age=0` the OIDC Core one.
   */
  getAuthorizationUrl(
    state: string,
    nonce: string,
    codeVerifier: string,
    {
      forceReauthentication = false,
      connection,
    }: { forceReauthentication?: boolean; connection?: string } = {},
  ): string {
    if (connection !== undefined && !this.connections.includes(connection)) {
      throw new Error("Unknown OIDC connection");
    }
    if (!this.config) {
      throw new Error("OIDC client not initialized");
    }

    const url = client.buildAuthorizationUrl(this.config, {
      redirect_uri: this.callbackUrl,
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
      code_challenge_method: "S256",
      ...(forceReauthentication ? { prompt: "login", max_age: "0" } : {}),
      ...(connection ? { connection } : {}),
    });

    return url.href;
  }

  /**
   * Where to send the browser after an Artha logout to also end the provider
   * session, or undefined when OIDC_LOGOUT_REDIRECT is off. Uses the discovered
   * RP-initiated logout endpoint, falling back to Auth0's `/v2/logout`. Returns
   * to `<callback origin>/login`, which must be an allowed logout URL at the
   * provider.
   */
  getLogoutUrl(): string | undefined {
    if (!this.config || !this.logoutRedirect) return undefined;
    const returnTo = new URL("/login", this.callbackUrl).href;
    if (this.config.serverMetadata().end_session_endpoint) {
      return client.buildEndSessionUrl(this.config, {
        post_logout_redirect_uri: returnTo,
      }).href;
    }
    if (this.isAuth0) {
      const url = new URL("v2/logout", this.config.serverMetadata().issuer);
      url.searchParams.set("client_id", this.config.clientMetadata().client_id);
      url.searchParams.set("returnTo", returnTo);
      return url.href;
    }
    this.logger.warn(
      "OIDC_LOGOUT_REDIRECT is on but the provider has no end_session_endpoint",
    );
    return undefined;
  }

  /**
   * Handle the callback from the OIDC provider
   */
  async handleCallback(
    params: Record<string, string>,
    state: string,
    nonce: string,
    codeVerifier: string,
  ): Promise<OidcTokenResult> {
    if (!this.config) {
      throw new Error("OIDC client not initialized");
    }

    // Build the full callback URL with query params for v6's authorizationCodeGrant
    const callbackUrl = new URL(this.callbackUrl);
    for (const [key, value] of Object.entries(params)) {
      callbackUrl.searchParams.set(key, value);
    }

    const tokens = await client.authorizationCodeGrant(
      this.config,
      callbackUrl,
      {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: codeVerifier,
      },
    );

    if (!tokens.access_token) {
      throw new Error("No access token received from OIDC provider");
    }

    const claims = tokens.claims();
    if (!claims?.sub) {
      throw new Error("No subject claim in ID token");
    }

    const rawAmr = (claims as Record<string, unknown>).amr;
    const amr = Array.isArray(rawAmr)
      ? rawAmr.filter((v): v is string => typeof v === "string")
      : undefined;
    const rawAcr = (claims as Record<string, unknown>).acr;
    const acr = typeof rawAcr === "string" ? rawAcr : undefined;
    const rawAuthTime = (claims as Record<string, unknown>).auth_time;
    const auth_time =
      typeof rawAuthTime === "number" && Number.isFinite(rawAuthTime)
        ? rawAuthTime
        : undefined;

    return {
      access_token: tokens.access_token,
      sub: claims.sub,
      iss: claims.iss,
      amr,
      acr,
      auth_time,
    };
  }

  /**
   * Get user info from the OIDC provider
   */
  async getUserInfo(
    accessToken: string,
    expectedSubject: string,
  ): Promise<Record<string, unknown>> {
    if (!this.config) {
      throw new Error("OIDC client not initialized");
    }

    const userInfo = await client.fetchUserInfo(
      this.config,
      accessToken,
      expectedSubject,
    );

    return userInfo as unknown as Record<string, unknown>;
  }

  /**
   * Generate an RFC 7636 PKCE code verifier (43 base64url characters)
   */
  generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  /**
   * Generate a random state value for CSRF protection
   */
  generateState(): string {
    return client.randomState();
  }

  /**
   * Generate a random nonce value for replay protection
   */
  generateNonce(): string {
    return client.randomNonce();
  }
}
