# Differential PLC regression testing — 2026-10-30

Added `src/engineering/ladder-differential.ts` and an Instruction Lab reference-program JSON editor and regression comparison. Both programs run independently across the same bounded multi-scan inputs, preserving separate timer/counter/coil state. All shared output tags are compared after every scan; mismatches are capped in evidence output, and unshared tags are flagged. CSV export is available. Users must supply or review the reference: matching results do not establish correctness.

Verification: standalone engineering TypeScript compile passed; 8 Node assertions passed (identical programs, divergences, scan indices, CSV, invalid forced output, scan bound, no shared outputs, truncation). Full React/Vite, Vitest and browser tests not run. No cloud, backend or GitHub changes.
