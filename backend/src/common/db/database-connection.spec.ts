import { resolveDatabaseConnection } from "./database-connection";

const reader = (env: Record<string, string>) => (k: string) => env[k];

describe("resolveDatabaseConnection: separate variables", () => {
  it("reads host, port, user, password and name", () => {
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_HOST: "db",
          DATABASE_PORT: "6543",
          DATABASE_USER: "u",
          DATABASE_PASSWORD: "p",
          DATABASE_NAME: "n",
        }),
      ),
    ).toEqual({
      host: "db",
      port: 6543,
      user: "u",
      password: "p",
      database: "n",
      ssl: false,
    });
  });

  it("defaults to localhost:5432 and leaves credentials undefined", () => {
    expect(resolveDatabaseConnection(reader({}))).toEqual({
      host: "localhost",
      port: 5432,
      user: undefined,
      password: undefined,
      database: undefined,
      ssl: false,
    });
  });

  it("refuses an out-of-range or non-numeric port", () => {
    for (const bad of ["0", "70000", "abc", "5432.5"]) {
      expect(() =>
        resolveDatabaseConnection(reader({ DATABASE_PORT: bad })),
      ).toThrow(/port/);
    }
  });
});

describe("resolveDatabaseConnection: DATABASE_URL", () => {
  it("parses a Railway-style URL", () => {
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_URL:
            "postgresql://postgres:s3cret@postgres.railway.internal:5432/railway",
        }),
      ),
    ).toEqual({
      host: "postgres.railway.internal",
      port: 5432,
      user: "postgres",
      password: "s3cret",
      database: "railway",
      ssl: false,
    });
  });

  it("decodes percent-encoded credentials", () => {
    const c = resolveDatabaseConnection(
      reader({
        DATABASE_URL: "postgres://us%40er:p%2Fa%3Fss@h:5432/db%20name",
      }),
    );
    expect(c.user).toBe("us@er");
    expect(c.password).toBe("p/a?ss");
    expect(c.database).toBe("db name");
  });

  it("wins over the separate variables", () => {
    const c = resolveDatabaseConnection(
      reader({
        DATABASE_URL: "postgres://a:b@urlhost/urldb",
        DATABASE_HOST: "other",
      }),
    );
    expect(c.host).toBe("urlhost");
    expect(c.database).toBe("urldb");
  });

  it.each([
    ["require", { rejectUnauthorized: false }],
    ["no-verify", { rejectUnauthorized: false }],
    ["verify-ca", { rejectUnauthorized: true }],
    ["verify-full", { rejectUnauthorized: true }],
    ["disable", false],
    ["prefer", false],
  ])("sslmode=%s", (mode, want) => {
    expect(
      resolveDatabaseConnection(
        reader({ DATABASE_URL: `postgres://a:b@h/d?sslmode=${mode}` }),
      ).ssl,
    ).toEqual(want);
  });

  it("DATABASE_SSL overrides the URL in both directions", () => {
    const url = "postgres://a:b@h/d";
    expect(
      resolveDatabaseConnection(
        reader({ DATABASE_URL: url, DATABASE_SSL: "true" }),
      ).ssl,
    ).toEqual({
      rejectUnauthorized: true,
    });
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_URL: url + "?sslmode=require",
          DATABASE_SSL: "false",
        }),
      ).ssl,
    ).toBe(false);
  });

  it("DATABASE_SSL_REJECT_UNAUTHORIZED=false relaxes verification only when TLS is on", () => {
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_URL: "postgres://a:b@h/d?sslmode=verify-full",
          DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
        }),
      ).ssl,
    ).toEqual({ rejectUnauthorized: false });
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_URL: "postgres://a:b@h/d",
          DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
        }),
      ).ssl,
    ).toBe(false);
  });

  it("matches the existing separate-variable behaviour for DATABASE_SSL=true", () => {
    expect(
      resolveDatabaseConnection(reader({ DATABASE_SSL: "true" })).ssl,
    ).toEqual({
      rejectUnauthorized: true,
    });
    expect(
      resolveDatabaseConnection(
        reader({
          DATABASE_SSL: "true",
          DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
        }),
      ).ssl,
    ).toEqual({ rejectUnauthorized: false });
  });

  it("never puts the URL or the password in an error", () => {
    for (const url of [
      "mysql://u:topsecret@h/d",
      "postgres://u:topsecret@/d",
      "not a url topsecret",
      "postgres://u:topsecret@h/",
    ]) {
      try {
        resolveDatabaseConnection(reader({ DATABASE_URL: url }));
        throw new Error("expected a throw");
      } catch (e) {
        expect(String((e as Error).message)).not.toContain("topsecret");
      }
    }
  });

  it("an empty DATABASE_URL falls back to the separate variables", () => {
    expect(
      resolveDatabaseConnection(
        reader({ DATABASE_URL: "  ", DATABASE_HOST: "x" }),
      ).host,
    ).toBe("x");
  });
});
