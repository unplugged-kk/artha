import { JsonbHandlerName } from "./support-backup-jsonb";

/**
 * The per-column rule vocabulary and the type of the registry built from it.
 *
 * Split out of `support-backup-rules.ts` for the same reason
 * `support-backup-sections.ts` was: the registry is now large enough that the
 * domain groups are kept in their own modules, and every one of them needs the
 * same seven constructors. Re-exported from `support-backup-rules.ts` so
 * existing import sites are unchanged.
 */

/** What happens to one exported column. */
export type ColumnRule =
  | { t: "keep" } // structure, dates, enums, flags, FKs, public reference values
  | { t: "mask" } // free text / names: keep first+last 2 chars, star the middle
  | { t: "drop" } // set to null (highest-risk free text, secrets, bulk blobs)
  | { t: "const"; value: unknown } // fixed replacement for NOT NULL dropped fields
  | { t: "scale" } // private money magnitude x M (4 dp)
  | { t: "scaleQty" } // private quantity x M (8 dp)
  | { t: "jsonb"; handler: JsonbHandlerName }; // per-key handler for a JSON blob

export const keep: ColumnRule = { t: "keep" };
export const mask: ColumnRule = { t: "mask" };
export const drop: ColumnRule = { t: "drop" };
export const scale: ColumnRule = { t: "scale" };
export const scaleQty: ColumnRule = { t: "scaleQty" };
export const konst = (value: unknown): ColumnRule => ({ t: "const", value });
export const jsonb = (handler: JsonbHandlerName): ColumnRule => ({
  t: "jsonb",
  handler,
});

/** Every classified column of one table, keyed by column name. */
export type TableRules = Record<string, ColumnRule>;
