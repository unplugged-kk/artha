# Backlog (ordered; the agent takes the first unchecked task whose dependencies are done)

- [x] T1 India tax engine core: FY-versioned config, old vs new regime comparison, 80C/80D/80CCD(1B) headroom (pure TS, `backend/src/tax-india/`, unit tests)
- [x] T2 Tax engine: capital gains STCG/LTCG classifier (equity 12 months, debt/other rules per FY config)
- [x] T3 Tax engine wired as AI tools AND MCP tools (`tax_compare_regimes`, `tax_deduction_headroom`), both layers, with evidence field
- [REMOVED: duplicate of backend/src/import/sms/ (composite parser, review_needed flow, sender registry)] T4 SMS parser (HDFC, ICICI, SBI, Axis, Kotak templates, UPI VPA extraction), pure TS with fixtures
- [REMOVED: duplicate; SMS review flow already exists in backend/src/import/sms/] T5 Ingestion review queue: entity, migration, `schema.sql`, service, controller (nothing posts without confirmation)
- [x] T6 (POST /categorization/suggest wires tiers 1-3: RulesService, merchant reference + user category resolution, payee history; reports the deciding tier. Tier 4 is reported as needs_ai only; the AI call and any write stay in the existing confirmed-action flow) Categorization pipeline tiers 2-4 (merchant defaults, historical payee pattern, AI fallback) logging the tier on the result
- [x] T7 `action_history.actor_type` (user|ai|mcp) and `tool_name`, via ambient actor context set by the AI confirm path and the MCP transport (`tier` deliberately not added: it belongs to categorization output). Verified: schema.sql apply, 195-migration replay, migration alone on old schema, real-DB integration spec
- [x] T8 (calculators only; entities need DB, see T5) India asset metadata: EPF/PPF/NPS/FD/RD/SGB/physical gold maturity and interest calculators (pure TS), then entities
- [REMOVED: already exists, securities/amfi-nav.service.ts] T9 AMFI NAV fetcher in market data
- [x] T10 (GET /anomalies: category spikes + subscription increases on real data, integration-tested; duplicates + low-balance detectors exist but are not exposed; no alerts/cron/AI/MCP) Deterministic detectors: spending spike (>2 sigma), subscription increase, low-balance projection
- [x] T11 (simulators exposed to AI + MCP as plan_simulate; Monte Carlo/goals reuse not done) Debt snowball/avalanche + FIRE simulators (reuse `monte-carlo`, `goals`)
- [x] T12 (GET /coach/weekly deterministic metrics; POST /coach/weekly adds an AI narrative that is rejected if it quotes any number not computed, one retry naming the offending numbers; on demand, not stored, no cron) Weekly coach report (deterministic metrics, LLM narrative with citations)
- [x] T13 (NOT a new wizard: the app already had a first-run language/currency step, a Getting Started dashboard card and an intro tour. The real gaps were the AI provider and notifications steps, added to the existing card: /settings/ai and /settings#notifications; 18 locales translated, pseudo-locale regenerated) Onboarding wizard (frontend, English catalogs only)
