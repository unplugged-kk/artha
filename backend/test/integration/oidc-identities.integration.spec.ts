import { TestingModule } from "@nestjs/testing";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { AuthService } from "@/auth/auth.service";
import { IdentitiesService } from "@/auth/identities/identities.service";
import { OidcAccountExistsError } from "@/auth/oidc/oidc-errors";
import {
  LEGACY_IDENTITY_ISSUER,
  UserIdentity,
} from "@/auth/entities/user-identity.entity";
import { User } from "@/users/entities/user.entity";
import { UserPreference } from "@/users/entities/user-preference.entity";
import { withUserContext } from "@/common/db/with-context";
import {
  createIntegrationModule,
  createTestUserDirect,
} from "../helpers/integration-setup";

const ISSUER = "https://artha-dev.example.auth0.com/";
const OTHER_ISSUER = "https://other-idp.example.com/";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe("OIDC identities (PostgreSQL)", () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let auth: AuthService;
  let identities: IdentitiesService;
  let config: Record<string, string>;
  const validateTrustedDevice = jest.fn();

  beforeAll(async () => {
    module = await createIntegrationModule([]);
    dataSource = module.get(DataSource);
    config = {
      JWT_SECRET: "disposable-identity-test-key-at-least-32-chars",
    };
    const configService = {
      get: (key: string, fallback?: string) => config[key] ?? fallback,
    } as unknown as ConfigService;
    const jwt = new JwtService({ secret: config.JWT_SECRET });
    const unused = {} as never;
    auth = new AuthService(
      jwt,
      configService,
      dataSource,
      unused,
      unused,
      unused,
      { validateTrustedDevice } as never,
      unused,
      unused,
      unused,
      unused,
    );
    identities = new IdentitiesService(dataSource, configService);
  });

  afterAll(async () => {
    await module?.close();
  });

  beforeEach(() => {
    delete config.OIDC_REQUIRE_VERIFIED_EMAIL;
    delete config.LOCAL_AUTH_ENABLED;
    validateTrustedDevice.mockReset();
  });

  const identityRows = (userId: string) =>
    dataSource.getRepository(UserIdentity).find({ where: { userId } });

  describe("login resolution", () => {
    it("creates an SSO account and its identity, and finds it again by (issuer, subject)", async () => {
      const sub = unique("google-oauth2|new");
      const email = `${unique("new")}@example.com`;
      const first = await auth.findOrCreateOidcUser(
        { sub, email, email_verified: true, given_name: "Asha" },
        true,
        ISSUER,
      );
      expect(first.isNewUser).toBe(true);
      expect(first.user).toMatchObject({
        email,
        firstName: "Asha",
        authProvider: "oidc",
        oidcSubject: sub,
      });
      expect(await identityRows(first.user.id)).toEqual([
        expect.objectContaining({
          issuer: ISSUER,
          subject: sub,
          provider: "google-oauth2",
        }),
      ]);
      const prefs = await dataSource
        .getRepository(UserPreference)
        .findOne({ where: { userId: first.user.id } });
      expect(prefs).not.toBeNull();

      const again = await auth.findOrCreateOidcUser(
        { sub, email, email_verified: true },
        false,
        ISSUER,
      );
      expect(again.isNewUser).toBe(false);
      expect(again.user.id).toBe(first.user.id);
    });

    it("treats the same subject from a different issuer as a different identity", async () => {
      const sub = unique("auth0|shared");
      const a = await auth.findOrCreateOidcUser({ sub }, true, ISSUER);
      const b = await auth.findOrCreateOidcUser({ sub }, true, OTHER_ISSUER);
      expect(b.user.id).not.toBe(a.user.id);
      expect(await identityRows(a.user.id)).toHaveLength(1);
    });

    it("refuses an unknown identity whose verified email belongs to a password account, and changes nothing", async () => {
      const existing = await createTestUserDirect(dataSource);
      const sub = unique("google-oauth2|intruder");
      await expect(
        auth.findOrCreateOidcUser(
          { sub, email: existing.email, email_verified: true },
          true,
          ISSUER,
        ),
      ).rejects.toBeInstanceOf(OidcAccountExistsError);
      const after = await dataSource
        .getRepository(User)
        .findOneByOrFail({ id: existing.id });
      expect(after.authProvider).toBe("local");
      expect(after.oidcSubject).toBeNull();
      expect(await identityRows(existing.id)).toEqual([]);
    });

    it("refuses an unknown identity whose verified email belongs to an SSO-only account (no takeover by email)", async () => {
      const email = `${unique("sso")}@example.com`;
      const owner = await auth.findOrCreateOidcUser(
        { sub: unique("google-oauth2|owner"), email, email_verified: true },
        true,
        ISSUER,
      );
      await expect(
        auth.findOrCreateOidcUser(
          { sub: unique("linkedin|other"), email, email_verified: true },
          true,
          ISSUER,
        ),
      ).rejects.toBeInstanceOf(OidcAccountExistsError);
      expect(await identityRows(owner.user.id)).toHaveLength(1);
    });

    it("by default stores no unverified email on a new account", async () => {
      const existing = await createTestUserDirect(dataSource);
      const result = await auth.findOrCreateOidcUser(
        { sub: unique("auth0|unverified"), email: existing.email },
        true,
        ISSUER,
      );
      expect(result.user.id).not.toBe(existing.id);
      expect(result.user.email).toBeNull();
    });

    it("with OIDC_REQUIRE_VERIFIED_EMAIL=false stores an unverified email, but still never merges", async () => {
      config.OIDC_REQUIRE_VERIFIED_EMAIL = "false";
      const email = `${unique("unverified")}@example.com`;
      const created = await auth.findOrCreateOidcUser(
        { sub: unique("auth0|a"), email },
        true,
        ISSUER,
      );
      expect(created.user.email).toBe(email);
      await expect(
        auth.findOrCreateOidcUser(
          { sub: unique("auth0|b"), email },
          true,
          ISSUER,
        ),
      ).rejects.toBeInstanceOf(OidcAccountExistsError);
    });

    it("refuses a new account when registration is closed", async () => {
      await expect(
        auth.findOrCreateOidcUser(
          { sub: unique("auth0|closed") },
          false,
          ISSUER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("upgrades a backfilled 'legacy' identity to the real issuer on first login", async () => {
      const user = await createTestUserDirect(dataSource);
      const sub = unique("google-oauth2|legacy");
      await dataSource.getRepository(UserIdentity).save({
        userId: user.id,
        issuer: LEGACY_IDENTITY_ISSUER,
        subject: sub,
      });
      const result = await auth.findOrCreateOidcUser({ sub }, false, ISSUER);
      expect(result.user.id).toBe(user.id);
      const [row] = await identityRows(user.id);
      expect(row.issuer).toBe(ISSUER);
      expect(row.lastLoginAt).toBeInstanceOf(Date);
    });

    it("finds an account that has only users.oidc_subject (written by an older replica)", async () => {
      const user = await createTestUserDirect(dataSource);
      const sub = unique("auth0|column-only");
      await dataSource
        .getRepository(User)
        .update(user.id, { oidcSubject: sub });
      const result = await auth.findOrCreateOidcUser({ sub }, false, ISSUER);
      expect(result.user.id).toBe(user.id);
      expect(await identityRows(user.id)).toEqual([
        expect.objectContaining({ issuer: ISSUER, subject: sub }),
      ]);
    });

    it("keeps app-level TOTP on an OIDC login and asks for it", async () => {
      const sub = unique("google-oauth2|totp");
      const { user } = await auth.findOrCreateOidcUser({ sub }, true, ISSUER);
      await dataSource
        .getRepository(User)
        .update(user.id, { twoFactorSecret: "encrypted-secret" });
      await dataSource
        .getRepository(UserPreference)
        .update({ userId: user.id }, { twoFactorEnabled: true });

      const again = await auth.findOrCreateOidcUser({ sub }, false, ISSUER);
      expect(again.user.twoFactorSecret).toBe("encrypted-secret");

      const token = await auth.oidcTwoFactorChallenge(again.user);
      expect(token).toEqual(expect.any(String));

      validateTrustedDevice.mockResolvedValue(true);
      expect(
        await auth.oidcTwoFactorChallenge(again.user, "device-ref", "agent"),
      ).toBeNull();
    });

    it("asks for no TOTP when the account has none", async () => {
      const { user } = await auth.findOrCreateOidcUser(
        { sub: unique("auth0|no-totp") },
        true,
        ISSUER,
      );
      expect(await auth.oidcTwoFactorChallenge(user)).toBeNull();
    });

    it("follows a verified email change only while the account has a single identity", async () => {
      const sub = unique("google-oauth2|sync");
      const { user } = await auth.findOrCreateOidcUser(
        { sub, email: `${unique("before")}@example.com`, email_verified: true },
        true,
        ISSUER,
      );
      const changed = `${unique("after")}@example.com`;
      const single = await auth.findOrCreateOidcUser(
        { sub, email: changed, email_verified: true },
        false,
        ISSUER,
      );
      expect(single.user.email).toBe(changed);

      await identities.attach(user.id, ISSUER, unique("linkedin|second"));
      const multi = await auth.findOrCreateOidcUser(
        {
          sub,
          email: `${unique("ignored")}@example.com`,
          email_verified: true,
        },
        false,
        ISSUER,
      );
      expect(multi.user.email).toBe(changed);
    });
  });

  describe("linking", () => {
    it("attaches a new identity, and that identity then signs in to the same account", async () => {
      const user = await createTestUserDirect(dataSource);
      const sub = unique("google-oauth2|linked");
      expect(await identities.attach(user.id, ISSUER, sub)).toBe("linked");
      const login = await auth.findOrCreateOidcUser(
        { sub, email: user.email, email_verified: true },
        false,
        ISSUER,
      );
      expect(login.user.id).toBe(user.id);
      expect(login.user.authProvider).toBe("local");
      expect(await identities.attach(user.id, ISSUER, sub)).toBe(
        "already_linked",
      );
    });

    it("refuses an identity that already belongs to another account", async () => {
      const sub = unique("google-oauth2|taken");
      await auth.findOrCreateOidcUser({ sub }, true, ISSUER);
      const other = await createTestUserDirect(dataSource);
      expect(await identities.attach(other.id, ISSUER, sub)).toBe(
        "identity_in_use",
      );
      expect(await identityRows(other.id)).toEqual([]);
    });

    it("refuses an identity another account holds only in users.oidc_subject", async () => {
      const holder = await createTestUserDirect(dataSource);
      const sub = unique("auth0|column-held");
      await dataSource
        .getRepository(User)
        .update(holder.id, { oidcSubject: sub });
      const other = await createTestUserDirect(dataSource);
      expect(await identities.attach(other.id, ISSUER, sub)).toBe(
        "identity_in_use",
      );
    });

    it("lists only the caller's identities, under the caller's RLS context", async () => {
      const user = await createTestUserDirect(dataSource);
      await identities.attach(user.id, ISSUER, unique("google-oauth2|list"));
      const listed = await withUserContext(user.id, () =>
        identities.list(user.id),
      );
      expect(listed).toEqual([
        {
          id: expect.any(String),
          provider: "google-oauth2",
          createdAt: expect.any(Date),
          lastLoginAt: null,
        },
      ]);
      expect(listed[0]).not.toHaveProperty("subject");
    });
  });

  describe("unlinking", () => {
    it("removes an identity from a password account, and that identity no longer signs in", async () => {
      const user = await createTestUserDirect(dataSource);
      const sub = unique("google-oauth2|unlink");
      await identities.attach(user.id, ISSUER, sub);
      const [row] = await identityRows(user.id);
      await withUserContext(user.id, () => identities.unlink(user.id, row.id));
      expect(await identityRows(user.id)).toEqual([]);
      await expect(
        auth.findOrCreateOidcUser(
          { sub, email: user.email, email_verified: true },
          true,
          ISSUER,
        ),
      ).rejects.toBeInstanceOf(OidcAccountExistsError);
    });

    it("refuses to remove the only sign-in method of an SSO-only account", async () => {
      const { user } = await auth.findOrCreateOidcUser(
        { sub: unique("google-oauth2|only") },
        true,
        ISSUER,
      );
      const [row] = await identityRows(user.id);
      await expect(
        withUserContext(user.id, () => identities.unlink(user.id, row.id)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await identityRows(user.id)).toHaveLength(1);
    });

    it("does not count a password while local login is disabled", async () => {
      config.LOCAL_AUTH_ENABLED = "false";
      const user = await createTestUserDirect(dataSource);
      await identities.attach(user.id, ISSUER, unique("google-oauth2|sole"));
      const [row] = await identityRows(user.id);
      await expect(
        withUserContext(user.id, () => identities.unlink(user.id, row.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("clears users.oidc_subject so the column fallback cannot sign the identity back in", async () => {
      const sub = unique("google-oauth2|first");
      const { user } = await auth.findOrCreateOidcUser({ sub }, true, ISSUER);
      await identities.attach(user.id, ISSUER, unique("linkedin|keep"));
      const removed = (await identityRows(user.id)).find(
        (row) => row.subject === sub,
      )!;
      await withUserContext(user.id, () =>
        identities.unlink(user.id, removed.id),
      );
      const after = await dataSource
        .getRepository(User)
        .findOneByOrFail({ id: user.id });
      expect(after.oidcSubject).toBeNull();
      const relogin = await auth.findOrCreateOidcUser({ sub }, true, ISSUER);
      expect(relogin.user.id).not.toBe(user.id);
    });

    it("cannot remove another account's identity", async () => {
      const owner = await createTestUserDirect(dataSource);
      await identities.attach(owner.id, ISSUER, unique("google-oauth2|mine"));
      const [row] = await identityRows(owner.id);
      const attacker = await createTestUserDirect(dataSource);
      await expect(
        withUserContext(attacker.id, () =>
          identities.unlink(attacker.id, row.id),
        ),
      ).rejects.toThrow("Sign-in method not found");
      expect(await identityRows(owner.id)).toHaveLength(1);
    });
  });
});
