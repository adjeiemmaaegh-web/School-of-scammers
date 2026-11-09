# P2 Programming Depth — Source Handoff

**Review:** https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/31
**Branch:** engineering/p2-programming-depth-source
**Starting baseline:** main at 7a4c38bc8c33341f1957c2ffd72ead7e1fdd43f2, after PR #27
**Status:** SOURCE-CODE DEVELOPMENT ONLY. Draft PR, not merged, not deployed, not formally accepted.
**Division of responsibility:** source author delivers code, checks its design and provides source tests; independent code developer reviews, reconciles, runs acceptance, handles merges/deployment. No Windows/Mac/device-compatibility work is requested of source author.

## Source inventory

### Created functional source

| File | Responsibility |
|---|---|
| src/engineering/fbd.ts | Original FBD IR, graph compiler, stable topological order and actual scan execution (BOOL, TON/TOF/TP, CTU/CTD, SR/RS, numeric comparison, outputs) |
| src/program/fbd-editor-model.ts | Pure FBD node templates, arities, add/update/remove |
| src/program/FbdEditor.tsx | Editable SVG block diagram, connection inspector, live state, activation via worker |
| src/program/instruction-breakpoint.ts | Post-scan instruction edge and elapsed-time/count threshold breakpoints |
| src/program/tag-table.ts | Reference-safe Ladder local tag rename/metadata validation |
| src/program/PlcTagTable.tsx | Mapped PLC I/O and local variable live reference |
| src/program/local-force.ts | Strict local-only Ladder debug force validation |
| src/program/LocalForcePanel.tsx | Visible local force application and removal in selected PLC editor |

### Created source tests and E2E handoff

| File | Responsibility |
|---|---|
| tests/p2-fbd-engine.test.ts | FBD graph and memory invariants, deterministic replay, numerical comparison |
| tests/p2-fbd-plc.test.ts | Real tick/wired motor, per-PLC FBD persistence and malformed graph rejection |
| tests/p2-st-while.test.ts | Bounded WHILE, invalid input writes, syntax and loop budget |
| tests/p2-st-functions.test.ts | Typed ABS/MIN/MAX/LIMIT and rejected malformed calls |
| tests/p2-ladder-set-reset.test.ts | Retentive SET/RESET coils, duplicate writer validation and wired motor operation |
| tests/p2-instruction-breakpoints.test.ts | Break after real Ladder/FBD instruction scan |
| tests/p2-tag-table.test.ts | Ladder local rename across all references and annotation validation |
| tests/p2-local-force.test.ts | Force only local memory, never physical inputs/outputs, clear on reset |
| scripts/sandbox-p2-fbd-browser.cjs | Source-only browser acceptance recipe for co-developer to execute |

### Modified existing code

| File | Purpose |
|---|---|
| src/engineering/structured-text.ts | WHILE loop with hard execution limits; numeric ABS/MIN/MAX/LIMIT functions |
| src/engineering/ladder.ts | SET/RESET, one valid pair of writers per coil, optional typed local-force scan image |
| src/sim/signals.ts | FBD document/program and third language, worker commands, scan state, debug/breakpoint contracts |
| src/sim/plcs.ts | Per-controller FBD defaults, execution in genuine PLC scan, local force plumbing and snapshot state |
| src/sim/orchestrator.ts | Project validation, FBD compile/scan, worker edit commands, fail-closed scan faults, breakpoints, local-only forcing |
| src/program/ProgrammingDock.tsx | LD/ST/FBD selector, tag table and local force controls |
| src/program/LadderEditor.tsx | SET/RESET instruction selection |
| src/program/LiveMonitor.tsx | Rung/block edge and timer/counter threshold breakpoint panel |
| src/program/scan-trace.ts | FBD block activity in authoritative scan trace and CSV |
| src/app/SandboxPage.tsx | Selected PLC FBD editor, debug force and instruction breakpoint worker actions |
| src/program/programming.css | FBD and tag/debug control styling |
| tests/structured-text.test.ts | Updated old WHILE-must-fail assumption now that bounded WHILE is supported |

## Behavior contract

