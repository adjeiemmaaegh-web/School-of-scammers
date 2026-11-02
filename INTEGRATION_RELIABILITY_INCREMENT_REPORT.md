# PLC Skills Lab — Integration reliability increment (2026-10-31)

## Focus
Moved from adding isolated feature panels to verifying interactions between sequential PLC execution, bounded fault evidence, and the consolidated fault matrix.

## Corrected
`src/engineering/fault-matrix.ts` previously calculated affected output tags from `trace.differences`, which is capped at 1000 detailed records. A late-appearing output could therefore be omitted even though full-scan impact tracking had observed it. Affected output attribution now uses `trace.impactWindows`, which is computed across every scan independently of the detailed evidence cap.

## Reproducible verification
- TypeScript engineering layer: `tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts` — passed.
- CommonJS compilation of all engineering modules — passed.
- `node scripts/integration-smoke.cjs /mnt/data/plc-integration-compiled/engineering` — passed; checks a 1100-scan, two-output delayed TON scenario, detail truncation, correct affected-output attribution, fault campaign counts, and source immutability.
- Added `tests/fault-matrix-evidence-completeness.test.ts` for future Vitest execution; not run locally.
- Full React/Vite build, Vitest, browser, hardware tests not verified because frontend dependencies are not available. An `npm install` attempt timed out; do not interpret as a passing build.

## Scope
No backend, cloud, GitHub changes, hardware control, or industrial safety certification. Existing source retained.
