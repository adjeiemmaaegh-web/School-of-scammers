# PLC Skills Lab — Integrated PLC Scan Debugger and Deterministic Replay

**Development increment:** 2026-10-30. **Input baseline:** `PLC_Skills_Lab_Virtual_Factory_Acceptance_2026-10-30.zip`. **Status:** Source-engineering increment, **not** production acceptance.

## What changed

1. **New deterministic, isolated scan-debugger engine** (`src/engineering/scan-debugger.ts`) extending the existing PLC instruction lab without modifying the real workcell or virtual hardware simulator. All observations occur *after* the completed PLC scan.
2. **Five breakpoint families:** exact scan number; input and output coil rising/falling/either edges; rung enable/disable transitions; elapsed-time threshold crossings for TON/TOF/RTO; and CTU count threshold crossings. The engine stops after the earliest matching scan and preserves *all* simultaneous hits.
3. **Bounded evidence and replay:** up to 24 breakpoints, 1,000 input/scan actions, 200 breakpoint hits, and the most recent 500 simulated scan snapshots. The replay action log stores **actual executed scan counts**, including when a requested group was cut short by a breakpoint. Pure deterministic replay compares current scan, time, inputs, outputs, accumulator memory, and bounded history to the original session.
4. **Workbench interface:** extended the existing `InstructionLab.tsx` panel with input toggles, single scan and run-to-breakpoint controls (up to 10/50/500 scans), breakpoint editor and toggle/removal controls, pause notifications, recent hits, a live/historical watch table, rung power-flow inspection, and local CSV/JSON evidence exports. Historical selection never rewinds or alters simulated PLC state.
5. **Discoverability:** added a real available scan-debugger lab listing, workspace directory entry and knowledge-base reference; clarified usage and limitations in `README.md`.
6. **Tests and repeatable QA:** added `tests/scan-debugger.test.ts` with 16 Vitest test definitions and standalone native `qa/verify-scan-debugger.cjs` with 24 executable Node assertions; updated the stale workspace count in `tests/lab-portal.test.ts` to match the now-six actual workspaces.

## Verification actually executed

- **24/24 checks PASS** using `node qa/verify-scan-debugger.cjs`. This compiles the pure TypeScript engine with `tsc` and runs standalone Node strict assertions against scan breaks, I/O/rung edges, timer/counter thresholds, reset/disable/remove semantics, immutable state, bounded history, deterministic replay, evidence exports, invalid input rejection, and simulated FAT compatibility.
- **30/30 existing FAT native assertions PASS** using `node qa/verify-fat.cjs` against retained original commissioning code.
- **10/10 reference virtual factory-acceptance scenarios PASS** on the real deterministic workcell simulation.
- **16/16 added Vitest-style test definitions PASS under a custom Node assertion compatibility harness, NOT under Vitest itself**. These provide independent focused checks, but this harness is not a replacement for the actual test runner.
- **Core engineering source strict TypeScript compile PASS** with `tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts src/lab-catalog.ts`.
- **InstructionLab and LadderPowerFlow TSX focused semantic check PASS using temporary minimal React declarations**, with TypeScript strict null checks (this check did **not** use real React types). UI syntax transpilations of edited InstructionLab/LabPortal/catalog PASS.
- Archive ZIP integrity and SHA-256 member manifest are verified separately at packaging time.

## Explicit limitations and unresolved acceptance

- Actual `npm run test` / Vitest, full React TypeScript application typecheck, Vite production build, browser interaction, 3D rendering, physical electrical equipment and hardware have **not** been executed in this environment because the full frontend dependency/runtime toolchain is unavailable. No user-facing production readiness or formal acceptance claim.
- Debugging is **isolated** from the machine model. Input toggles in the instruction lab do not override the integrated workcell's supply, guard, terminal wiring, motor starter or other physical interlocks; no real PLC or physical wiring control is possible.
- Evidence replay proves internal deterministic consistency of a simulation, **not** a physical event, safety compliance, forensic integrity, or real PLC equivalence.
- No backend, database, authentication, employer accounts, remote device control, cloud or payment processing. No GitHub push or deployment performed.

## Repeatable verification

From the archive root, with `node` and `tsc` on PATH:

```bash
node qa/verify-scan-debugger.cjs
node qa/verify-fat.cjs
```

After acquiring the declared `package.json` dependencies, perform the **still-open** actual application gates:

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Browser, keyboard/accessibility, mobile/tablet and practical physical equipment review remain separate owner-acceptance activities.
