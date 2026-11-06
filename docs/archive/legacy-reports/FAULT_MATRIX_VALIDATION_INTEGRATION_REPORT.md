# PLC Skills Lab — Fault matrix campaign validation and completeness (2026-10-31)

## Changes
- Validate requested fault tags against external ladder inputs, rejecting misspellings and output coils.
- Validate baseline sequence and its assertions before fault injection, preventing misleading campaigns against an already failing reference.
- Return `plannedCases`, `truncated`, and `baselinePassed` from the fault matrix; report evaluated/planned cases in the UI and export completeness metadata in CSV.
- Add six Vitest regression definitions for completeness, invalid tags, invalid steps, and baseline failures.

## Checks executed
- Engineering TypeScript (`tsc --noEmit ... src/engineering/*.ts`): passed.
- Seven native Node runtime assertions against freshly compiled modules: passed.
- Existing source-level evidence freshness checks: 22 passed.
- Existing generated-vector lifecycle checks: 5 passed.
- ZIP integrity: verified.

## Limitations
The full React/Vite build and Vitest runner remain unexecuted due to unavailable frontend dependencies; browser, hardware, and performance testing remain unverified. This is an offline-first educational simulator, not a certified PLC or proof of industrial safety. No backend, deployment, or GitHub changes.
