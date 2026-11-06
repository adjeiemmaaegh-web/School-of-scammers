# PLC Skills Lab — Sequential Test Quality / Mutation Analysis

Source baseline: PLC_Skills_Lab_Sequential_PLC_Testing_2026-10-30.zip (unpacked project folder).

## Delivered
- Deterministic read-only mutation generation for ladder contact polarity, branch contacts, timer presets, counter presets, and pulse-edge instruction selection.
- Runs the existing sequential test vectors against each mutated ladder document, reports detected versus surviving defects and first failing step.
- Bounded to 80 generated mutants; source ladder document remains unchanged.
- UI panel integrated into the PLC Instruction Lab with detection score, per-mutant evidence and CSV export.
- Five Vitest test definitions added.

## Verification
- Core TypeScript compilation: PASS (`tsc --noEmit ... src/engineering/ladder-mutation.ts`).
- Standalone native Node assertions: 7/7 PASS (generation, source immutability, determinism, detection, score accounting, survivor behavior, invalid baseline, CSV).
- The example start-stop test detected 5 of 5 generated mutations; this is not a global test quality score.
- Full Vite/React build, Vitest runner, browser and physical hardware tests: NOT RUN / UNVERIFIED.

## Limitations
- Mutation analysis is educational and limited to specified transformations; it is not formal verification or a safety certification.
- Surviving mutations may be equivalent to the original for the supplied vectors; no equivalence proof is attempted.
- Only simulated PLC signals are used; no physical I/O forcing or backend is introduced.
- No GitHub push or deployment performed.
