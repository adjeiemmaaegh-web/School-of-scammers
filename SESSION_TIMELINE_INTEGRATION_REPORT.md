# PLC Skills Lab — Offline replay timeline integration

## Changes
- Reconstructs the latest 200 simulated scan states when importing a recorded session, rather than discarding the scan debugger history.
- Rebuilds scan-instrument evidence from retained replay states.
- Displays actual scan numbers in the debugger after rolling-window truncation.
- Prevents additional live actions once the 2,000-action recording cap is reached, avoiding silent divergence between live state and exportable evidence.
- Adds four Vitest regression definitions covering short/long/empty sessions and retention validation.

## Verification
- Engineering TypeScript standalone compilation: PASS.
- Native replay timeline assertions: 6/6 PASS.
- Offline integration checks: PASS (156 relative imports, 28 navigation targets; 4 negative/baseline checks).
- Full Vite build, Vitest suite, real browser and hardware acceptance: NOT RUN (frontend dependencies unavailable).

## Boundaries
Only the most recent 200 scan states are shown in the debugger; the exported session retains up to 2,000 actions. This is simulated evidence, not physical PLC verification. No backend, deployment or GitHub modifications.
