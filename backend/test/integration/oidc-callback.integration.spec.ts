import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { I18nService } from "nestjs-i18n";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AuthController } from "@/auth/auth.controller";
import { AuthService } from "@/auth/auth.service";
import { OidcService } from "@/auth/oidc/oidc.service";
import { OidcReauthService } from "@/auth/oidc/oidc-reauth.service";
import { IdentitiesService } from "@/auth/identities/identities.service";
import { TokenService } from "@/auth/token.service";
import { EmailService } from "@/notifications/email.service";
import { DemoModeService } from "@/common/demo-mode.service";
import { DelegationService } from "@/delegation/delegation.service";
import { User } from "@/users/entities/user.entity";
import {
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";

// The provider boundary is stubbed; HTTP cookies and the user's persisted status are real.
jest.mock("openid-client", () => ({}));

describe("OIDC callback admission (HTTP + PostgreSQL)", () => {
  let databaseModule: TestingModule;
  let app: INestApplication;
  let dataSource: DataSource;
  let user: User;
  const issueTokens = jest
    .fn()
    .mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
  const exchange = jest.fn().mockResolvedValue({
    access_token: "provider-token",
    sub: "subject",
    iss: "https://issuer.example.com/",
  });

  beforeAll(async () => {
    databaseModule = await createIntegrationModule([]);
    dataSource = databaseModule.get(DataSource);
    user = await createTestUserDirect(dataSource);
    const config = new ConfigService({
      JWT_SECRET: "disposable-oidc-test-key-at-least-32-characters",
      PUBLIC_APP_URL: "http://localhost:3001",
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: DataSource, useValue: dataSource },
        {
          provide: AuthService,
          useValue: {
            findOrCreateOidcUser: async () => ({
              user: await dataSource
                .getRepository(User)
                .findOneByOrFail({ id: user.id }),
            }),
            generateTokenPair: issueTokens,
            oidcTwoFactorChallenge: async () => null,
            getCsrfKey: () => "disposable-csrf-key",
          },
        },
        {
          provide: OidcService,
          useValue: {
            handleCallback: exchange,
            getUserInfo: async () => ({ sub: "subject" }),
          },
        },
        {
          provide: OidcReauthService,
          useValue: {
            readPendingMarker: () => null,
            readLinkMarker: () => null,
          },
        },
        { provide: IdentitiesService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: DemoModeService, useValue: { isDemo: false } },
        {
          provide: TokenService,
          useValue: { getRefreshExpiryMs: () => 86400000 },
        },
        { provide: DelegationService, useValue: {} },
        { provide: I18nService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await databaseModule?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it("issues a session for an active user with all flow cookies", async () => {
    await dataSource.getRepository(User).update(user.id, { isActive: true });
    const response = await request(app.getHttpServer())
      .get("/auth/oidc/callback?code=disposable-code&state=state")
      .set("Cookie", [
        "oidc_state=state",
        "oidc_nonce=nonce",
        "oidc_code_verifier=verifier",
      ])
      .expect(302);
    expect(response.headers.location).toContain("success=true");
    expect(issueTokens).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith(
      expect.any(Object),
      "state",
      "nonce",
      "verifier",
    );
    expect((response.headers["set-cookie"] ?? []).join(";")).toContain(
      "oidc_code_verifier=;",
    );
  });

  it("refuses a persisted inactive user before issuing any session", async () => {
    await dataSource.getRepository(User).update(user.id, { isActive: false });
    const response = await request(app.getHttpServer())
      .get("/auth/oidc/callback?code=disposable-code&state=state")
      .set("Cookie", [
        "oidc_state=state",
        "oidc_nonce=nonce",
        "oidc_code_verifier=verifier",
      ])
      .expect(302);
    expect(response.headers.location).toContain("error=");
    expect(issueTokens).not.toHaveBeenCalled();
    expect((response.headers["set-cookie"] ?? []).join(";")).not.toContain(
      "auth_token=",
    );
  });

  it("refuses a callback missing the PKCE verifier before exchanging its code", async () => {
    await dataSource.getRepository(User).update(user.id, { isActive: true });
    await request(app.getHttpServer())
      .get("/auth/oidc/callback?code=disposable-code&state=state")
      .set("Cookie", ["oidc_state=state", "oidc_nonce=nonce"])
      .expect(302);
    expect(exchange).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });
});
