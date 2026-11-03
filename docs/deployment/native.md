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

- **Ubuntu**: a verification run on Ubuntu with PostgreSQL 16 was in progress when this was committed. Its result replaces this line.
- **macOS**: the script has a Homebrew branch, but it has **not been run on a Mac**. It uses the current user as the PostgreSQL administrator, which is what Homebrew's PostgreSQL sets up.

## Plain HTTP

The generated environment sets `DISABLE_HTTPS_HEADERS=true` so login cookies work on `http://localhost`. If you put a TLS-terminating proxy (nginx, Caddy) in front, set it to `false` and set `PUBLIC_APP_URL` and `CORS_ORIGIN` to the `https://` address.
