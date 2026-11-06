# PLC Skills Lab — Generated MC/DC evidence lifecycle repair (2026-10-31)

## Defect and fix
In the MC/DC vector generation action, `setGeneratedVectors(result)` occurred before `updateSequenceText(...)`. The latter invalidates all sequence-derived reports, including generated vectors, so React batched updates left the newly generated witness report null. Learners could see generated steps but not the associated witness summary or CSV export. The action now invalidates previous evidence and loads the generated steps first, then retains the fresh witness report. Manual sequence edits continue to clear the witness report and disable export.

## Reproducible verification
- `node scripts/check-generated-vector-freshness.cjs`: 5 source-level lifecycle assertions passed.
- `node scripts/check-evidence-freshness.cjs`: 22 existing source-level assertions passed.
- `tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts`: passed.
- `node scripts/integration-smoke.cjs /mnt/data/plc-integration-compiled/engineering`: 8 previously compiled engineering integration assertions passed. The compiled modules were produced in a prior increment and do not validate the new React UI change.
- ZIP integrity verified independently.

## Limitations
Full React/Vite build, Vitest runner, browser interactions and physical hardware testing remain unverified; frontend dependencies are absent. The source-order checks do not substitute for a browser test. No backend, cloud, deployment, or GitHub changes.
