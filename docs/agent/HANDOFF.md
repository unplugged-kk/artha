# Handoff log

Newest entries last.

- Research pass done; plan corrected against repo (see AUTONOMOUS_BUILD.md). Next: T1.
- T1 done: backend/src/tax-india (FY config, regime comparison, 80C/80CCD1B/80D headroom; 12 tests). Refuses above surcharge threshold. Next: T2 (not wired to AI/MCP until T3). Note: git push got 403 from the sandbox; commits are local.
- T2 done: equity STCG/LTCG classifier, 1.25L exemption, loss set-off, null totals on unknown lots (grandfathering not modelled -> unknown). Scope is listed equity only; debt/other deferred. Push works now. Next: T3 (wire to AI + MCP).
- T3 done: india_tax tool (compare_regimes, deduction_headroom) in AI executor + MCP via tax-india/tax-llm.ts; one tool instead of two to save tools/list bytes; total budget raised 50500->52200. tax/mcp/ai-query suites green (1176 tests). Next: T4 SMS parser.
