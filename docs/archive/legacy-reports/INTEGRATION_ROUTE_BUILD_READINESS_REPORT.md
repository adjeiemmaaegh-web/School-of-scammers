# PLC Skills Lab — Source Integration / Build Readiness

2026-10-31

## Engineering changes
- Corrected the assessment result's **Back to learner lab** navigation from the nonexistent `/learn` route to the existing `/labs` catalogue.
- Added `scripts/check-integration-contracts.cjs`: parses actual TypeScript/TSX imports, verifies relative source module resolution, and cross-checks the application's literal navigation destinations and catalogue/workspace destinations against registered routes.
- Added `scripts/test-integration-contracts.cjs` with negative mutation tests that verify missing routes and missing imports are detected, and that the source is restored.
- Added `npm run check:integration` and `npm run verify:offline` scripts. Neither requires app dependencies, though TypeScript must be installed locally or globally.

## Evidence
- Source gate passed: 61 TS/TSX files, 151 relative imports, 28 navigation destinations, 11 registered routes including wildcard.
- 4/4 source contract assertions passed, including two negative checks.
- `npm install --ignore-scripts --no-audit --no-fund --prefer-offline --fetch-retries=0` attempted, but npm registry DNS returned `EAI_AGAIN`; dependencies could not be installed.

## Open verification
- Full React/Vite build, full Vitest run, and browser acceptance remain **unverified**. The static integration gate is a useful safeguard, not a substitute for those checks.
- No backend, deployment, cloud, or GitHub modifications.
