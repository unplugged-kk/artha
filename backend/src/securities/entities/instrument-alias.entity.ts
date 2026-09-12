import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * A ticker rename on a listing exchange: `(exchange, alias_symbol)` is the same
 * instrument as `canonical_symbol`.
 *
 * Global reference data, not user data. An exchange renaming a ticker
 * (TATAMOTORS -> TMPV, ZOMATO -> ETERNAL, MOTHERSUMI -> MOTHERSON) is a fact
 * about the exchange, identical for every user, so a per-user copy would only
 * give two users two answers about the same instrument. It is therefore
 * RLS-exempt, like `currencies` and `exchange_rates` -- see
 * `docs/row-level-security-contract.md`.
 *
 * The provider-key mapping (`providers/instrument-key.util.ts`) consults this
 * before it formats a symbol for a provider, so a security stored under the
 * name the user knows still resolves to the ticker the provider publishes.
 *
 * The alias is deliberately not a synonym for the provider's own formatting:
 * `NSE` + `RELIANCE` -> `RELIANCE.NS` is a formatting rule and lives in code,
 * while `NSE` + `TATAMOTORS` -> `TMPV` is a fact that changes over time and
 * lives here.
 */
@Entity("instrument_aliases")
@Index("idx_instrument_aliases_lookup", ["exchange", "aliasSymbol"], {
  unique: true,
})
export class InstrumentAlias {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Canonical exchange code (`NSE`, `BSE`, ...); the venue the rename happened on. */
  @Column({ type: "varchar", length: 50 })
  exchange: string;

  /** The retired symbol a security may still be stored under. */
  @Column({ type: "varchar", length: 20, name: "alias_symbol" })
  aliasSymbol: string;

  /** The symbol the exchange uses now. */
  @Column({ type: "varchar", length: 20, name: "canonical_symbol" })
  canonicalSymbol: string;

  /** Why the rename happened, for the operator reading the table. */
  @Column({ type: "varchar", length: 255, nullable: true })
  note: string | null;

  /** The date the rename took effect, when the exchange published one. */
  @Column({ type: "date", nullable: true, name: "effective_from" })
  effectiveFrom: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
