# PLC Skills Lab — Signal Stability Increment (2026-10-31)

Added `src/engineering/signal-stability.ts` with scan-level consecutive-signal stability windows, optional trigger-based observation, early-glitch detection, pending observations, bounded evidence, and CSV export. Integrated the rules editor, execution, report table and CSV export in `src/components/InstructionLab.tsx`. Added seven Vitest test definitions in `tests/signal-stability.test.ts`.

Verification performed: standalone engineering TypeScript noEmit passed; CommonJS compilation and nine native Node assertions passed; ZIP integrity checked. Full React/Vite build, actual Vitest execution, browser/real hardware testing not performed. This educational simulated monitor is not an industrial safety validation. No backend, cloud, or GitHub changes.
