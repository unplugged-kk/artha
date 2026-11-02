# Backlog (ordered; the agent takes the first unchecked task whose dependencies are done)

- [x] T1 India tax engine core: FY-versioned config, old vs new regime comparison, 80C/80D/80CCD(1B) headroom (pure TS, `backend/src/tax-india/`, unit tests)
- [x] T2 Tax engine: capital gains STCG/LTCG classifier (equity 12 months, debt/other rules per FY config)
- [x] T3 Tax engine wired as AI tools AND MCP tools (`tax_compare_regimes`, `tax_deduction_headroom`), both layers, with evidence field
- [REMOVED: duplicate of backend/src/import/sms/ (composite parser, review_needed flow, sender registry)] T4 SMS parser (HDFC, ICICI, SBI, Axis, Kotak templates, UPI VPA extraction), pure TS with fixtures
- [REMOVED: duplicate; SMS review flow already exists in backend/src/import/sms/] T5 Ingestion review queue: entity, migration, `schema.sql`, service, controller (nothing posts without confirmation)
- [x] T6 (pure decision core only; not wired to RulesService, DB history or the AI fallback) Categorization pipeline tiers 2-4 (merchant defaults, historical payee pattern, AI fallback) logging the tier on the result
- [ ] (UNBLOCKED: local PostgreSQL 16 now works, see HANDOFF) T7 `action_history` columns `actor_type`, `tool_name`, `tier` (migration + schema.sql + writers)
- [x] T8 (calculators only; entities need DB, see T5) India asset metadata: EPF/PPF/NPS/FD/RD/SGB/physical gold maturity and interest calculators (pure TS), then entities
- [ ] (BLOCKED: needs outbound access to amfiindia.com; sandbox proxy not verified) T9 AMFI NAV fetcher in market data
- [x] T10 (pure detectors only; not scheduled or wired to alerts/AI/MCP) Deterministic detectors: spending spike (>2 sigma), subscription increase, low-balance projection
- [x] T11 (pure simulators only; Monte Carlo/goals reuse and AI/MCP wiring not done) Debt snowball/avalanche + FIRE simulators (reuse `monte-carlo`, `goals`)
- [x] T12 (pure metrics, prompt and number-verifier only; no LLM call, table or cron) Weekly coach report (deterministic metrics, LLM narrative with citations)
- [ ] (NOT STARTED: frontend wizard needs frontend deps, i18n catalogs and a browser check) T13 Onboarding wizard (frontend, English catalogs only)
