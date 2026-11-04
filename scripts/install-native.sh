#!/usr/bin/env bash
# Install and run Artha without Docker, on Ubuntu/Debian or macOS.
#
#   scripts/install-native.sh [--install-deps] [--start]
#   scripts/install-native.sh --stop
#
# What it does, in order, and safely to repeat:
#   1. checks Node (22+), npm, openssl, curl and PostgreSQL (psql)
#   2. creates a database role and database (it never touches existing ones)
#   3. writes .env.native with generated secrets (mode 600; kept if it exists)
#   4. installs dependencies and builds the backend and the frontend
#   5. applies the schema and migrations
#   6. with --start, runs both servers in the background (logs in .native/)
#
# Flags
#   --install-deps   install PostgreSQL, openssl and curl with apt (Ubuntu/Debian)
#                    or Homebrew (macOS). Node is never installed for you: use
#                    nvm, fnm or your platform's package, then re-run.
#   --db-name NAME   database to create/use          (default: artha)
#   --db-user NAME   role to create/use              (default: artha_user)
#   --skip-build     reuse an earlier build
#   --start          start the servers once everything is ready
#   --public         let the FRONTEND listen on every network interface (default:
#                    this machine only). The backend never does. Put a TLS reverse
#                    proxy in front first, and make it overwrite X-Real-IP and
#                    X-Forwarded-For: the frontend trusts them as the visitor's
#                    address, so without that anyone can choose theirs.
#   --stop           stop servers started with --start, then exit
#
# The generated .env.native is for plain-HTTP local use (DISABLE_HTTPS_HEADERS is
# true, so cookies work on http://localhost). Behind TLS, set it to false.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.native"
STATE_DIR="$ROOT/.native"
DB_NAME="artha"
DB_USER="artha_user"
INSTALL_DEPS=0
SKIP_BUILD=0
START=0
STOP=0
FRONTEND_HOST="127.0.0.1"
BACKEND_HOST="127.0.0.1"
BACKEND_PORT=3001
FRONTEND_PORT=3000

say()  { printf '==> %s\n' "$*"; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --install-deps) INSTALL_DEPS=1 ;;
    --skip-build)   SKIP_BUILD=1 ;;
    --start)        START=1 ;;
    --stop)         STOP=1 ;;
    --public)       FRONTEND_HOST="0.0.0.0" ;;
    --db-name)      shift; DB_NAME="${1:?--db-name needs a value}" ;;
    --db-user)      shift; DB_USER="${1:?--db-user needs a value}" ;;
    -h|--help)      sed -n '2,36p' "$0"; exit 0 ;;
    *)              die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

# Identifiers go into SQL, so they are restricted to plain names.
case "$DB_NAME$DB_USER" in
  *[!A-Za-z0-9_]*) die "--db-name and --db-user may contain only letters, digits and underscore" ;;
esac

stop_servers() {
  local stopped=0
  for name in backend frontend; do
    local pidfile="$STATE_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      local pid; pid="$(cat "$pidfile")"
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && stopped=1
        for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
      fi
      rm -f "$pidfile"
    fi
  done
  [ "$stopped" = 1 ] && say "stopped" || say "nothing was running"
}

if [ "$STOP" = 1 ]; then stop_servers; exit 0; fi

OS="$(uname -s)"
case "$OS" in
  Linux)  command -v apt-get >/dev/null 2>&1 || say "no apt-get found: install PostgreSQL 16, Node 22+, openssl and curl yourself" ;;
  Darwin) ;;
  *)      die "unsupported OS: $OS (Ubuntu/Debian and macOS are supported)" ;;
esac

# ---- 1. prerequisites -------------------------------------------------------
if [ "$INSTALL_DEPS" = 1 ]; then
  if [ "$OS" = "Linux" ]; then
    say "installing PostgreSQL, openssl and curl with apt"
    SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
    $SUDO apt-get update -y
    $SUDO apt-get install -y postgresql postgresql-contrib openssl curl ca-certificates
    $SUDO service postgresql start 2>/dev/null || $SUDO systemctl start postgresql 2>/dev/null || true
  else
    command -v brew >/dev/null 2>&1 || die "Homebrew is required for --install-deps on macOS (https://brew.sh)"
    say "installing PostgreSQL 16 with Homebrew"
    brew install postgresql@16 openssl curl
    brew services start postgresql@16
    export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
  fi
fi

for tool in node npm openssl curl psql; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed (re-run with --install-deps, or install it yourself)"
done
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || die "Node 22 or newer is required (found $(node -v)); install it with nvm or fnm"

# ---- 2. database ------------------------------------------------------------
# The admin command: the postgres OS user on Linux, the current user on macOS.
admin_psql() {
  if [ "$OS" = "Darwin" ]; then
    psql -X -v ON_ERROR_STOP=1 -d postgres "$@"
  elif [ "$(id -u)" -eq 0 ]; then
    su postgres -c "psql -X -v ON_ERROR_STOP=1 -d postgres $(printf '%q ' "$@")"
  else
    sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d postgres "$@"
  fi
}
# SQL arrives on stdin, never as an argument: a password in argv is visible to
# every local user in `ps`, and the statement is also kept out of the server log.
admin_sql() {
  if [ "$OS" = "Darwin" ]; then
    psql -X -q -v ON_ERROR_STOP=1 -d postgres -f -
  elif [ "$(id -u)" -eq 0 ]; then
    su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -d postgres -f -"
  else
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d postgres -f -
  fi
}
pg_ready() { admin_psql -tAc "select 1" >/dev/null 2>&1; }
pg_ready || die "cannot reach PostgreSQL as an administrator; is it running? (Linux: sudo service postgresql start)"

