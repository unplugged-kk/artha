# Ubuntu and macOS without Docker

`scripts/install-native.sh` installs and runs Artha directly: Node, PostgreSQL, a built backend and a built frontend. For a server, Docker Compose (`docker-compose.prod.yml`) is still the recommended route; this is for machines where Docker is unwelcome, and for local use.

```bash
scripts/install-native.sh --install-deps --start
```

Then open http://localhost:3000. Stop with `scripts/install-native.sh --stop`.

## What it does

1. Checks Node 22+, npm, openssl, curl and PostgreSQL. `--install-deps` installs PostgreSQL, openssl and curl with `apt` (Ubuntu/Debian) or Homebrew (macOS). **It never installs Node for you**; use nvm, fnm or your platform's package and re-run.
2. Creates a database role and database, leaving existing ones alone (`--db-name`, `--db-user` to choose names).
3. Writes `.env.native` with generated secrets, mode 600, and keeps it if it exists. It is git-ignored.
4. Installs dependencies and builds both apps, with `NODE_ENV` unset so build tools are installed.
5. Applies the schema and migrations.
6. With `--start`, runs both servers in the background; logs are in `.native/`.

The script is safe to run again. `--skip-build` reuses an earlier build.

## Verified, and not

- **Ubuntu 24.04, PostgreSQL 16**: run end to end. Dependencies installed, both apps built, all 195 migrations applied, both servers started and stopped, and a user registered through the frontend.
  - Both servers listen on `127.0.0.1` only; a request to the machine's external address is refused. `--stop` leaves no process behind. `--public` opens the frontend alone and prints a warning; the backend stays on loopback.
  - The database password never appears in a command line or in the server log: with `log_statement=ddl` switched on, the previous approach (password inside `psql -c`) wrote it to the log and this one does not.
- **macOS**: the script has a Homebrew branch, but it has **not been run on a Mac**. It uses the current user as the PostgreSQL administrator, which is what Homebrew's PostgreSQL sets up.

## Who can reach it

The backend binds to loopback so the frontend is the only way in. That matters because the frontend is the hop that tells the backend which address a visitor has, and the backend's rate limiting trusts it (`TRUST_PROXY_HOPS=1` stays correct for exactly that reason: the frontend is one proxy). The frontend binds to loopback too. `--public` exposes it on every interface; before you do, put a TLS reverse proxy in front that **overwrites** `X-Real-IP` and `X-Forwarded-For`, because the frontend takes them as the visitor's address and anyone reaching it directly could write their own.

## Plain HTTP

The generated environment sets `DISABLE_HTTPS_HEADERS=true` so login cookies work on `http://localhost`. If you put a TLS-terminating proxy (nginx, Caddy) in front, set it to `false` and set `PUBLIC_APP_URL` and `CORS_ORIGIN` to the `https://` address.
