import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

/** Issuer recorded for identities backfilled from `users.oidc_subject`. */
export const LEGACY_IDENTITY_ISSUER = "legacy";

/**
 * One external sign-in identity (an Auth0 connection or another OIDC provider)
 * attached to an Artha user. `(issuer, subject)` is unique.
 */
@Entity("user_identities")
@Unique("uq_user_identities_issuer_subject", ["issuer", "subject"])
@Index("idx_user_identities_user", ["userId"])
@Index("idx_user_identities_subject", ["subject"])
export class UserIdentity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "varchar", length: 512 })
  issuer: string;

  @Column({ type: "varchar", length: 255 })
  subject: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  provider: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt: Date | null;
}

/** Auth0 names the connection in the subject prefix: "google-oauth2|1234". */
export function providerFromSubject(subject: string): string | null {
  const bar = subject.indexOf("|");
  return bar > 0 ? subject.slice(0, bar).slice(0, 100) : null;
}
