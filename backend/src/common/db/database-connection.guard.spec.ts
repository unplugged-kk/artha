import { readFileSync } from "fs";
import { join } from "path";

// The four boot paths build their connection from `resolveDatabaseConnection`
// or they silently stop supporting DATABASE_URL and TLS -- the failure only
// shows up on a managed host, where it is a boot loop with no useful message.
// Reading DATABASE_HOST directly in one of them is exactly how that happens.
const SRC = join(__dirname, "..", "..");
const BOOT_FILES = [
  "app.module.ts",
  "db-init.ts",
  "db-migrate.ts",
  "db-demo-check.ts",
];

// Strip comments so prose that names the variable does not trip the scan.
const code = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, "");

describe("database connection resolution", () => {
  it.each(BOOT_FILES)(
    "%s resolves through resolveDatabaseConnection",
    (file) => {
      expect(code(file)).toContain("resolveDatabaseConnection");
    },
  );

  it.each(BOOT_FILES)(
    "%s does not read DATABASE_HOST/PORT directly",
    (file) => {
      expect(code(file)).not.toMatch(/DATABASE_(HOST|PORT)/);
    },
  );

  it.each(["db-init.ts", "db-migrate.ts", "db-demo-check.ts"])(
    "%s hands the resolved ssl setting to its client",
    (file) => {
      expect(code(file)).toMatch(/ssl:\s*conn\.ssl/);
    },
  );
});
