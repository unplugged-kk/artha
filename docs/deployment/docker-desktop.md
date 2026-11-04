# Docker Desktop (Mac, Windows, Linux)

This runs the same compose files the Ubuntu server uses, so what works here is what ships.

Verified: both compose files parse with `docker compose config`. Not verified: an actual `up` on Docker Desktop, because the sandbox this was prepared in has the Docker client but no daemon. Treat the first start on your machine as the real test.

## Prerequisites

Docker Desktop with Compose v2, about 4 GB of memory given to Docker, and ports 3000 and 3001 free.

## Run it, development

```bash
cp .env.example .env
```

Edit `.env` and set `JWT_SECRET` and `ENCRYPTION_KEY` to different random strings of at least 32 characters. One way to make one:

```bash
openssl rand -base64 48
```

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Open `http://localhost:3001` (the dev frontend) and register. The first account becomes the administrator. The backend is on `http://localhost:3000`. The database is bound to `127.0.0.1:5432` only.

## Run it, production-shaped

```bash
docker compose -f docker-compose.prod.yml up -d
```

This needs `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET` and `ENCRYPTION_KEY` in `.env`. It serves the app on `FRONTEND_PORT` (default 3000).

## Apple silicon and Windows

Images build for the host architecture, so an M-series Mac builds arm64 images with no extra flags. On Windows use the WSL 2 backend and keep the repository inside the WSL filesystem, not under `/mnt/c`, or file watching and builds are slow.

## Stop, reset, back up

```bash
docker compose -f docker-compose.dev.yml down
```

Add `-v` to also delete the database volume. That erases your data. Use the in-app backup (Settings) before you do.

## Currencies

INR is the default currency. USD, AED, SAR, KWD, EUR, GBP and the rest of the catalogue are created when first added under Currencies, or on first use. KWD, BHD and OMR keep three decimals. `e2e/tests/multi-currency.spec.ts` checks this.
