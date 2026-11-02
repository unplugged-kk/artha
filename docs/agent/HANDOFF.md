# Handoff log

Newest entries last.

- Research pass done; plan corrected against repo (see AUTONOMOUS_BUILD.md). Next: T1.
- T1 done: backend/src/tax-india (FY config, regime comparison, 80C/80CCD1B/80D headroom; 12 tests). Refuses above surcharge threshold. Next: T2 (not wired to AI/MCP until T3). Note: git push got 403 from the sandbox; commits are local.
- T2 done: equity STCG/LTCG classifier, 1.25L exemption, loss set-off, null totals on unknown lots (grandfathering not modelled -> unknown). Scope is listed equity only; debt/other deferred. Push works now. Next: T3 (wire to AI + MCP).
- T3 done: india_tax tool (compare_regimes, deduction_headroom) in AI executor + MCP via tax-india/tax-llm.ts; one tool instead of two to save tools/list bytes; total budget raised 50500->52200. tax/mcp/ai-query suites green (1176 tests). Next: T4 SMS parser.
- T4 done: backend/src/india-ingestion/sms-parser.ts (HDFC/ICICI/SBI/Axis/Kotak fixtures, UPI VPA/ref, null date when ambiguous, OTP rejected). Real bank formats vary; fixtures are representative, not exhaustive. Next: T5 review queue.
- T8 calculators done (FD, RD, PPF, EPF, NPS, SGB; backend/src/india-assets). RD checked against an independent per-deposit sum. Entities/UI not built. T5/T7 BLOCKED: no PostgreSQL running in this sandbox. Reordered to pure/offline work: T6 tiers, T10, T11 next.
- T10 detectors + T11 debt/FIRE simulators done as pure modules (backend/src/finance-detectors, finance-simulators; 22 tests). NOT yet wired to AI/MCP/alerts/cron: each wiring needs both layers (see T3 pattern) and tools-list byte budget review.
- T6 (categorization decision core) and T12 (coach metrics + verifyNarrative) done as pure modules, 18 tests.
- STATE AT STOP: T1-T4, T6, T8, T10-T12 delivered as tested pure modules; only T1-T3 are user-reachable (india_tax AI+MCP tool). T5, T7 blocked on PostgreSQL; T9 blocked on network; T13 not started.
- Suggested next agent: (1) start PostgreSQL, do T5+T7 with scripts/verify-schema.sh; (2) wire detectors/simulators/coach/categorization/SMS parser into services, AI executor AND MCP together, mind the tools/list byte budget; (3) T9, T13.