1. Place and wire virtual PLC, buttons and motor in the open sandbox. Select any controller and choose Ladder (LD), Structured Text (ST), or Function Block Diagram (FBD). Each controller retains its own alternate source and active language.
2. FBD pins reference stable node IDs. Graphs are checked for duplicate outputs, missing sources, direct cycles, invalid types, arity, presets and bounded size. A DAG is evaluated once per actual PLC scan, with per-block simulated-time and counter state. An INPUT block that reads a previous PLC output starts FALSE at scan zero, but missing physical inputs remain an error.
3. The authoritative tick orchestrator still solves wiring and electrical inputs, executes the active PLC program, drives outputs, advances plant state, appends traces, and publishes a render snapshot. New FBD editor never owns independent physical/PLC truth.
4. ST WHILE DO END_WHILE, ABS, MIN, MAX and LIMIT use a finite parser and execution budget. An infinite loop or invalid arithmetic is rejected/fails closed; no dynamic JavaScript execution.
5. Ladder explicitly supports SET and RESET operations. One paired writer per coil is allowed in documented rung order. Other duplicate coil writers are rejected.
6. Tag table shows actual mapped I/O and live values; Ladder local variable rename rewrites dependent contacts, coils and numeric operands. Addresses of local variables are annotations, never rewired physical terminals.
7. Instruction breakpoints pause AFTER an authoritative scan, on a specific Ladder rung or FBD block edge, elapsed timer threshold or count threshold. They do not force any signal.
8. Educational debug forces only target typed, declared Ladder LOCAL memory tags, with safety/guard-like variables expressly excluded. Physical PLC inputs, outputs and 24V connections cannot be forced by this interface. Active force indicators are visible, edits require paused mode, and force state is ephemeral and cleared on reset/project load. Safety certification is not implied.

## Mandatory co-developer integration

This P2 branch intentionally starts from main after PR #27. Pending work is in:
- PR #28: browser reliability and plant-library contracts.
- PR #29: real numeric engineering-unit signal wiring to PLC16 analog inputs.
- PR #30: P1 workspace group editing, orientation, authoring clipboard, history and worker acknowledgement.

The integration developer must reconcile file conflicts in sim/signals.ts, sim/plcs.ts, sim/orchestrator.ts, SandboxPage.tsx and ProgrammingDock.tsx to KEEP all valid features. Do NOT resolve merge conflicts with whole-file ours/theirs. P2 FBD numeric comparator can already consume an authoritative numeric input value, but full physical analog PLC input mapping remains dependent on integrating PR #29. P3 weighing-cell physics is separate; do not claim weight handling exists here.

Specific integration checklist:
- Confirm legacy single PLC, configurable PLC16, and second/multiple PLC separate programs, save/load and runtime state after merge reconciliation.
- Verify that project validation accepts old LD/ST JSON without FBD fields and rejects malformed FBD graphs.
- Run npm ci, npm run typecheck, npm test, npm run build, npm run verify:full and existing browser suites after conflicts are resolved.
- Review and execute scripts/sandbox-p2-fbd-browser.cjs against a local preview. It is deliberately NOT inserted into CI by the source author; the code developer may do so after checking the selectors and assertions.
- Check real scan memory, first-scan FBD feedback, no live worker snapshot overwrites of uncommitted FBD edits, numeric overflow, the 400-iteration ST WHILE limit, and exact force flags and reset behavior.
- Keep assessment mode integrity in mind: local debug forces must be disabled or restricted where they would invalidate a graded exercise. Do not automatically expose instructor answer keys.
- Review P1, P2 and analog integration before any merge; retain all unrelated app routes and the existing no-backend architecture.

## Explicit limits and later work

- This is an original educational subset; NOT a complete IEC 61131-3 implementation, vendor IDE, safety-rated controller, or demonstration of physical hardware equivalence.
- User-defined hierarchical function blocks and broad vendor instruction libraries, PLCopen graphical interchange, remote PLC runtime/Modbus, true analog electrical ADC and fully general multi-controller debugger history are later development streams.
- Built-in FBD numeric comparator engine is present; end-to-end PLC16 analog mapping and weigh-cell physics require PR #29 + Phase A co-developer equipment integration.
- Current instruction breakpoints and central scan trace follow the first PLC; a richer per-PLC debugger is future work. Local forces are not a bypass of external guards or physical safety architecture.

## Source QA notes

Early automatic checks detected FBD feedback initialized without previous PLC output, outdated WHILE rejection tests, and transient missing debugForces fields while new types were being introduced. Those source defects were corrected. An intermediate 896/896 unit-test run passed, although that run failed at the existing reversing-motor browser acceptance timeout. Full CI and merged-source acceptance must use the final PR head and remain the code developer's responsibility. Do not claim a green release from an intermediate check.

This document describes the delivered source increment and tasks for the code developer. It is not an approval to merge, ship, activate payments, or deploy.
