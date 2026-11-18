import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource, EntityManager } from "typeorm";
import { withScopedDb } from "../../common/db/scoped-db";
import { tr } from "../../i18n/translate";
import { User } from "../../users/entities/user.entity";
import {
  LEGACY_IDENTITY_ISSUER,
  providerFromSubject,
  UserIdentity,
} from "../entities/user-identity.entity";

export interface IdentitySummary {
  id: string;
  /** Auth0 connection ("google-oauth2"), or null for a non-Auth0 provider. */
  provider: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/** What the link round trip did, as the callback reports it to the SPA. */
export type LinkOutcome = "linked" | "already_linked" | "identity_in_use";

/**
 * Explicit linking and unlinking of sign-in identities (D4). Nothing here runs
 * on an ordinary login: login resolves identities, it never attaches them.
 */
@Injectable()
export class IdentitiesService {
  private readonly logger = new Logger(IdentitiesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async list(userId: string): Promise<IdentitySummary[]> {
    const rows = await withScopedDb(this.dataSource, (manager) =>
      manager.getRepository(UserIdentity).find({
        where: { userId },
        order: { createdAt: "ASC" },
      }),
    );
    return rows.map(({ id, provider, createdAt, lastLoginAt }) => ({
      id,
      provider,
      createdAt,
      lastLoginAt,
    }));
  }

  /**
   * Attach the identity the provider just authenticated to `userId`.
   *
   * Only ever called from the OIDC callback, for a round trip a signed,
   * state-bound link marker says this user started from a stepped-up session.
   * The callback has no session yet, so it calls this under system context.
   */
  attach(
    userId: string,
    issuer: string,
    subject: string,
  ): Promise<LinkOutcome> {
    return withScopedDb(this.dataSource, (manager) =>
      this.attachWithin(manager, userId, issuer, subject),
    ).catch((err: any) => {
      // Lost a race with another account claiming the same identity.
      if (err?.code === "23505") return "identity_in_use" as const;
      throw err;
    });
  }

  private async attachWithin(
    manager: EntityManager,
    userId: string,
    issuer: string,
    subject: string,
  ): Promise<LinkOutcome> {
    const user = await manager
      .getRepository(User)
      .findOne({ where: { id: userId }, select: ["id", "isActive"] });
    if (!user?.isActive) {
      throw new NotFoundException(
        tr("errors.auth.userNotFound", "User not found"),
      );
    }
    const identities = manager.getRepository(UserIdentity);
    const existing =
      (await identities.findOne({ where: { issuer, subject } })) ??
      (await identities.findOne({
        where: { issuer: LEGACY_IDENTITY_ISSUER, subject },
      }));
    if (existing) {
      if (existing.userId !== userId) {
        this.logger.warn(
          `Identity link refused for user ${userId}: the identity belongs to another account`,
        );
        return "identity_in_use";
      }
      existing.issuer = issuer;
      await identities.save(existing);
      return "already_linked";
    }
    // An account an older replica created during a rolling deploy has only
    // users.oidc_subject (see AuthService.resolveIdentityUser).
    const columnOwner = await manager
      .getRepository(User)
      .findOne({ where: { oidcSubject: subject }, select: ["id"] });
    if (
      columnOwner &&
      columnOwner.id !== userId &&
      !(await identities.exist({ where: { userId: columnOwner.id } }))
    ) {
      return "identity_in_use";
    }

    await identities.save(
      identities.create({
        userId,
        issuer,
        subject,
        provider: providerFromSubject(subject),
      }),
    );
    this.logger.log(
      `Identity linked for user ${userId} (provider ${providerFromSubject(subject) ?? "oidc"})`,
    );
    return "linked";
  }

  /**
   * Remove one identity. Refused when it is the account's last way to sign in:
   * no other identity, and no password that local login would accept.
   */
  async unlink(userId: string, identityId: string): Promise<void> {
    const localAuthEnabled =
      this.configService
        .get<string>("LOCAL_AUTH_ENABLED", "true")
        .toLowerCase() !== "false";
    await withScopedDb(this.dataSource, async (manager) => {
      const identities = manager.getRepository(UserIdentity);
      const owned = await identities.find({ where: { userId } });
      const target = owned.find((identity) => identity.id === identityId);
      if (!target) {
        throw new NotFoundException(
          tr("errors.auth.identityNotFound", "Sign-in method not found"),
        );
      }
      const user = await manager.getRepository(User).findOneOrFail({
        where: { id: userId },
        select: ["id", "passwordHash", "oidcSubject"],
      });
      const hasPasswordSignIn = localAuthEnabled && !!user.passwordHash;
      if (owned.length <= 1 && !hasPasswordSignIn) {
        throw new ConflictException({
          code: "LAST_SIGN_IN_METHOD",
          message: tr(
            "errors.auth.lastSignInMethod",
            "You cannot remove your only way to sign in.",
          ),
        });
      }
      await identities.delete({ id: target.id, userId });
      if (user.oidcSubject === target.subject) {
        // Otherwise the users.oidc_subject fallback would sign it back in.
        await manager
          .getRepository(User)
          .update({ id: userId }, { oidcSubject: null });
      }
    });
    this.logger.log(`Identity ${identityId} unlinked for user ${userId}`);
  }
}
