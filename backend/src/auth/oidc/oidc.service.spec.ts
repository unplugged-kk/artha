import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { OidcService } from "./oidc.service";

const mockServerMetadata = jest
  .fn()
  .mockReturnValue({ issuer: "https://issuer.example.com" });

const mockDiscovery = jest.fn().mockResolvedValue({
  serverMetadata: mockServerMetadata,
  clientMetadata: () => ({ client_id: "my-client-id" }),
});

const mockBuildEndSessionUrl = jest.fn(
  (_config: unknown, params: Record<string, string>) =>
    new URL(
      `https://issuer.example.com/oidc/logout?client_id=my-client-id&post_logout_redirect_uri=${encodeURIComponent(params.post_logout_redirect_uri)}`,
    ),
);

const mockBuildAuthorizationUrl = jest.fn().mockReturnValue({
  href: "https://issuer.example.com/auth?scope=openid",
});

const mockAuthorizationCodeGrant = jest.fn().mockResolvedValue({
  access_token: "at-123",
  claims: () => ({ sub: "oidc-user-1" }),
});

const mockFetchUserInfo = jest
  .fn()
  .mockResolvedValue({ sub: "oidc-user-1", email: "user@example.com" });

const mockRandomState = jest.fn().mockReturnValue("random-state-value");
const mockRandomNonce = jest.fn().mockReturnValue("random-nonce-value");

jest.mock("openid-client", () => ({
  discovery: (...args: unknown[]) => mockDiscovery(...args),
  buildEndSessionUrl: (...args: [unknown, Record<string, string>]) =>
    mockBuildEndSessionUrl(...args),
  buildAuthorizationUrl: (...args: unknown[]) =>
    mockBuildAuthorizationUrl(...args),
  authorizationCodeGrant: (...args: unknown[]) =>
    mockAuthorizationCodeGrant(...args),
  fetchUserInfo: (...args: unknown[]) => mockFetchUserInfo(...args),
  randomState: () => mockRandomState(),
  randomNonce: () => mockRandomNonce(),
}));

