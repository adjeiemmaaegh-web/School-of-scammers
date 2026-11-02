# Stage 0 foundation / Stage 1 kernel increment

## Delivered
- Preserved the existing React/Vite prototype rather than replacing its frontend.
- Added standalone typed headless PLC scan kernel (`src/core/plc.ts`) with deterministic input sampling, contacts, coils, TON, CTU, state snapshots, trace output and validation.
- Added regression specifications (`tests/plc-core.test.ts`).
- Recorded upstream adoption, legal and runtime boundaries (`docs/adr`).
- Included current simulation-first PRD, architecture, roadmap and competitive review under `docs/product`.

## Not delivered
- No upstream OIP source imported, no legal clearance, no full ladder editor, no circuit solver, no Jolt integration, no production-grade 3D upgrade.
- New kernel is intentionally **not yet wired into the old demo scene**; integration is a later development increment.
- No backend, auth or database.

## Verification
- TypeScript syntax and standalone typecheck should be run with globally installed `tsc`.
- npm dependency installation, Vitest and Vite build require package registry access. Unavailable checks are not passes.
