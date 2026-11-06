# Input fault matrix increment — 2026-10-31

Added `src/engineering/fault-matrix.ts`, integrated the interactive input-fault matrix and CSV export in `InstructionLab.tsx`, and added six Vitest test definitions. Runs two bounded injection windows for each selected input across stuck-ON, stuck-OFF, and inversion faults. Reports changed scans and affected outputs using the existing scan-level comparator. Preserves the source sequence. Up to eight input tags and 24 cases; per-case simulation limited by the existing 10,000-scan bound.

Verification: engineering TypeScript compilation passed; seven native Node assertions passed. Full React/Vite compilation, Vitest execution, browser, and hardware testing not run (dependencies unavailable). A no-difference case does not demonstrate real-world fault tolerance. Output list is based on capped evidence; `evidenceTruncated` flags possible incompleteness.
