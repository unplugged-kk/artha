import {
  TableRules,
  drop,
  jsonb,
  keep,
  mask,
  scale,
  scaleQty,
} from "./support-backup-column-rules";

/**
 * Per-column rules for the securities and investment-holdings tables.
 *
 * Split out of `support-backup-rules.ts` (which owns the registry as a whole)
 * because the file had crossed the repository line ceiling. Re-exported through
 * that file's `RULES` map, so the golden test, the section maps and every
 * import site read exactly the same registry as before.
 */
export const SECURITIES_RULES: Record<string, TableRules> = {
  securities: {
    id: keep,
    user_id: keep,
    symbol: mask,
    name: mask,
    security_type: keep,
    exchange: keep,
    currency_code: keep,
    description: drop,
    is_active: keep,
    is_favourite: keep,
    skip_price_updates: keep,
    price_alert_percent: keep,
    price_chart_enabled: keep,
    sector: keep,
    industry: keep,
    sector_weightings: keep, // public weightings
    country_weightings: keep,
    asset_weightings: jsonb("assetWeightings"), // free-text class names
    sector_data_updated_at: keep,
    quote_provider: keep,
    // The exchange's regular session, from the provider. Public reference data
    // about the venue, not the holder, and far too coarse to undo the symbol
    // mask -- 09:30-16:00 America/New_York names an exchange, not an instrument.
    market_timezone: keep,
    market_open_time: keep,
    market_close_time: keep,
    website: drop, // a public URL names the instrument the masked symbol hides
    ir_website: drop,
    msn_instrument_id: drop, // would identify a masked ticker
    // Identity codes: an ISIN or an AMFI scheme code names the exact instrument
    // the masked symbol and name are hiding, so both are dropped for the same
    // reason as the provider id above.
    isin: drop,
    amfi_scheme_code: drop,
    historical_backfill_attempted_at: keep,
    created_at: keep,
    updated_at: keep,
  },
  security_prices: {
    id: keep,
    security_id: keep,
    price_date: keep,
    open_price: keep,
    high_price: keep,
    low_price: keep,
    close_price: keep,
    adjusted_close: keep,
    volume: keep,
    source: keep,
    quoted_at: keep, // when the quote was struck; price_date beside it is kept too
    created_at: keep,
  },
  security_documents: {
    id: keep,
    user_id: keep,
    security_id: keep,
    document_type: keep, // a factsheet is a factsheet
    name: mask, // the user's own wording, and it can name them
    document_date: keep,
    url: drop, // an address can identify the holder or the account it came from
    notes: drop, // free text
    created_at: keep,
    updated_at: keep,
  },
  holdings: {
    id: keep,
    account_id: keep,
    security_id: keep,
    quantity: scaleQty,
    average_cost: keep, // per-unit cost stays public
    created_at: keep,
    updated_at: keep,
  },
  investment_transactions: {
    id: keep,
    user_id: keep,
    account_id: keep,
    transaction_id: keep,
    transaction_split_id: keep,
    linked_transaction_id: keep,
    security_id: keep,
    funding_account_id: keep,
    action: keep,
    transaction_date: keep,
    quantity: scaleQty,
    price: keep, // public per-unit price
    commission: scale,
    total_amount: scale,
    exchange_rate: keep,
    description: drop,
    // Same call as `transactions.import_hash` / `source_transaction_id`: a
    // fingerprint of dropped content, and an upstream identifier that names the
    // account or the person.
    import_hash: drop,
    source_transaction_id: drop,
    // An enum flag, like transactions.status: it re-identifies nobody, and a
    // support backup that dropped it could not reproduce a VOID row's
    // exclusion from holdings and balances.
    status: keep,
    created_at: keep,
    updated_at: keep,
  },
};
