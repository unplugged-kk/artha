/**
 * One place that turns the environment into a PostgreSQL connection.
 *
 * Managed hosts (Railway, Neon, Supabase, Render, Fly) hand out a single
 * `DATABASE_URL`; self-hosted compose files set `DATABASE_HOST`/`PORT`/`USER`/
 * `PASSWORD`/`NAME`. The app, `db-init`, `db-migrate` and `db-demo-check` each
 * built their own connection from the second form, so the first never worked --
 * and the two migration scripts ignored `DATABASE_SSL` altogether, which a
 * managed host that requires TLS turns into a boot failure before the server
 * starts.
 *
 * `DATABASE_URL` wins when it is set. Explicit `DATABASE_SSL` and
 * `DATABASE_SSL_REJECT_UNAUTHORIZED` win over what the URL's `sslmode` implies.
 * The URL is never echoed in an error: it carries the password.
 */

export type DatabaseSsl = false | { rejectUnauthorized: boolean };

export interface DatabaseConnection {
  readonly host: string;
  readonly port: number;
  readonly user: string | undefined;
  readonly password: string | undefined;
  readonly database: string | undefined;
  readonly ssl: DatabaseSsl;
}

export type EnvReader = (key: string) => string | undefined;

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The database port must be an integer from 1 to 65535");
  }
  return port;
}

function sslFromMode(mode: string | null): DatabaseSsl {
  switch (mode) {
    case "require":
    case "no-verify":
      // libpq's `require` encrypts but does not verify the certificate.
      return { rejectUnauthorized: false };
    case "verify-ca":
    case "verify-full":
      return { rejectUnauthorized: true };
    default:
      // disable, allow, prefer and absent: no TLS unless DATABASE_SSL says so.
      return false;
  }
}

export function resolveDatabaseConnection(get: EnvReader): DatabaseConnection {
  const rawUrl = get("DATABASE_URL")?.trim();
  let base: Omit<DatabaseConnection, "ssl">;
  let ssl: DatabaseSsl;

  if (rawUrl) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error("DATABASE_URL is not a valid URL");
    }
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error(
        "DATABASE_URL must start with postgres:// or postgresql://",
      );
    }
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!url.hostname || !database) {
      throw new Error("DATABASE_URL must name a host and a database");
    }
    base = {
      host: decodeURIComponent(url.hostname),
      port: parsePort(url.port, 5432),
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database,
    };
    ssl = sslFromMode(url.searchParams.get("sslmode"));
  } else {
    base = {
      host: get("DATABASE_HOST")?.trim() || "localhost",
      port: parsePort(get("DATABASE_PORT"), 5432),
      user: get("DATABASE_USER") || undefined,
      password: get("DATABASE_PASSWORD") || undefined,
      database: get("DATABASE_NAME") || undefined,
    };
    ssl = false;
  }

  const explicit = get("DATABASE_SSL")?.toLowerCase();
  if (explicit === "true") {
    ssl = { rejectUnauthorized: ssl === false ? true : ssl.rejectUnauthorized };
  } else if (explicit === "false") {
    ssl = false;
  }
  if (ssl !== false && get("DATABASE_SSL_REJECT_UNAUTHORIZED") === "false") {
    ssl = { rejectUnauthorized: false };
  }
  return { ...base, ssl };
}
