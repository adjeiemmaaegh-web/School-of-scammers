# Condition independence increment — 2026-10-30

Added an observational unique-cause MC/DC evidence analyzer for stateless coil rungs with distinct external Boolean contacts. Uses actual scan execution and records pairs of scans differing in exactly one condition and the rung result. Does not infer missing vectors. Excludes timers, counters, edge pulses, internal feedback, and repeated condition tags. Maximum 100 steps, 10,000 scans, 12 conditions per eligible rung. Integrated into Instruction Lab with evidence CSV. Added six Vitest test definitions.

Verification: strict isolated TypeScript engineering compilation passed; 10/10 native Node assertions passed; full Vitest, React/Vite build, browser and hardware tests NOT executed. No safety certification or equivalence to vendor PLCs. No backend or GitHub changes.
