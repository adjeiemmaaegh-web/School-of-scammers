# Scan-by-scan invariant monitoring — 2026-10-31

Added `src/engineering/safety-invariants.ts` and Instruction Lab panel. Checks mutual exclusion, input-required output interlocks, and maximum consecutive ON scans across *every* simulated PLC scan. Includes bounded evidence, CSV export, strict rule validation, and five Vitest definitions.

Verification: isolated engineering TypeScript compilation; standalone runtime assertions (see delivery). Full application build, Vitest runner, browser and hardware validation remain unverified. These checks are educational simulation, not safety-certified proof. The monitor evaluates only explicitly configured rules and supplied input scenarios.
