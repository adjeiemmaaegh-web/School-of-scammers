# PLC Skills Lab — static ladder dependency audit

Integrated a read-only PLC program audit into the isolated instruction and scan-debugger laboratory.

- Detects inter-rung feedback cycles, previous-scan references to later writer rungs, self-references, negated feedback, mixed contact polarity, and invalid documents.
- Displays external input tags, coil writers, rung-level findings, and downloadable CSV evidence.
- Does not change ladder execution or energize simulated machinery. This is a teaching aid, not a certified safety or PLC vendor analysis.
- Added seven Vitest regression definitions; **not run under Vitest**.

Verification: pure TypeScript module compiled with `tsc`; seven direct Node runtime assertions passed. React/Vite build, actual Vitest execution and browser validation not performed. Previous factory-acceptance and scan-debugger behavior is preserved in source but not re-run in this increment.
