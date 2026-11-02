# PLC Skills Lab — Input Bounce Injection

Adds deterministic scan-level input bounce injection to the existing editable sequential test bench. Select an input-change step and specify a bounded number of alternating transitions and settling scans. The generated sequence retains the original checkpoint expectation and subsequent steps, without mutating the original object. Instruction Lab exposes a JSON configuration and a button to inject into the sequence editor, clearing dependent stale reports.

## Verification
- Core TypeScript module: `tsc --noEmit` passed.
- Six focused native Node assertions passed.
- Six Vitest test definitions added but Vitest runner not executed.
- Full React/Vite build and browser testing not run; dependencies unavailable.
- No physical electrical bounce fidelity or industrial certification claimed.
