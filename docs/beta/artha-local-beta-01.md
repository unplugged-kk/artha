# Artha local beta — environment & smoke-test handover

Baseline: **`main` @ `5ab3f6188`** (`Merge pull request #25`), which contains
Mission 1–3, Fund Rolling Returns (PR #24), the Artha de-branding (PR #26) and
the MF categories/comparison specification (PR #25).

Branch: `fm/artha-local-beta-01` (deployment/stabilization only — no feature work).

## Environment

| Item | Value |
|---|---|
| Docker | 29.6.1 (Compose v5.5.1) |
| Host | macOS (darwin, arm64), 24 GiB RAM, 15 CPU |
| Docker VM | ~6 GiB RAM / 2 CPU (recorded constraint) |
| Database | `postgres:16-alpine` |
| Stack | `docker-compose.dev.yml` (builds the local Artha source) |
| Host ports | postgres `127.0.0.1:55432`, backend `127.0.0.1:3200`, frontend `127.0.0.1:3201` |

**Port relocation (deployment fix on this branch).** The developer machine
already runs an unrelated stack (`contentforge`, project at
`/Users/kishore/git/ContentForge`) on `5432`/`3000`, and a native Postgres on
`5433`. `docker-compose.dev.yml` gained two host-only overrides —
`POSTGRES_HOST_PORT` and `BACKEND_HOST_PORT` — so the published host ports can
move without changing the container ports; `FRONTEND_PORT` already worked this
way. `.env.example` documents both. The internal ports stay postgres 5432 /
backend 3000 / frontend 3000.

## Startup

```bash
mkdir -p artha/backups artha/attachments
cp .env.example .env      # then set NODE_ENV, secrets and the port overrides below
#   POSTGRES_DB=artha POSTGRES_USER=artha_user POSTGRES_PASSWORD=<rand>
#   JWT_SECRET=<openssl rand -base64 32>  ENCRYPTION_KEY=<openssl rand -hex 32>
#   PUBLIC_APP_URL=http://localhost:3201  CORS_ORIGIN=http://localhost:3201
#   DISABLE_HTTPS_HEADERS=true  NODE_ENV=development
#   FRONTEND_PORT=3201  BACKEND_HOST_PORT=3200  POSTGRES_HOST_PORT=55432
#   BACKUP_HOST_DIR=./artha/backups  ATTACHMENT_HOST_DIR=./artha/attachments
docker compose -f docker-compose.dev.yml up -d
```

`.env` and `artha/` are gitignored. Secrets are generated locally and are **not
committed**; test users are created through `POST /api/v1/auth/register` (no
credentials are recorded here).

## Services

| Container | Image | Internal | Host |
|---|---|---|---|
| `artha-postgres` | postgres:16-alpine | 5432 | 127.0.0.1:55432 |
| `artha-backend` | built (development target) | 3000 | 127.0.0.1:3200 |
| `artha-frontend` | built (development target) | 3000 | 127.0.0.1:3201 |

Health: `GET /api/v1/health/live`, `GET /api/v1/health/ready` (backend);
`GET /login` (frontend, 200). The frontend proxies `/api/*` to the backend.

## Smoke tests executed

| Area | Result |
|---|---|
| Clean startup | postgres healthy; `db-init` + `db-migrate` clean; **194 migrations applied**; `current_database()=artha`, `current_user=artha_user`; `/ready` 200 |
| Connectivity | frontend→backend proxy `/api/v1/health/live` = 200 |
| Auth | `POST /auth/register` = 201; `POST /auth/login` = 201; CSRF double-submit honoured |
| Accounts | created an INR chequing account with opening balance 5000 |
| Transactions | created a −250.50 expense; read back **balance 4749.50** and **1 transaction** (arithmetic correct) |
| Restart (backend) | `/ready` 200 after ~50 s; frontend reconnects (proxy 200) |
| Restart (full stop/start) | volume persists; user A re-login → account 4749.50 and the transaction still present |
| Isolation | user B: `GET` and `PATCH` on A's account id → **404**; B sees **0** of A's transactions and **0** accounts |
| Investments | created an AMFI fund, added FX-A manual NAVs, `GET /investments/performance/securities/:id/rolling-returns` → `ELIGIBLE`, 1Y **25**, 3Y **25.9855**, 5Y **20.1155** (spec oracles) |
| Provider resilience | a non-existent scheme code yields a graceful 200 over stored rows, no fabricated value |
| Backup export | `POST /backup/export` = 201, 2031-byte gzip artifact |

Not yet exercised (deferred, see below): backups **restore** round-trip, full
multi-currency (INR+foreign with missing-FX), the UI journeys (import, SMS,
budgets, goals, reports) and the Playwright E2E matrix — those need a separate
pass or CI.

## Known issues

| ID | Sev | Area | Summary | Evidence | Likely cause |
|---|---|---|---|---|---|
| BETA-001 | **P2** | Market data | On boot the market-index refresh fails for **KOSPI** and is logged; no other index reported. Non-fatal (the rest of the app works). | `ERROR [MarketIndexService] Market index refresh for KOSPI failed: QueryFailedError: ON CONFLICT DO UPDATE command cannot affect row a second time [code=21000]` (once, at 11:01:53) | The index-price upsert's batch contains two rows that resolve to the same conflict target (duplicate date/exchange rows for KOSPI), which Postgres rejects in a single `INSERT … ON CONFLICT DO UPDATE`. |

No P0 or P1 issue was observed in this pass.

## Data observations

- Balance arithmetic is correct (`5000 − 250.50 = 4749.50`), and the value is
  stable across a full stop/start.
- No duplicate or missing transaction, no stale balance, and no fabricated
  value for the unavailable fund.

## Provider observations

- AMFI: a scheme code mfapi does not serve is handled gracefully (stored rows
  answer; no provider value invented).
- Market index: KOSPI refresh failure as **BETA-001**; every other index in the
  boot batch refreshed without error.

## Recovery

- Backend-only restart: ready in ~50 s, frontend reconnected.
- Full stop/start: data intact (Postgres named volume).
- Backup export produces an artifact; **restore was not run against the beta
  database** (a restore must target a disposable environment).

## Security

- Two local users; the second could not read or modify the first's account by
  id (`GET`/`PATCH` → 404) and saw none of the first's accounts or transactions.
  No cross-user leakage observed in this pass.

## Performance

- Time to `/ready` ≈ 50 s on a 2 CPU / ~6 GiB Docker VM, running the
  development targets (`nest --watch` + `next dev`). No OOM or restart loop
  observed, but the dev servers are heavier than the production images; a
  production-image beta would start faster. No repeated-request or obvious N+1
  problem was observed in the API journeys.

## Observation period

The environment is stable and reproducible. **Feature development is frozen**
for the observation period: use Artha normally, record observations
(date/screen/what I did/expected/actual/evidence), and do not patch the baseline
in place. Fixes happen in a later *Beta Bug Triage & Stabilization* mission.
