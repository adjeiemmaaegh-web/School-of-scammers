# PLC Skills Lab — Scan-level fault trace increment (2026-10-31)

Added `src/engineering/input-fault-scan-trace.ts` to compare the original and fault-injected input sequences at **every simulated PLC scan**, rather than only the end of each authored test step. The simulator keeps independent coil/timer/counter memory for the baseline and injected runs, reports first differing scan, counts affected scans, retains capped per-output evidence, and exports CSV. The Instruction Lab now offers “Compare every PLC scan” and CSV export beside the existing fault campaign. Added five Vitest test definitions.

Verification: isolated engineering TypeScript compilation passed; seven Node native assertions passed. Full app typecheck/build, actual Vitest, browser and hardware acceptance were not run. The output comparison is simulated and not safety certification. No backend, cloud, or GitHub changes.
