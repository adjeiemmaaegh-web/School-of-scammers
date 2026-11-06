# P2 — PLC programming depth: development status

**Branch:** `engineering/p2-plc-programming` (draft PR #16, stacked on design PR #15 and 3D foundation PR #14). **Scope:** frontend-only. **Status:** development increment, **not** full P2 exit/production acceptance. Owner's instruction to proceed from the UX prototype was interpreted as permission to begin P2 engineering, not as authorization to merge or deploy.

## Integrated working subset

The **existing single authoritative Web Worker** now runs either the salvaged `engineering/ladder.ts` interpreter or the bounded `engineering/structured-text.ts` interpreter, against the *same* wired 24V PLC input image and Q0.0/contactor/motor output path. Switching language resets scan memory; it does not introduce a second simulation engine.

The Ladder editor supports up to eight sequential rungs, up to sixteen local BOOL/INT/DINT/REAL tags, series contacts, one-contact two-way parallel branches, NO/NC contacts, coil, TON/TOF/RTO/TP timers, CTU/CTD counters, OSR/OSF edge instructions, numeric compare instructions and MOV/ADD/SUB/MUL/DIV. The runtime already supports some operations not fully editable in this increment; the UI must not imply those are complete. Timer elapsed time and counter values are updated by fixed simulation milliseconds, not browser animations. Numeric registers persist between scans inside the same worker; arithmetic updates them in rung order and comparisons gate real Boolean outputs. Numeric results are type/range checked; division by zero or overflow pauses and deenergizes the simulated output, not actual machinery. Numeric support is intentionally limited to local tags (no analog field-device binding).

The Structured Text editor is an actual code editor with compilation feedback and a bounded ST parser/interpreter. A typed `Run : BOOL` output (or untyped case-insensitive `run`) controls the real, wired motor. The P1 Ladder program remains saved when ST mode is active; switching back requires deliberate user selection and resets runtime state. Saved `formatVersion:1` JSON is backward compatible with pre-P2 projects missing the optional `language` and `stSource` fields.

Live monitoring displays worker-published PLC tags, timer/counter memory, an exact future-scan breakpoint, and rising/falling/either-edge breakpoints on known Boolean PLC signals. Breakpoints pause after the relevant simulated scan. A bounded 300-scan worker-generated trace records sampled inputs, Run output, contactor/motor state and per-network instruction results; CSV export is local-only, escapes spreadsheet formulas, and does not claim full replay. No manual I/O overrides, PLC forces, certified electrical safety logic, or real PLC hardware communications are implemented.

## Key traceability files

- `src/program/p2-contract.ts` — bounded program validation, ST compilation, example source.
- `src/sim/orchestrator.ts`, `src/sim/signals.ts` — one authoritative Ladder/ST execution path, monitored memory, breakpoint.
- `src/program/LadderEditor.tsx`, `StructuredTextEditor.tsx`, `ProgrammingDock.tsx`, `LiveMonitor.tsx`, `programming.css` — approved UX framework extensions.
- `tests/sandbox-p2-programming.test.ts` — TON/CTU/real motor, ST latch and invalid program, breakpoints, legacy files, case-insensitive output.
- `scripts/sandbox-p2-browser-acceptance.cjs` — actual browser place/wire/program/timer/ST/Run/scan-and-edge-breakpoints/CTD configuration end-to-end, added to CI.
- `src/program/scan-trace.ts` — pure bounded scan trace, edge validation, and safe CSV serialization.
- `tests/sandbox-p2-debugger.test.ts` — wired CTD count-down, rising/falling edge debug, 300-record bound, snapshot isolation, CSV injection defenses and malformed tag rejection.
- `src/program/NumericInstructionControls.tsx`, `tests/sandbox-p2-numeric.test.ts`, `scripts/sandbox-p2-numeric-browser.cjs` — typed numeric instruction editor, numerical motor-control integration, invalid input/overflow tests, real end-to-end UI test.

## Still open in the full P2 roadmap

- Physical analog input/output allocation and rich typed address/memory mapping beyond current 24V two-input/one-output demonstration. Local BOOL/INT/DINT/REAL tags are implemented, but no physical analog registers exist.
- Extended typed/composite instructions, richer expression graphs, function blocks and remaining Ladder operations from the PRD. Basic comparators and MOV/ADD/SUB/MUL/DIV are now integrated with explicit bounded registers; comprehensive IEC instruction/syntax coverage is **not** claimed.
- More advanced rung/timer/counter threshold breakpoints, safe manual input forces with explicit indicators, multi-task PLC scheduling and full replayable instruction-level trace export. Boolean tag-edge and bounded scan CSV are **implemented but not full replay**.
- Broad verified ST debugging for complex typed programs, language syntax highlighting/autocomplete and unsupported construct guidance.
- Full cross-browser 3D interactive acceptance and low-spec physical Windows/Edge WebGL testing.
- Owner design/engineering approval, upstream PR dependency review, and explicit merge decision.

## Release controls

No backend, authentication, cloud, database server, payments, SaaS, or remote user accounts. The existing guided-exercise/employer-assessment routes remain intact. P2 must not be called fully completed without evidence closing its remaining scope. No production release or merge is authorized by engineering changes alone.
