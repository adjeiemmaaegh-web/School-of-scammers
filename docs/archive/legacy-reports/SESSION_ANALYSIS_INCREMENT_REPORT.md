# PLC Skills Lab — Offline session transition analysis

Added deterministic replay-derived session analysis with full-run counts of motor-on, isolated-power, open-guard, active-fault scans, and output transitions. Retains bounded transition evidence (default 300, maximum 2000) and exports CSV. Integrated into the Engineering Workbench; stale analysis clears on new actions, reset, and session import. This is simulation evidence only, not machine certification.

Verification: isolated engineering TypeScript compilation passed; 7 native assertions passed; offline integration gate passed (161 imports, 28 navigation targets, four negative/baseline checks). Added five Vitest definitions but did not execute Vitest. Full Vite/React build, browser and physical hardware validation unverified. No backend, deployment or GitHub changes.
