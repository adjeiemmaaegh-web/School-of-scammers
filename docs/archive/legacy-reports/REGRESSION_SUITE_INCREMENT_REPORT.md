# PLC Skills Lab — Repeatable Regression Suite (2026-10-31)

Added `src/engineering/regression-suite.ts`, six Vitest test definitions, and a new panel in `InstructionLab.tsx`.

Cases have unique IDs, 1–100 steps, independent expected output assertions, and optional `requireEquivalent: false` for intentional changes. Each case resets state, compares candidate to reference after each scan, and evaluates candidate behavioral assertions. The suite caps at 20 cases and 50,000 total simulated scans. CSV export includes per-case result and first difference.

Verification: isolated engineering TypeScript typecheck passed; 7/7 Node assertions passed. Vitest execution, full React/Vite build, browser and hardware checks NOT run (dependencies absent). This is educational simulation, not certified PLC verification. The sample case assumes a RunLatch program and must be adapted for other ladder programs. GitHub and external systems unchanged.
