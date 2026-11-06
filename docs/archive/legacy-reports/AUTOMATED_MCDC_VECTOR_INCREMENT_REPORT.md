# Automated MC/DC Vector Generation — 2026-10-30

Added bounded exhaustive unique-cause witness search for stateless external-input-only ladder rungs, greedily reusing witness vectors, generating editable sequential test JSON, and exporting witness mapping CSV. The Instruction Lab loads generated vectors into the existing sequence editor; it does not automatically execute or replace the workcell program.

Important: expected outputs are computed by the program under test, not an independent oracle. Learners must compare against specifications before using them as verification. Stateful instructions, feedback and repeated conditions are excluded; 10-input bound. A condition without a witness is reported, not silently credited.

Checks: isolated engineering TypeScript compilation passed; 7 focused Node assertions passed. Four Vitest definitions added but not executed. Full Vite/React build, browser and hardware acceptance not run.
