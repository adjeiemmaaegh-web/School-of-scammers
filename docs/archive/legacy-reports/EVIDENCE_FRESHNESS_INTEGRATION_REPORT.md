# PLC Skills Lab — Integrated evidence freshness (2026-10-31)

## Change
Corrected a cross-feature usability/reliability issue in the consolidated Instruction Lab: derived simulation reports could remain visible and exportable after a learner edited their input sequence, reference ladder, regression suite, or switched exercises. All dependent sequence reports are now invalidated together when the test vector changes; reference and suite edits invalidate their corresponding comparisons and analyses; lesson/program changes invalidate all relevant evidence. The underlying PLC simulation engines and saved project data are unchanged.

## Verification
- Engineering TypeScript (`tsc --noEmit ... src/engineering/*.ts`) passed.
- Existing integration smoke: 8 checks passed.
- `node scripts/check-evidence-freshness.cjs`: 22 static source checks passed. These are not browser interaction tests.
- Full React/Vite build, Vitest, and real browser checks remain unverified; frontend dependencies are absent.

## Limitations
This does not certify PLC behavior or hardware equivalence. No backend, cloud, GitHub, or deployment changes.
