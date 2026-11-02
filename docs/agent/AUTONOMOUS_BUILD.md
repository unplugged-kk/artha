# Artha autonomous build prompt

Paste the PROMPT section into a fresh Claude Code session (or `/loop` it). It is
written so the agent never needs to ask a question: every decision has a default,
and every stop condition is explicit. State lives in `docs/agent/BACKLOG.md`
and `docs/agent/HANDOFF.md`, so any later agent can resume.

## Research findings that change the original plan

A read of the repo showed that much of Phase 0/1 of the competitive plan already
exists. Do not rebuild it; extend it.

| Plan item | Reality in repo | Action |
|---|---|---|
| Write tools with human approval | `backend/src/ai/actions/` signs a dry-run descriptor (HMAC, `expiresAt`), user confirms via card; 18 action types incl. `batch_actions`; MCP has `mcp-confirm.ts` elicitation | Extend, never replace. New write tool = new `AiActionType` |
| Audit log with before/after | `backend/src/action-history/` (`before_data`/`after_data`, undo) | Add `actor_type`/`tool_name`/`tier` columns by migration instead of a second table |
| Categorization rules | `backend/src/rules/` + `transaction_rules` migration | Add tiers 2-4 behind the existing rules tier |
| Goals | `backend/src/goals/` | Reuse for FIRE/goal simulator |
| Forecast, insights | `backend/src/ai/forecast`, `ai/insights` | Wrap, do not duplicate |
| Monte Carlo | `backend/src/monte-carlo` | Reuse for FIRE |
| India: tax, EPF/PPF/NPS/SGB/FD, SMS/Gmail, AMFI | Not present | Real gap: the moat. Do first |
| Multi-tenancy | RLS (`withScopedDb`) already isolates users | Phase 5 tenant_id is mostly unnecessary; skip |
| Observability, CI | Existing health + CI | Low priority |

Repo law that overrides the generic plan (from `CLAUDE.md`): all DB access via
`withScopedDb`; migration plus `database/schema.sql` together; every AI tool wired
in BOTH `ai/query/tool-executor.service.ts` and `mcp/tools/*.tool.ts`; English-only
i18n while in development; no `console.log`; no emojis; immutability; money math in
code, never the LLM; a green suite after a behavior change needs a new case.

## PROMPT

You are the autonomous builder for Artha (`/home/user/artha`). Never ask the user
anything. When a choice is open, take the default written here, record it in
`docs/agent/HANDOFF.md`, and continue.

### Setup (once)
1. Read `CLAUDE.md`, `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `database/CLAUDE.md`,
   `backend/src/mcp/CLAUDE.md`, `docs/system-invariants.md`, this file, `BACKLOG.md`.
2. Work on the branch you were assigned. Never push elsewhere. Never open a PR
   unless told to.
3. `cd backend && npm ci` if `node_modules` is absent. Use `TZ=UTC npm run test:unit`.
   Integration tests need PostgreSQL; if unreachable, skip them and say so in the handoff.

### Loop (repeat until a stop condition)
1. Take the first unchecked task in `BACKLOG.md` whose dependencies are done.
2. Spec: for anything financial, write a short spec first (invariants, numeric
   examples, missing-data policy, test matrix) in `docs/specs/`, commit it.
3. Tests first, then implementation. Pure deterministic logic goes in small
   framework-free files so it is testable offline.
4. Run: relevant `npm run test:unit -- <pattern>`, `npm run typecheck`,
   `npm run lint`. Fix until green. If the same failure survives three attempts,
   mark the task `BLOCKED: <reason>` in the backlog, commit, and take the next task.
5. Commit (one task = one or more small commits, conventional message, no
   attribution beyond what the harness requires). Push the branch after each task.
6. Update `BACKLOG.md` (check the box) and append two lines to `HANDOFF.md`
   (what was done, what is next). Commit that too.
7. Go to 1.

### Stop conditions (check before each task, and again before each commit)
- Spend: the session has a $100 allowance. At roughly $90 of usage (estimate
  from tokens if no meter is visible; err early), finish the current commit, push,
  write `HANDOFF.md`, and stop. Do not start a task you cannot finish
  before then. Never leave the tree uncommitted.
- Backlog empty or every remaining task BLOCKED.
- A destructive or externally visible action is required (production data, secrets,
  force-push, sending email): skip it, record it, continue.

### Hard rules
- LLM never computes a number shown to the user. Tools return numbers; the model
  explains them. Every AI-facing result carries its inputs and a completeness flag.
- Unknown is `null`, never 0 or rate 1. A total is null if any component is unknown.
- AI may propose; only a human confirmation applies a write. Never auto-approve.
- Do not weaken or skip a test to get green.
- Out of scope without explicit instruction: real bank/Gmail credentials, paid APIs,
  anything that needs the user's accounts.

### Defaults for open questions
- Tax year model: India FY (1 Apr - 31 Mar), keyed `FY2025-26`. Rules are data in a
  versioned table, not branches in code.
- New India asset classes: model as `accounts` sub-types plus a metadata table, not
  parallel ledgers, so net worth and reports keep working.
- Ingestion (SMS/email): lands in a review queue; nothing posts without confirmation.
