# Fault Matrix Recovery Evidence Increment — 2026-10-31

Extends each automated fault matrix scenario with post-fault divergent scan count, whether outputs recovered by the final scan, longest contiguous per-output divergence, and whether divergence extends past the injection window. Adds these metrics to the Instruction Lab results table and CSV export. Existing baseline comparison and scan-level trace engine are reused without changing ladder semantics.

Validation: isolated engineering TypeScript compilation passed; six focused Node runtime assertions passed; three Vitest test definitions added but Vitest was not executed. Full React/Vite build, browser tests and real hardware acceptance remain unverified. Recovery at the end of a finite test is not a guarantee of fault tolerance or industrial safety.
