# Sequential PLC output-state coverage increment

Added `src/engineering/sequence-coverage.ts`, a deterministic bounded scan-level output-state coverage analyzer; integrated the report and CSV export into the existing Instruction Lab; added four Vitest test definitions.

## Verification
- Pure engineering TypeScript compilation passed.
- Standalone Node runtime smoke test: 10/10 assertions passed.
- Full Vitest runner, Vite/React build, and browser tests were not executed.

## Scope and limitations
Coverage is based on observed TRUE and FALSE output values, with transition counts. It does **not** measure all internal contact paths, MC/DC, machine safety, or vendor-specific PLC semantics. No backend or network dependencies added. GitHub unchanged.
