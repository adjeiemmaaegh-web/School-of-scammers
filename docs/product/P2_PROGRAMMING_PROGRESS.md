# P2 — PLC programming depth: development status

**Branch:** `engineering/p2-plc-programming` (draft PR #16, stacked on design PR #15 and 3D foundation PR #14). **Scope:** frontend-only. **Status:** development increment, **not** full P2 exit/production acceptance. Owner's instruction to proceed from the UX prototype was interpreted as permission to begin P2 engineering, not as authorization to merge or deploy.

## Integrated working subset

The **existing single authoritative Web Worker** now runs either the salvaged `engineering/ladder.ts` interpreter or the bounded `engineering/structured-text.ts` interpreter, against the *same* wired 24V PLC input image and Q0.0/contactor/motor output path. Switching language resets scan memory; it does not introduce a second simulation engine.

The Ladder editor supports up to eight sequential rungs, user-declared local BOOL tags (up to sixteen), series contacts, one-contact two-way parallel branches, NO/NC contacts, coil, TON/TOF/RTO/TP timers, CTU counter and OSR/OSF edge instructions. The runtime already supports some operations not fully editable in this increment; the UI must not imply those are complete. Timer elapsed time and counter values are updated by fixed simulation milliseconds, not browser animations.

The Structured Text editor is an actual code editor with compilation feedback and a bounded ST parser/interpreter. A typed `Run : BOOL` output (or untyped case-insensitive `run`) controls the real, wired motor. The P1 Ladder program remains saved when ST mode is active; switching back requires deliberate user selection and resets runtime state. Saved `formatVersion:1` JSON is backward compatible with pre-P2 projects missing the optional `language` and `stSource` fields.

Live monitoring displays worker-published PLC tags, timer/counter memory, and a one-shot future-scan breakpoint. The breakpoint pauses after the target simulated scan. No manual I/O overrides, PLC forces, certified electrical safety logic, or real PLC hardware communications are implemented.

## Key traceability files

- `src/program/p2-contract.ts` — bounded program validation, ST compilation, example source.
- `src/sim/orchestrator.ts`, `src/sim/signals.ts` — one authoritative Ladder/ST execution path, monitored memory, breakpoint.
- `src/program/LadderEditor.tsx`, `StructuredTextEditor.tsx`, `ProgrammingDock.tsx`, `LiveMonitor.tsx`, `programming.css` — approved UX framework extensions.
- `tests/sandbox-p2-programming.test.ts` — TON/CTU/real motor, ST latch and invalid program, breakpoints, legacy files, case-insensitive output.
- `scripts/sandbox-p2-browser-acceptance.cjs` — actual browser place/wire/program/timer/ST/Run/breakpoint end-to-end, added to CI.

## Still open in the full P2 roadmap

- Typed non-BOOL Ladder tag table; general analog/digital I/O allocation beyond current 24V two-input/one-output demonstration.
- Full graphical instructions for comparators, MOVE, arithmetic, full counters, function blocks and all Ladder operations in the PRD; comprehensive IEC syntax coverage is **not** claimed.
- More advanced breakpoints (rung/edge/tag/threshold), safe manual forces with explicit indicators, multi-task PLC scheduling and instruction trace export.
- Broad verified ST debugging for complex typed programs, language syntax highlighting/autocomplete and unsupported construct guidance.
- Full cross-browser 3D interactive acceptance and low-spec physical Windows/Edge WebGL testing.
- Owner design/engineering approval, upstream PR dependency review, and explicit merge decision.

## Release controls

No backend, authentication, cloud, database server, payments, SaaS, or remote user accounts. The existing guided-exercise/employer-assessment routes remain intact. P2 must not be called fully completed without evidence closing its remaining scope. No production release or merge is authorized by engineering changes alone.
