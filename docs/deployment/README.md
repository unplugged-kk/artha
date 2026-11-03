# Deploying Artha

Artha is two processes and a database:

- **frontend**: Next.js. It serves the pages and forwards every `/api/*` request to the backend (`frontend/src/proxy.ts`), so the browser only ever talks to one origin and the auth cookies stay first-party.
- **backend**: NestJS. A long-running Node server with in-process scheduled jobs (`docs/cron-jobs.md`), per-user MCP sessions held in memory, and a PostgreSQL connection per request.
- **PostgreSQL 16**.

That shape decides what each platform can host. The backend needs a place to run a container or a Node process continuously, so it cannot run as a serverless function or a Worker. The frontend can run almost anywhere Next.js runs.

## Which guide

| Target | Frontend | Backend | Database | Guide | Verified |
|---|---|---|---|---|---|
| Ubuntu server, Docker | compose | compose | compose | `docker-compose.prod.yml`, root `README.md` | existing CI |
| Ubuntu, no Docker | `next start` | `node` | `apt` PostgreSQL | [native.md](native.md) | script written; Ubuntu verification run in progress (see native.md) |
| macOS, local | `next start` | `node` | Homebrew PostgreSQL | [native.md](native.md) | **not run** (no Mac available); same script |
| Railway | Railway service | Railway service | Railway PostgreSQL | [railway.md](railway.md) | config written; **not deployed** |
| Vercel | Vercel | Railway, a VPS or any container host | any PostgreSQL | [vercel.md](vercel.md) | config written; **not deployed**; has limits |
| Cloudflare | behind a Tunnel or proxy | any of the above | any | [cloudflare.md](cloudflare.md) | tunnel config renders and merges; **not deployed** |

"Not deployed" means exactly that: this repository was prepared from a sandbox with no accounts on those platforms. Everything that could be checked locally was (see each guide). Treat the first deploy on each platform as the real test, and check its limits against that platform's current documentation.

## The settings every platform needs

| Variable | Where | Meaning |
|---|---|---|
| `JWT_SECRET` | backend | 32+ random characters. Generate once and keep it. |
| `ENCRYPTION_KEY` | backend | 32+ random characters. Encrypts stored provider keys and backup passwords. Losing it makes those unreadable. |
| `DATABASE_URL` | backend | One connection string (`postgresql://user:pass@host:5432/db?sslmode=require`). Replaces the separate `DATABASE_*` variables. Use the **direct** connection, not a transaction pooler: the app relies on per-connection session settings and advisory locks. |
| `PUBLIC_APP_URL`, `CORS_ORIGIN` | backend | The public address of the **frontend**, with `https://`. |
| `INTERNAL_API_URL` | frontend | Where the frontend reaches the backend. Read at runtime. |
| `TRUST_PROXY_HOPS` | backend | Proxies in front of the backend, so rate limiting sees real client addresses. `1` for a compose stack or Railway's private network. |
| `CLIENT_IP_HEADER` | frontend | Set to `CF-Connecting-IP` behind Cloudflare, and only if the frontend is reachable through Cloudflare alone. |
| `DISABLE_HTTPS_HEADERS` | both | `true` only for plain-HTTP local use. Leave `false` behind TLS. |

The full list, with defaults, is `.env.example`.

## Things to know before choosing

- **One backend replica.** MCP sessions live in memory, so a second replica would answer some of a client's requests without its session. Scheduled jobs are lease-guarded and safe to repeat; MCP is the reason to stay at one.
- **Attachments** default to the database, which works on hosts with no persistent disk. `ATTACHMENT_STORAGE_PROVIDER=s3` moves them to S3-compatible storage, including Cloudflare R2.
- **Automatic backups** write to the backend's disk, so they need a persistent volume. Without one they vanish on redeploy; take manual exports from Settings instead.
- **Large imports.** A Microsoft Money file can be hundreds of MB. The frontend buffers an upload while forwarding it, so the frontend needs memory to match (`MNY_IMPORT_LIMIT_MB`), and any platform in front with a smaller request limit will cut the upload off. Each guide says where that bites.
