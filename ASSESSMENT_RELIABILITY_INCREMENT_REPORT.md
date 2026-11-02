# PLC Skills Lab — Assessment Reliability Increment

## Changes
- Mandatory distinct pre-repair and post-repair scan observations for passing assessments.
- Repairs cannot proceed without first capturing a fresh diagnostic observation.
- Root-cause selector no longer initializes to the correct injected answer.
- UI shows evidence counts and disables premature repair.
- Imported portfolios now validate rubric identifiers, scores, numeric fields, bounded strings, payload size, and duplicate scenarios.
- Added regression definitions covering all 10 fault scenarios, evidence requirements, and import tampering.

## Verification performed
- Strict isolated TypeScript compilation of engineering assessment module and its dependencies: PASS.
- Node execution of 10 full fault paths, validated exported reports, and missing-post-repair rejection: PASS.
- Full Vitest suite, React/Vite build, and browser interaction: NOT RUN; application dependencies not available.

## Known limitations
- This is educational simulation, not industrial safety certification.
- Local portfolio records remain editable; stronger schema checks do not make them tamper-proof.
- Backend/auth/database remain out of scope.
