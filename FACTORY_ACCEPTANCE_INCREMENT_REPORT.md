# PLC Skills Lab — Integrated Virtual Factory Acceptance Testing

Date: 2026-10-30. Development-only source increment. Baseline: `PLC_Skills_Lab_Advanced_PLC_Programming_2026-10-30.zip`.

## Scope and delivered behavior

A deterministic, isolated educational acceptance-test engine runs the learner's current ladder program against genuine workcell steps; it does not substitute hard-coded input/response assertions for plant simulation.

Ten scenarios: startup permissives, STOP, guard opening/restart, power-loss/restart, sensor-circuit open, starter fuse failure, overload trip, conveyor product/photocell transfer, belt slipping and isolated repair, and a welded-contactor *hazard detection* case. Each procedure begins with a fresh machine, executes real 20 ms PLC scans, and produces criterion-level expected/observed results and bounded machine evidence.

Two test configurations are selectable: a reference fixture with properly connected I0.2, and the learner's own wiring-board configuration. In board mode the sensor-loss test opens the actual I0.2 board input wiring only in the private simulation harness, leaving the supplied board unchanged. Broken motor-start logic, missing sensor/guard permissives and disconnected board inputs generate failed checks instead of false passes. Simulation runtime exceptions are recorded as case failures; malformed ladder and case selection are rejected upfront.

UI integration: an acceptance panel in the engineering studio with fixture selection, a 10-case suite or individual scenario, per-case results, expected-versus-observed checks, machine checkpoint inspection, and downloadable JSON, checks CSV and evidence CSV. The lab catalogue, workspaces directory, reference knowledge base and README now introduce the acceptance lab.

**Safety caveat:** The welded-contactor scenario **passes when a dangerous STOP failure is observed**, not when STOP safely removes motor power. This is an educational deterministic model and not a safety validation, manufacturer protocol, certified PLC executor, or industrial FAT sign-off.

## Files

New:
- `src/engineering/factory-acceptance.ts`
- `src/components/FactoryAcceptanceLab.tsx`
- `tests/factory-acceptance.test.ts`
- `qa/verify-fat.cjs`
- `FACTORY_ACCEPTANCE_INCREMENT_REPORT.md`
- `FACTORY_ACCEPTANCE_SOURCE_MANIFEST.json`

Modified:
- `src/components/EngineeringWorkbench.tsx`
- `src/components/LabPortal.tsx`
- `src/lab-catalog.ts`
- `src/style.css`
- `README.md`

All previous app source under `src/`, regression tests under `tests/`, and `docs/` files were retained. Old compiled `.corecheck/` and `.verify/` transient verification products and a zero-byte `TEST` placeholder are excluded from the new source archive; prior reports remain available.

## Local verification completed

- `tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts` — **pass**.
- `node qa/verify-fat.cjs` — **30/30** deterministic native Node assertions **pass**, compiling a temporary CommonJS copy using local TypeScript.
- `tests/factory-acceptance.test.ts` — **24/24** test cases **pass under a Node assertion compatibility harness**, after real TypeScript compilation; **not a Vitest runner execution**.
- `FactoryAcceptanceLab.tsx` — targeted TypeScript semantic check **pass using a minimal temporary React type shim** (not real package types).
- Four changed TS/TSX UI/catalog files — syntactic transpilation **pass**.
- Reference workcell FAT suite: **10/10 simulated procedures pass**, 580 scan ticks (this is simulation behavior only).

Full React/Vite project typecheck/build, actual Vitest, Chromium/browser interaction, 3D graphics, real PLC or electrical hardware: **NOT EXECUTED** because complete frontend dependencies and test/browser infrastructure are unavailable in this execution environment. No deployment readiness or formal product acceptance claim.

## Architecture boundaries

No backend, database, authentication, SaaS, employer accounts, cloud sync, remote device control, GitHub push, or commercial deployment added. All tests are offline and operate exclusively on synthetic workcell state.
