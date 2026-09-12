# Artha — India investment foundation mission status

**Living status document.** Rewritten (not appended) at the end of each working turn so it can be reviewed from the pull request — including from a phone. This PR is never merged; it is overwritten.

Last updated: 2026-09-12 · Branch `fm/artha-mission-status`

---

## TL;DR

- **Phase A (AMFI NAV provider), Phase B (India instrument forms) and Phase C (BONUS / FEE / TAX_WITHHELD) are done and now MERGED into `main`.**
- `main` is at `816e2819f`; the merged tree is byte-identical to the tip that was validated (empty diff), so nothing unvalidated was merged.
- **Phases D–G are not started**: cost-basis reconciliation guard (D), XIRR (E), SIP plan-vs-actual (F), IST holiday calendar (G).
- The only failing CI checks anywhere are the two **pre-existing** ones, already red on `main` before this work.

---

## Merged checkpoints

| PR | Contents | Merge commit |
|---|---|---|
| #2 | India data model (five tables) | `f470222e3` |
| #3 | Instrument identity (ISIN, AMFI code, aliases) | `e88d29b95` |
| #4 | NSE/BSE equity quoting | `5146e80f5` |
| #6 | AMFI NAV provider | `7e5c84cf4` |
| #7 | India instrument forms | `5d36f76d1` |
| #8 | BONUS / FEE / TAX_WITHHELD | `816e2819f` |

Merged in that order, as instructed. This status PR (#5) is deliberately **not** merged.

---

## Phase status

| Phase | Status |
|---|---|
| A — AMFI NAV provider | **done, merged** |
| B — India instrument forms | **done, merged** |
| C — BONUS / FEE / TAX_WITHHELD | **done, merged** |
| D — Cost-basis reconciliation guard | not started |
| E — XIRR | not started |
| F — SIP plan-vs-actual | not started |
| G — IST sessions + holiday calendar | not started (IST sessions partly landed in A) |

---

## What Artha can now do

- **Price an Indian mutual fund** from the AMFI/mfapi.in catalogue, addressed by scheme code, with a NAV dated on its own day — never a fabricated or zero price, and no silent fallback to an equity provider.
- **Price an NSE/BSE equity** (`RELIANCE` → `RELIANCE.NS`).
- **Record identity**: ISIN (check-digit validated), AMFI scheme code, and exchange ticker renames as reference data.
- **Create India instruments from the UI**: REIT, GOLD, PPF, EPF, NPS, FD, RD, SGB, ESOP, ULIP — with the identity fields shown where they apply.
- **Record a bonus issue, a standalone fee, and tax withheld at source** in the investment ledger, each with correct cash, share and cost-basis behaviour.

---

## Validation

| Gate | Result |
|---|---|
| `git diff origin/main <validated tip>` | **empty** — merged tree equals the validated tree |
| Full frontend suite | **16,397 passed / 849 files** |
| Action + ledger suites | 444 passed |
| Securities suite | 2 **pre-existing** failures only |
| `scripts/verify-schema.sh` | clean |
| `migration:lint`, prefix check, typecheck, lint | clean |

**Pre-existing failures (not regressions):** `Backend Unit Tests` and `zizmor` are red on `main` itself. Within the unit suite the two failures are `security-price.service` (`pricesLoaded` expected <40, got 40) and `yahoo-finance` (`getHours()` expected 0, got 5 — the runner is IST/UTC+05:30 against a UTC-midnight date). Both reproduce with this work stashed.

---

## Remaining work

1. **D** — reconciliation guard proving the cached average cost cannot silently diverge from the transaction replay.
2. **E** — **native XIRR** over real dated flows including fees, taxes and the terminal value. This is the headline gap: Artha has TWR and CAGR but no XIRR.
3. **F** — SIP plan-vs-actual over the existing scheduled-investment mechanism.
4. **G** — Indian holiday calendar wired into settlement.
5. **TAX_WITHHELD attribution** — the link to the income row it was withheld from was deliberately not half-built.

---

## Decisions needed

1. **Continue with D–G?** Recommended next bounded mission: **D + E + the TAX attribution link** ("India investment maths") — self-contained, no new provider work, and it closes the gap between "India instruments exist" and "India returns are trustworthy".
2. **Translation policy** for new UI strings (currently English pending translation across the non-`en` locales).
3. Whether to **quarantine the pre-existing failing tests** so future work starts from a green baseline.