PG_MAJOR="$(admin_psql -tAc "show server_version_num" | tr -d '[:space:]' | cut -c1-2)"
[ "${PG_MAJOR:-0}" -ge 16 ] || say "warning: PostgreSQL ${PG_MAJOR:-?} found; Artha is developed and tested against 16"

# ---- 3. environment file ----------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  say "using existing $ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
  DB_USER="${DATABASE_USER:-$DB_USER}"; DB_NAME="${DATABASE_NAME:-$DB_NAME}"
  DB_PASSWORD="${DATABASE_PASSWORD:?$ENV_FILE has no DATABASE_PASSWORD}"
else
  say "writing $ENV_FILE with generated secrets"
  DB_PASSWORD="$(openssl rand -hex 24)"
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASSWORD
DATABASE_NAME=$DB_NAME
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
LOCAL_AUTH_ENABLED=true
REGISTRATION_ENABLED=true
PUBLIC_APP_URL=http://localhost:$FRONTEND_PORT
CORS_ORIGIN=http://localhost:$FRONTEND_PORT
INTERNAL_API_URL=http://127.0.0.1:$BACKEND_PORT
DISABLE_HTTPS_HEADERS=true
EOF
  set -a; . "$ENV_FILE"; set +a
fi

say "preparing database '$DB_NAME' for role '$DB_USER'"
if [ "$(admin_psql -tAc "select 1 from pg_roles where rolname='$DB_USER'" | tr -d '[:space:]')" = "1" ]; then
  ROLE_VERB="ALTER"
else
  ROLE_VERB="CREATE"
fi
# Single quotes in a reused password are doubled; the generated one is hex.
SQL_PASSWORD="${DB_PASSWORD//\'/\'\'}"
printf "SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nSET log_min_error_statement = 'panic';\n%s ROLE %s WITH LOGIN PASSWORD '%s';\n" \
  "$ROLE_VERB" "$DB_USER" "$SQL_PASSWORD" | admin_sql
if [ "$(admin_psql -tAc "select 1 from pg_database where datname='$DB_NAME'" | tr -d '[:space:]')" != "1" ]; then
  admin_psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER"
fi

# ---- 4. build ---------------------------------------------------------------
if [ "$SKIP_BUILD" = 0 ]; then
  # NODE_ENV=production (from .env.native) must not reach npm: it makes `npm ci`
  # skip devDependencies, and the Nest and Next build tools are devDependencies.
  say "installing and building the backend"
  (unset NODE_ENV; cd backend && npm ci --no-audit --no-fund && npm run build)
  say "installing and building the frontend"
  (unset NODE_ENV; cd frontend && npm ci --no-audit --no-fund && npm run build)
else
  say "skipping build"
fi
[ -f backend/dist/main.js ] || die "backend/dist/main.js is missing; run without --skip-build"

# ---- 5. schema --------------------------------------------------------------
say "applying schema and migrations"
(cd backend && node dist/db-init.js && node dist/db-migrate.js)

# ---- 6. start ---------------------------------------------------------------
if [ "$START" = 1 ]; then
  stop_servers >/dev/null
  mkdir -p "$STATE_DIR"
  # Something already answering on a port would make the new server fail to bind
  # while the old one passes the health check below, so refuse up front.
  for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    if curl -s -o /dev/null -m 2 "http://127.0.0.1:$port/" 2>/dev/null; then
      die "port $port is already in use by something this script did not start"
    fi
  done
  say "starting the backend on $BACKEND_HOST:$BACKEND_PORT (this machine only)"
  # `exec` makes the recorded PID the server's own, not a wrapper's, so --stop
  # stops the server rather than orphaning it.
  (cd backend && exec env PORT="$BACKEND_PORT" LISTEN_HOST="$BACKEND_HOST" node dist/main.js) > "$STATE_DIR/backend.log" 2>&1 &
  echo $! > "$STATE_DIR/backend.pid"
  if [ "$FRONTEND_HOST" = "0.0.0.0" ]; then
    say "WARNING: the frontend is listening on every interface (--public). Put a TLS reverse proxy in front that overwrites X-Real-IP and X-Forwarded-For."
  fi
  say "starting the frontend on $FRONTEND_HOST:$FRONTEND_PORT"
  (cd frontend && exec env PORT="$FRONTEND_PORT" ./node_modules/.bin/next start -H "$FRONTEND_HOST" -p "$FRONTEND_PORT") > "$STATE_DIR/frontend.log" 2>&1 &
  echo $! > "$STATE_DIR/frontend.pid"
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$BACKEND_PORT/api/v1/health/live" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf "http://127.0.0.1:$BACKEND_PORT/api/v1/health/live" >/dev/null 2>&1 \
    || die "the backend did not become healthy; see $STATE_DIR/backend.log"
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$FRONTEND_PORT/login" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf "http://127.0.0.1:$FRONTEND_PORT/login" >/dev/null 2>&1 \
    || die "the frontend did not answer; see $STATE_DIR/frontend.log"
  for name in backend frontend; do
    kill -0 "$(cat "$STATE_DIR/$name.pid")" 2>/dev/null \
      || die "the $name process exited; see $STATE_DIR/$name.log"
  done
  say "backend is healthy"
  say "open http://localhost:$FRONTEND_PORT   (stop with: scripts/install-native.sh --stop)"
else
  say "ready. To start the servers:"
  echo "    scripts/install-native.sh --skip-build --start"
fi
