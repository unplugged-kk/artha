# Artha — India investment foundation mission status

**Living status document.** Updated at the end of each working turn so it can be reviewed from the pull request — including from a phone. Detail lives here; the PR description carries the summary.

Last updated: 2026-09-12 · Branch `fm/artha-mission-status` · Work is checkpointed in PRs #2–#8 (**none merged**).

---

## TL;DR

- **Phase A — AMFI NAV provider: done.** PR #6.
- **Phase B — India instrument forms: done.** PR #7.
- **Phase C — BONUS / FEE / TAX_WITHHELD: done.** PR #8.
- **Phases D–G not started**: cost-basis reconciliation guard (D), XIRR (E), SIP plan-vs-actual (F), IST sessions + Indian holiday calendar (G).
- All checkpoints validated and green; the only test failures anywhere are the **pre-existing** ones, reproduced on a clean baseline.

---

## Phase status

| Phase | Status | PR |
|---|---|---|
| A — AMFI NAV provider | **done** | #6 |
| B — India instrument forms | **done** | #7 |
| C — BONUS / FEE / TAX_WITHHELD | **done** | #8 |
| D — Cost-basis reconciliation guard | not started | — |
| E — XIRR | not started | — |
| F — SIP plan-vs-actual | not started | — |
| G — IST sessions + holiday calendar | not started (IST sessions partly landed in Phase A) | — |

Earlier foundation work, already checkpointed: **#2** India data model, **#3** instrument identity, **#4** NSE/BSE equity quoting.

---

## What is delivered

### Phase A — AMFI NAV (PR #6)

- An Indian mutual fund is priced from the AMFI/mfapi.in catalogue through the existing provider seam.
- **Addressed by identity**, not a ticker: the scheme code comes from `securities.amfi_scheme_code`; a missing or non-numeric code means "cannot address" → `null` with **no request made**.
- **A NAV is a settled daily value**: the quote carries the NAV's own date and the NSE session for that date, so the stored `price_date` is the day the NAV belongs to, not the day we asked.
- **Missing is `null`, never `0`** — HTTP failure, malformed payload, zero/negative NAV and future-dated NAV all produce `null`.
- **No silent fallback**: a scheme-coded fund resolves to AMFI alone; a stale override cannot divert it.
- `india-market.util.ts` is the single authority for India's market clock (Asia/Kolkata, 09:15–15:30, IST calendar days, weekends).

### Phase B — India instrument forms (PR #7)

- The security form offers every India type: **REIT, GOLD, PPF, EPF, NPS, FD, RD, SGB, ESOP, ULIP**.
- The **AMFI scheme-code field appears only for a mutual fund** — identity is shown where it means something.
- The security detail shows **ISIN** and **AMFI scheme code**, and omits both rows when absent.

### Phase C — investment actions (PR #8)

- **BONUS** — shares at no cost; leaves the cost basis **known** (unlike ADD_SHARES, whose cost is unknown). That distinction is the reason it exists.
- **FEE / TAX_WITHHELD** — cash-only costs, amount from `price`, quantity ignored, stored as a positive magnitude, exported as `CASH_COST_ACTIONS` so cash-flow maths can find them.

---

## Validation

| Gate | Result |
|---|---|
| Full frontend suite (Phase B) | **16,397 passed across 849 files** |
| Securities suite (Phases A + C) | 1736–1780 passed; 2 **pre-existing** failures |
| Action + ledger suites (Phase C) | 444 passed |
| `scripts/verify-schema.sh` | clean (every migration replays twice over `schema.sql`) |
| `migration:lint`, prefix check | clean |
| Backend / frontend typecheck + lint | clean |

**Pre-existing failures, proved not mine:** `security-price.service` (`pricesLoaded` expected <40, got 40) and `yahoo-finance` (`getHours()` expected 0, got 5 — the runner is IST/UTC+05:30 against a UTC-midnight date). Both reproduce with this work stashed.

---

## Known limitations

1. **TAX_WITHHELD is not yet linked** to the income row it was withheld from. The action is recorded and reaches cash flows; the attribution link needs a DTO field plus a validation guard.
2. **No XIRR yet** (Phase E) — the engine has TWR and CAGR only.
3. **Indian market holidays are not modelled**; `isIndianWeekday` answers the weekend question only, deliberately named for what it knows.
4. Twelve new UI strings exist as **English pending translation** in the non-`en` locales (the parity test requires every locale to hold every key).
5. Two pre-existing test failures remain in the securities suite.

---

## Open checkpoints

| PR | Contents |
|---|---|
| #2 | India data model (five tables) |
| #3 | Instrument identity (ISIN, AMFI code, aliases) |
| #4 | NSE/BSE equity quoting |
| #6 | AMFI NAV provider |
| #7 | India instrument forms |
| #8 | BONUS / FEE / TAX_WITHHELD |
| #5 | This status document |

They stack; merging in order (#2 → #3 → #4 → #6 → #7 → #8) keeps every diff clean. Nothing has been merged by the agent.

---

## Decisions needed

1. **Merge order** for the checkpoint chain (nothing merged).
2. **Translation policy** for new UI strings — English until translated, or a translation pass per phase.
3. **Whether to continue with D–G** (reconciliation guard, XIRR, SIP plan-vs-actual, holiday calendar), and in what order. XIRR is the headline gap.
4. Whether to **quarantine the pre-existing failing tests** so later phases start from a green baseline.

---

*Status document, not a deliverable feature. It can be closed without merging once the phases it describes have landed.*
