# Backlog (ordered; the agent takes the first unchecked task whose dependencies are done)

- [x] T1 India tax engine core: FY-versioned config, old vs new regime comparison, 80C/80D/80CCD(1B) headroom (pure TS, `backend/src/tax-india/`, unit tests)
- [x] T2 Tax engine: capital gains STCG/LTCG classifier (equity 12 months, debt/other rules per FY config)
- [ ] T3 Tax engine wired as AI tools AND MCP tools (`tax_compare_regimes`, `tax_deduction_headroom`), both layers, with evidence field
- [ ] T4 SMS parser (HDFC, ICICI, SBI, Axis, Kotak templates, UPI VPA extraction), pure TS with fixtures
- [ ] T5 Ingestion review queue: entity, migration, `schema.sql`, service, controller (nothing posts without confirmation)
- [ ] T6 Categorization pipeline tiers 2-4 (merchant defaults, historical payee pattern, AI fallback) logging the tier on the result
- [ ] T7 `action_history` columns `actor_type`, `tool_name`, `tier` (migration + schema.sql + writers)
- [ ] T8 India asset metadata: EPF/PPF/NPS/FD/RD/SGB/physical gold maturity and interest calculators (pure TS), then entities
- [ ] T9 AMFI NAV fetcher in market data
- [ ] T10 Deterministic detectors: spending spike (>2 sigma), subscription increase, low-balance projection
- [ ] T11 Debt snowball/avalanche + FIRE simulators (reuse `monte-carlo`, `goals`)
- [ ] T12 Weekly coach report (deterministic metrics, LLM narrative with citations)
- [ ] T13 Onboarding wizard (frontend, English catalogs only)
