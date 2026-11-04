# Railway

Three services in one project: PostgreSQL, the backend, the frontend. **Not deployed from this repository's sandbox**; the steps follow Railway's documented behaviour and the config files in the repository. Check the first deploy against Railway's current documentation.

## The one trap: the backend's build context

`backend/Dockerfile` copies `backend/`, `database/` and `docs/release-notes` into the image, so it must be built from the **repository root**. Do **not** set the backend service's Root Directory to `backend/`; the build would not find `database/schema.sql`. The frontend is the opposite: its context is `frontend/`.

## Steps

1. **New project**, then **Add PostgreSQL**.
2. **Backend service**: add the GitHub repository.
   - Settings, *Config as Code* path: `/backend/railway.json` (builds `backend/Dockerfile`, health check `/api/v1/health/live`).
   - Root Directory: leave empty (repository root).
   - Do not generate a public domain; the frontend reaches it over the private network.
   - Variables:
     ```
     PORT=3000
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=${{secret(64)}}
     ENCRYPTION_KEY=${{secret(64)}}
     PUBLIC_APP_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
     CORS_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
     LOCAL_AUTH_ENABLED=true
     REGISTRATION_ENABLED=true
     TRUST_PROXY_HOPS=1
     ```
3. **Frontend service**: add the same repository.
   - *Config as Code* path: `/frontend/railway.json`. Root Directory: `frontend`.
   - Generate a public domain.
   - Variables:
     ```
     INTERNAL_API_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:3000
     PUBLIC_APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
     ```
4. Open the frontend's domain and register. The first account is the administrator.

The backend runs `db-init` and `db-migrate` on every start, so the database is created and upgraded by deploying.

## Details that matter

- **`PORT` is set to 3000 on the backend** so the frontend's `INTERNAL_API_URL` is deterministic; Railway would otherwise inject a random one.
- **TLS to the database**: Railway's private `DATABASE_URL` needs none. If you point at a public database URL, add `?sslmode=require`.
- **Private networking is IPv6.** Node's default `listen(port)` binds the dual-stack address, so the backend accepts those connections without a host setting.
- **Persistent disk**: attach a volume to the backend (for example at `/data`) only if you set `ATTACHMENT_STORAGE_PROVIDER=local` or want automatic backups to survive deploys.
- **Memory**: the frontend buffers uploads. On a small plan, lower `MNY_IMPORT_LIMIT_MB` (for example `50`) on both services so a large file is refused cleanly instead of killing the process.
- A one-click template cannot be stored in the repository: Railway templates are created in its dashboard.
