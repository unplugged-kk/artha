import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { IdentitiesController } from "./identities.controller";
import { IdentitiesService } from "./identities.service";
import { OidcReauthService } from "../oidc/oidc-reauth.service";
import { OidcService } from "../oidc/oidc.service";
import { REQUIRE_STEP_UP_KEY } from "../step-up/require-step-up.decorator";
import { StepUpGuard } from "../step-up/step-up.guard";

const USER = "11111111-1111-4111-8111-111111111111";

describe("IdentitiesController", () => {
  const originalSecret = process.env.JWT_SECRET;
  let oidc: Record<string, jest.Mock | boolean>;
  let identities: Record<string, jest.Mock>;
  let reauth: OidcReauthService;
  let controller: IdentitiesController;

  beforeEach(() => {
    process.env.JWT_SECRET = "spec-jwt-secret-of-at-least-32-characters";
    oidc = {
      enabled: true,
      generateState: jest.fn().mockReturnValue("state-1"),
      generateNonce: jest.fn().mockReturnValue("nonce-1"),
      generateCodeVerifier: jest.fn().mockReturnValue("verifier-1"),
      getAuthorizationUrl: jest
        .fn()
        .mockReturnValue("https://tenant.example/authorize?x=1"),
    };
    identities = { list: jest.fn(), unlink: jest.fn() };
    reauth = new OidcReauthService({} as never);
    controller = new IdentitiesController(
      identities as unknown as IdentitiesService,
      oidc as unknown as OidcService,
      reauth,
      { get: (_k: string, d?: string) => d } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  const mockRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

  it("starts a forced-login round trip carrying a link marker bound to its state", () => {
    const res = mockRes();
    const result = controller.startLink({ user: { id: USER } }, res as never);
    expect(result).toEqual({ url: "https://tenant.example/authorize?x=1" });
    expect(oidc.getAuthorizationUrl).toHaveBeenCalledWith(
      "state-1",
      "nonce-1",
      "verifier-1",
      { forceReauthentication: true },
    );
    const cookies = Object.fromEntries(
      res.cookie.mock.calls.map(([name, value]) => [name, value]),
    );
    expect(cookies).toMatchObject({
      oidc_state: "state-1",
      oidc_nonce: "nonce-1",
      oidc_code_verifier: "verifier-1",
    });
    expect(reauth.readLinkMarker(cookies.oidc_link, "state-1")).toBe(USER);
    expect(res.cookie).toHaveBeenCalledWith(
      "oidc_link",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "oidc_reauth",
      expect.anything(),
    );
  });

  it("refuses to start when OIDC is not configured", () => {
    oidc.enabled = false;
    expect(() =>
      controller.startLink({ user: { id: USER } }, mockRes() as never),
    ).toThrow(BadRequestException);
  });

  it.each(["startLink", "unlink"] as const)(
    "%s requires a manage-identities step-up",
    (handler) => {
      const reflector = new Reflector();
      const method = IdentitiesController.prototype[handler];
      expect(reflector.get(REQUIRE_STEP_UP_KEY, method)).toBe(
        "manage-identities",
      );
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toContain(
        StepUpGuard,
      );
    },
  );

  it("lists and unlinks for the signed-in user only", async () => {
    identities.list.mockResolvedValue([]);
    await controller.list({ user: { id: USER } });
    expect(identities.list).toHaveBeenCalledWith(USER);
    await controller.unlink({ user: { id: USER } }, "identity-1");
    expect(identities.unlink).toHaveBeenCalledWith(USER, "identity-1");
  });
});