describe("OidcService", () => {
  let service: OidcService;
  let configService: Record<string, jest.Mock>;

  const fullConfig: Record<string, string> = {
    OIDC_ISSUER_URL: "https://issuer.example.com",
    OIDC_CLIENT_ID: "my-client-id",
    OIDC_CLIENT_SECRET: "my-client-secret",
    OIDC_CALLBACK_URL: "http://localhost:3001/api/v1/auth/oidc/callback",
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string) => fullConfig[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OidcService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<OidcService>(OidcService);
  });

  describe("enabled", () => {
    it("returns false before initialization", () => {
      expect(service.enabled).toBe(false);
    });

    it("returns true after successful initialization", async () => {
      await service.initialize();
      expect(service.enabled).toBe(true);
    });
  });

  describe("initialize()", () => {
    it("leaves OIDC disabled when no credentials are configured", async () => {
      configService.get.mockReturnValue(undefined);
      expect(await service.initialize()).toBe(false);
      expect(service.enabled).toBe(false);
    });

    it.each([
      "http://issuer.example.com",
      "https://user:password@issuer.example.com",
      "https://issuer.example.com/#fragment",
      "not-a-url",
    ])("rejects an unsafe issuer URL without discovery: %s", async (issuer) => {
      configService.get.mockImplementation((key: string) =>
        key === "OIDC_ISSUER_URL" ? issuer : fullConfig[key],
      );
      await expect(service.initialize()).rejects.toThrow("OIDC_ISSUER_URL");
      expect(mockDiscovery).not.toHaveBeenCalled();
    });

    it("disables an earlier client if rediscovery fails", async () => {
      await service.initialize();
      mockDiscovery.mockRejectedValueOnce(new Error("offline"));
      expect(await service.initialize()).toBe(false);
      expect(service.enabled).toBe(false);
      expect(() => service.getAuthorizationUrl("s", "n", "v")).toThrow(
        "not initialized",
      );
    });

    it("discovers the OIDC issuer and creates a configuration", async () => {
      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockDiscovery).toHaveBeenCalledWith(
        expect.any(URL),
        "my-client-id",
        "my-client-secret",
      );
      expect(service.enabled).toBe(true);
    });

    it("rejects partial configuration when OIDC_ISSUER_URL is not configured", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "OIDC_ISSUER_URL") return undefined;
        return fullConfig[key];
      });

      await expect(service.initialize()).rejects.toThrow("OIDC requires");
      expect(service.enabled).toBe(false);
      expect(mockDiscovery).not.toHaveBeenCalled();
    });

    it("rejects partial configuration when OIDC_CLIENT_ID is not configured", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "OIDC_CLIENT_ID") return undefined;
        return fullConfig[key];
      });

      await expect(service.initialize()).rejects.toThrow("OIDC requires");
      expect(service.enabled).toBe(false);
    });

    it("rejects partial configuration when OIDC_CLIENT_SECRET is not configured", async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === "OIDC_CLIENT_SECRET") return undefined;
        return fullConfig[key];
      });

      await expect(service.initialize()).rejects.toThrow("OIDC requires");
      expect(service.enabled).toBe(false);
    });

    it("returns false and logs error when discovery fails", async () => {
      mockDiscovery.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(service.enabled).toBe(false);
    });
  });

  it("generates independent RFC 7636 verifiers", () => {
    const first = service.generateCodeVerifier();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(service.generateCodeVerifier()).not.toBe(first);
  });

  describe("getAuthorizationUrl()", () => {
    it("throws when client is not initialized", () => {
      expect(() =>
        service.getAuthorizationUrl("state-1", "nonce-1", "verifier"),
      ).toThrow("OIDC client not initialized");
    });

    it("returns authorization URL after initialization", async () => {
      await service.initialize();

      const url = service.getAuthorizationUrl("state-1", "nonce-1", "verifier");

      expect(url).toBe("https://issuer.example.com/auth?scope=openid");
      expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(
        expect.anything(),
        {
          redirect_uri: "http://localhost:3001/api/v1/auth/oidc/callback",
          scope: "openid profile email",
          state: "state-1",
          nonce: "nonce-1",
          code_challenge: "iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ",
          code_challenge_method: "S256",
        },
      );
    });
  });

  describe("handleCallback()", () => {
    it("throws when client is not initialized", async () => {
      await expect(
        service.handleCallback(
          { code: "abc" },
          "state-1",
          "nonce-1",
          "verifier",
        ),
      ).rejects.toThrow("OIDC client not initialized");
    });

    it("exchanges the authorization code for tokens", async () => {
      await service.initialize();

      const result = await service.handleCallback(
        { code: "auth-code-123" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result).toEqual({
        access_token: "at-123",
        sub: "oidc-user-1",
      });
      expect(mockAuthorizationCodeGrant).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(URL),
        {
          expectedState: "state-1",
          expectedNonce: "nonce-1",
          pkceCodeVerifier: "verifier",
        },
      );
    });

    it("throws when no access token is received", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: undefined,
        claims: () => ({ sub: "oidc-user-1" }),
      });

      await expect(
        service.handleCallback(
          { code: "abc" },
          "state-1",
          "nonce-1",
          "verifier",
        ),
      ).rejects.toThrow("No access token received from OIDC provider");
    });

    it("throws when no subject claim in ID token", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => undefined,
      });

      await expect(
        service.handleCallback(
          { code: "abc" },
          "state-1",
          "nonce-1",
          "verifier",
        ),
      ).rejects.toThrow("No subject claim in ID token");
    });
  });

  describe("getUserInfo()", () => {
    it("throws when client is not initialized", async () => {
      await expect(
        service.getUserInfo("access-token", "sub-1"),
      ).rejects.toThrow("OIDC client not initialized");
    });

    it("returns user info from the OIDC provider", async () => {
      await service.initialize();

      const userInfo = await service.getUserInfo(
        "access-token-123",
        "oidc-user-1",
      );

      expect(userInfo).toEqual({
        sub: "oidc-user-1",
        email: "user@example.com",
      });
      expect(mockFetchUserInfo).toHaveBeenCalledWith(
        expect.anything(),
        "access-token-123",
        "oidc-user-1",
      );
    });
  });

  describe("generateState()", () => {
    it("returns a random state value", () => {
      const state = service.generateState();
      expect(state).toBe("random-state-value");
      expect(mockRandomState).toHaveBeenCalled();
    });
  });

  describe("generateNonce()", () => {
    it("returns a random nonce value", () => {
      const nonce = service.generateNonce();
      expect(nonce).toBe("random-nonce-value");
      expect(mockRandomNonce).toHaveBeenCalled();
    });
  });

  describe("handleCallback() amr/acr handling", () => {
    it("returns amr when claim is a string array", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          amr: ["pwd", "mfa"],
          acr: "urn:level:2",
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.amr).toEqual(["pwd", "mfa"]);
      expect(result.acr).toBe("urn:level:2");
    });

    it("filters out non-string entries from amr arrays", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          amr: ["pwd", 123, null, "mfa"],
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.amr).toEqual(["pwd", "mfa"]);
    });

    it("returns undefined amr when the claim is not an array", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          amr: "not-an-array",
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.amr).toBeUndefined();
    });

    it("returns undefined acr when the claim is not a string", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          acr: 5,
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.acr).toBeUndefined();
    });

    it("returns auth_time when the claim is a number", async () => {
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          auth_time: 1_700_000_000,
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.auth_time).toBe(1_700_000_000);
    });

    it("returns undefined auth_time when the claim is absent or malformed", async () => {
      // The freshness check downstream treats undefined as "not fresh", so a
      // provider sending a string here must not smuggle one through.
      await service.initialize();
      mockAuthorizationCodeGrant.mockResolvedValueOnce({
        access_token: "at-123",
        claims: () => ({
          sub: "oidc-user-1",
          auth_time: "1700000000",
        }),
      });

      const result = await service.handleCallback(
        { code: "abc" },
        "state-1",
        "nonce-1",
        "verifier",
      );

      expect(result.auth_time).toBeUndefined();
    });
  });

  describe("onModuleInit()", () => {
    it("invokes initialize() on module bootstrap", async () => {
      await service.onModuleInit();
      expect(mockDiscovery).toHaveBeenCalled();
    });
  });

  describe("Auth0 extras", () => {
    async function make(extra: Record<string, string>) {
      const cfg = { ...fullConfig, ...extra };
      const svc = new OidcService({
        get: (key: string) => cfg[key],
      } as unknown as ConfigService);
      await svc.initialize();
      return svc;
    }

    it("rejects an unknown OIDC_PROVIDER", () => {
      expect(
        () =>
          new OidcService({
            get: (k: string) => ({ ...fullConfig, OIDC_PROVIDER: "okta" })[k],
          } as unknown as ConfigService),
      ).toThrow("OIDC_PROVIDER");
    });

    it("parses OIDC_CONNECTIONS for Auth0 and ignores it otherwise", async () => {
      const auth0 = await make({
        OIDC_PROVIDER: "auth0",
        OIDC_CONNECTIONS: " google-oauth2, ,github,google-oauth2 ",
      });
      expect(auth0.connections).toEqual(["google-oauth2", "github"]);

      const generic = await make({ OIDC_CONNECTIONS: "google-oauth2" });
      expect(generic.connections).toEqual([]);
    });

    it("adds a configured connection to the authorization URL and refuses others", async () => {
      const svc = await make({
        OIDC_PROVIDER: "auth0",
        OIDC_CONNECTIONS: "google-oauth2",
      });

      svc.getAuthorizationUrl("s", "n", "v", { connection: "google-oauth2" });
      expect(mockBuildAuthorizationUrl).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ connection: "google-oauth2" }),
      );
      expect(() =>
        svc.getAuthorizationUrl("s", "n", "v", { connection: "github" }),
      ).toThrow("Unknown OIDC connection");
    });

    it("returns no logout URL unless OIDC_LOGOUT_REDIRECT is true", async () => {
      expect((await make({})).getLogoutUrl()).toBeUndefined();
    });

    it("uses the discovered end_session_endpoint, returning to /login", async () => {
      mockServerMetadata.mockReturnValue({
        issuer: "https://issuer.example.com/",
        end_session_endpoint: "https://issuer.example.com/oidc/logout",
      });
      const svc = await make({ OIDC_LOGOUT_REDIRECT: "true" });

      expect(svc.getLogoutUrl()).toContain("/oidc/logout");
      expect(mockBuildEndSessionUrl).toHaveBeenCalledWith(expect.anything(), {
        post_logout_redirect_uri: "http://localhost:3001/login",
      });
    });

    it("falls back to Auth0 /v2/logout without an end_session_endpoint", async () => {
      mockServerMetadata.mockReturnValue({
        issuer: "https://tenant.auth0.com/",
      });
      const auth0 = await make({
        OIDC_PROVIDER: "auth0",
        OIDC_LOGOUT_REDIRECT: "true",
      });
      const url = new URL(auth0.getLogoutUrl()!);
      expect(url.origin + url.pathname).toBe(
        "https://tenant.auth0.com/v2/logout",
      );
      expect(url.searchParams.get("client_id")).toBe("my-client-id");
      expect(url.searchParams.get("returnTo")).toBe(
        "http://localhost:3001/login",
      );

      const generic = await make({ OIDC_LOGOUT_REDIRECT: "true" });
      expect(generic.getLogoutUrl()).toBeUndefined();
    });

    afterEach(() => {
      mockServerMetadata.mockReturnValue({
        issuer: "https://issuer.example.com",
      });
    });
  });
});
