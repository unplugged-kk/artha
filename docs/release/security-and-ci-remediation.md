# Security and CI remediation

Baseline: `main` `862626cce`, CI run `43570068476`. Four jobs were red before the fund-classification merges, so none was introduced by them.

| Job | Cause | Change | Local evidence | CI |
|---|---|---|---|---|
| License Compliance (backend) | `buffers@0.1.1` reports `UNKNOWN`; no license in the package, npm metadata, or a resolvable upstream | `overrides.unzipper = ^0.12.3` removes `exceljs -> unzipper@0.10 -> binary -> buffers` from the production tree. Not allowlisted | `license-checker` summary clean; 21 xlsx specs pass | pending |
| NPM Audit | runtime criticals (`next`, `proxy-addr`, `dompurify`), highs (`nodemailer`, `undici`, `axios`, `multer`, `zod`, MCP SDK) | `npm audit fix` in both workspaces; `nodemailer` ^10.5.0 and `@nestjs/cli` ^12.0.13 (backend); `brace-expansion` override 5.0.9 to 5.0.13 (both); `axios` 1.21 types need a cast in two test files | `scripts/npm-audit-gate.mjs`: 0 high, 0 critical in both. Frontend: 883 files, 16,810 tests pass, `tsc` clean. Backend: `tsc` and `nest build` clean, 61 of 62 targeted suites pass | pending |
| Documentation vs Manifests | `XLSX_IMPORT_LIMIT_MB` read in `xlsx-import.controller.ts:44`, undocumented | documented in `.env.example` | `check-env-docs.mjs` passes | pending |
| Bearer Security Scan | HIGH CWE-73 at `scripts/a11y-audit.cjs:51`; operator-run script, argv is the output directory | inline `bearer:disable` with the reason | not re-scanned | pending |

## Not resolved

- 15 Bearer exceptions are past their review-by date (issue #29 lists 8). Each needs a fresh read of its code path; none was
  extended.
- Backend moderate advisories remain (3 by the repo gate, 26 by plain `npm audit`); none is high or critical.
- `src/module-graph.spec.ts` ran out of memory in a 2 GB worker on this host (infrastructure, not an assertion). It was not
  re-run alone. A full backend unit run did not finish on this 2-core host.
- Enforce-mode RLS and the auth and 2FA review are not done.
