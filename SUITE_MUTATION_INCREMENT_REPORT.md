# PLC Skills Lab — Regression Suite Mutation Quality (2026-10-31)

Added a bounded mutation-testing campaign across up to 20 independently asserted regression cases, with per-case detection attribution and unique detections, CSV evidence, and an Instruction Lab UI panel. Baseline expectations must pass before scoring; every generated mutant receives a fresh PLC state per case. The campaign limits simulated scan-work to 150,000 by default, and explicitly marks truncated results. A mutation score is not proof of machine correctness or safety.

## Local verification
- Engineering TypeScript isolated compile: passed.
- Six focused Node runtime assertions: passed.
- Four Vitest test definitions added; Vitest not executed.
- Full Vite/React build, browser and physical PLC tests: not executed.
