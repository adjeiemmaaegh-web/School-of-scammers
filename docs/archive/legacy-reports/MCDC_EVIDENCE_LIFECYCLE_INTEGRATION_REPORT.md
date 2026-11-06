# PLC Skills Lab — MC/DC evidence lifecycle integration (2026-10-31)

## Fixed defect
The MC/DC generator action previously called `setGeneratedVectors(result)` before `updateSequenceText(...)`. The latter invokes `clearSequenceEvidence()`, including `setGeneratedVectors(null)`. In React's batched state updates this discarded the just-generated witness map and disabled CSV export. The action now updates the sequence and invalidates prior reports first, then retains the new witness map. Subsequent manual sequence edits still invalidate that map.

## Regression protection
Added `scripts/check-generated-evidence.cjs` with seven source integration guards, including a negative mutation that restores the old ordering and is rejected. Existing evidence-freshness guards continue to run.

## Executed verification
- Engineering TypeScript: `tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts` — PASS.
- `node scripts/check-evidence-freshness.cjs` — 22 checks PASS.
- `node scripts/check-generated-evidence.cjs` — 7 checks PASS; original-order mutation rejected.
- Compiled engineering CommonJS and ran `node scripts/integration-smoke.cjs /mnt/data/plc-integration-current/engineering` — 8 checks PASS.

## Unverified
React/Vite full build, actual Vitest execution, browser interaction and real hardware remain unverified because frontend dependencies are not installed. Source-level checks are not substitutes for browser interaction testing.

No backend, cloud, GitHub push, or deployment changes. Educational simulation only; no industrial safety certification.
