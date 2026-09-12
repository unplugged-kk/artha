# Artha — mission status

**Living status document.** It is updated at the end of each working turn and lives on its own branch so the captain can review progress and reply with the next instructions from the pull request itself.

Last updated: 2026-09-12 · Branch: `fm/artha-mission-status` · Work is checkpointed in PRs #2, #3, #4 (none merged).

---

## TL;DR

- **Phase 1 (India instrument identity) — done and validated.** PR #3.
- **Phase 2 (India market data) — partially done.** NSE/BSE equity quoting works; the AMFI mutual-fund NAV adapter, IST sessions and the Indian holiday calendar are **not** done. PR #4.
- **Phases 3–27 — not started.** The full roadmap is many working sessions, not one.
- The limit reached was working budget, **not** a technical blocker: no financial-contract, security, licensing or irreversible-migration question is open.
- **Four decisions are waiting on you** (last section).

---

## Phase status

| Phase | Status | Commit | PR |
|---|---|---|---|
| 0 — Current state recon | done | — | — |
| 1 — India instrument foundation | **done** | `5baab28f6` | #3 |
| 2 — India market data foundation | **partial** — equity quoting only | `dad1a5e7b` | #4 |
| 3 — India investment instruments | not started | — | — |
| 4 — Investment actions (BONUS / FEE / TAX_WITHHELD) | not started | — | — |
| 5 — XIRR | not started | — | — |
| 6 — SIP plan vs actual | not started | — | — |
| 7 — Transaction experience (from Fintrack) | not started | — | — |
| 8 — Brand + INR (owned by the rebrand branch) | not started | — | — |
| 9 — Global currency switcher | not started | — | — |
| 10 — Accounts + cards | not started | — | — |
| 11 — Recurring + rules | not started | — | — |
| 12 — Budgets | not started | — | — |
| 13 — Goals + emergency fund | not started | — | — |
| 14 — Import / normalization engine | not started | — | — |
| 15 — SMS / India intake | not started | — | — |
| 16 — Broker imports | not started | — | — |
| 17 — Portfolio valuation | not started | — | — |
| 18 — Portfolio analytics | not started | — | — |
| 19 — Mutual fund intelligence | not started | — | — |
| 20 — Stock research | not started | — | — |
| 21 — Dashboard | not started | — | — |
| 22 — Reporting | not started | — | — |
| 23 — AI foundation | not started | — | — |
| 24 — India tax foundation | not started | — | — |
| 25 — PWA / offline / Hindi | not started | — | — |
| 26 — Final hardening | not started | — | — |
| 27 — Final product verification | not started | — | — |

---

## What is delivered

**Phase 1 — instrument identity (PR #3)**

- **ISIN** on every instrument, validated structurally **and** by its ISO 6166 check digit (a mistyped identifier is refused, not stored).
- **AMFI scheme code**, for an Indian mutual fund.
- **Ticker-alias registry** — an exchange rename (`TATAMOTORS → TMPV`) is recorded once as global reference data.
- **Instrument types** extended with REIT, gold and the India scheme types (PPF, EPF, NPS, FD, RD, SGB, ESOP, ULIP).
- **One mapping function** from an instrument to a provider's symbol, so symbol formatting cannot drift between features.

**Phase 2, part 1 — Indian equity quoting (PR #4)**

- `RELIANCE` on **NSE** now resolves to `RELIANCE.NS` and **BSE** to `.BO`, so NSE/BSE holdings get live quotes, price history and valuation through the existing pipeline.
- The exchange → symbol-suffix table was consolidated into a single authority instead of two that could disagree.

---

## Validation

| Gate | Result |
|---|---|
| Schema replay (`scripts/verify-schema.sh`) | clean |
| Migration lint + prefix check | clean |
| Backend unit (identity, consumers, AI/MCP tools) | 445 passed |
| Integration — RLS enforcement/enable/harness | 66/66 passed |
| Integration — backup + support-backup coverage guards | passed |
| Frontend type-check + lint | clean |
| Frontend tests (incl. full locale parity) | 1671 passed |
| Provider + securities suites | 2 failures, both **pre-existing** (proven by re-running with the changes stashed) |

---

## Known limitations

1. Indian **mutual funds** cannot be priced yet — the AMFI NAV adapter is not built.
2. Six new UI strings ship as English across the other locales; the locale-parity test requires every locale to hold every key, and translations are pending.
3. The India instrument types are selectable in the import wizard but not yet in the security form's type picker (their per-type forms come with Phase 3).
4. Two pre-existing test failures remain in the securities suite; they also fail on a clean baseline.

---

## Open checkpoints

| PR | Contents | State |
|---|---|---|
| #2 | Additive India data model (five tables) | open, unmerged |
| #3 | Instrument identity (ISIN, AMFI code, aliases) | open, unmerged |
| #4 | Indian equity quoting (NSE/BSE) | open, unmerged |

The three branch off one another: merging them in order keeps each diff clean.

---

## Decisions needed

1. **Merge order** for #2 → #3 → #4 (all open; nothing merged by the agent).
2. **Translation policy** for new UI strings — ship English until translated, or fund a translation pass with each phase.
3. **What to build next.** The dependency order says finish AMFI → instruments → actions → XIRR; the adoption argument favours the import pack. These are different sequences.
4. Whether to **quarantine the pre-existing failing tests** so later phases start from a green baseline.

---

*This file is a status document, not a deliverable feature. It can be closed without merging once the phases it describes have landed.*
