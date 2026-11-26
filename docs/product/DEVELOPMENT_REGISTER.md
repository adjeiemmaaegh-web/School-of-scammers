# Development register — R0–R13 traceability and continuation checkpoint

This is the one live development register for the master roadmap (`MASTER_ROADMAP.md`, R0–R13). It is checked against the
**code**, not against earlier summaries. Each requirement has one development status and, separately, its acceptance status.

**Development status:** `DONE` (implemented, integrated and covered by automated tests) · `DONE-UNVERIFIED` (implemented and
integrated, automated coverage partial) · `PARTIAL` · `MISSING` · `BLOCKED` (a genuine external dependency) · `DEFERRED`
(owner decision) · `OWNER` (only the owner, real hardware or an outside reviewer can do it; not development work).

**Acceptance status** is never claimed here: manual acceptance, physical-hardware acceptance and commercial release approval are
all **pending** for every row unless a row says otherwise.

## Checkpoint (update on every push)

| Item | Value |
|---|---|
| Integrated baseline | `origin/main` `9f6fbea` (PR #95 University Recovery and PR #93 Stage 1 merged) |
| Integration branch | `engineering/integration-20261126` |
| Integrated so far | PR #94 Stage 2 simulation architecture (fast-forward, plus the one test typecheck fix that failed all its CI), PR #89 Steady Guide (clean merge) |
| Last verified locally | see the newest commit on the branch; `tsc`, Vitest, build, `verify:full`, budgets and the browser scripts named in its message |
| Next exact engineering task | the first `PARTIAL`/`MISSING` row in "Work queue" below |

## Work queue (in execution order)

| # | Requirement | Gap found in code | Status |
|---|---|---|---|
| 1 | R4.1 Ladder editing | rung duplicate, copy/paste (also across PLCs), move up/down, undo/redo (buttons, Ctrl+Z / Ctrl+Y, 50 steps); a copy whose coil is already driven writes a new local `AuxN` tag so the program stays valid | DONE: `src/program/ladder-edit.ts`, `tests/ladder-edit.test.ts` (7), `scripts/sandbox-r4-ladder-edit-browser.cjs` (3/3, in CI) |
| 2 | R5.5 / R8.1 process trends | up to four signals (PLC I/O, analog channels, numeric tags, plant signals) recorded from snapshots over model time, 600 scans, CSV | DONE: `src/diagnostics/trend.ts`, `TrendPanel.tsx`, `tests/trend.test.ts` (4, incl. no hidden-fault leak), `scripts/sandbox-r5-trend-browser.cjs` (3/3, in CI) |
| 3 | R6.2 orthographic view | camera presets exist (top/side/front/iso, Orbit/Fly/First Person) but every view is perspective | MISSING |
| 4 | R5.5 logic probe | the multimeter reads solver voltages; no digital logic-probe reading of a terminal as HIGH/LOW/floating | MISSING |
| 5 | R10.5 contributor templates | `CONTRIBUTING.md`, `CHANGELOG.md` and an issue template exist; no pull-request template | PARTIAL |
| 6 | R3.4 first-controller storage | the first classic PLC still keeps its runtime in legacy `WorldState` fields (coils, ladderMemory, stCompiled, tagValues…) mirrored for compatibility; every other PLC uses `plcs[id]` | PARTIAL (documented migration risk; see row R3.4) |
| 7 | R21/R22 free heading | tanks, robots, palletizers, cranes, pushers, platforms and stairs turn in 90° steps only | PARTIAL |
| 8 | R10.2 in-app authoring | scene packages export/import with validation (`platform/scene-package.ts`); no in-app editor for scenario objectives | PARTIAL |

## Requirement matrix

| Req | Requirement (short) | Development status | Evidence in code / tests | Owner-only remainder |
|---|---|---|---|---|
| R0.1–R0.3 | Baseline, inventory, full check run | DONE | `STATUS.md` §0–2; CI workflows `ci.yml`, `windows-edge.yml`, `repository-qa.yml` | — |
| R0.4 | Screenshot matrix | DONE-UNVERIFIED | `scripts/steady-guide-capture-browser.cjs` (23 real states, CI artifact), UX scripts at five sizes | owner screenshot sign-off |
| R0.5–R0.7 | PR comparison, docs reconciliation, findings register | DONE | `STATUS.md` §3 findings F-01…F-27 | — |
| R1.1–R1.6 | Contextual workbench, tool states, inspector, dock, preferences | DONE | `SandboxPage.tsx`, `WorkbenchInspector.tsx`, `ProgrammingDock.tsx`; `sandbox-r1-workbench-browser.cjs`, `sandbox-ux2-*`, Stage 1 scripts | owner UX review |
| R1.7 | Layout validation at five sizes, WebGL/no-WebGL | DONE | UX2 stage-1/2 scripts, `cpu-fallback-acceptance.cjs` | physical tablet |
| R2.1–R2.5 | Project library (IndexedDB), migration, versions, cross-tab, failure visibility | DONE | `platform/project-library*.ts`, `sandbox-project-storage.ts`; `tests/project-library.test.ts`; `sandbox-r2-project-library-browser.cjs` | — |
| R2.6–R2.7 | Offline update protocol and failure tests | DONE | `src/main.tsx` SW waiting handoff; `offline-update-browser.cjs`, `offline-acceptance.cjs` | real browser restart/quota on owner devices |
| R3.1 | Golden `tick()` vectors | DONE | `tests/r3-golden-tick.test.ts`, Stage 2 replay tests | — |
| R3.2–R3.3 | Device lifecycle contract, pure phases | DONE | `STAGE2_DEVICE_LIFECYCLE_CONTRACT.md`, `src/sim/phases/*` | — |
| R3.4 | Generalise first-controller mirrors | PARTIAL | one executor and one input/power/observation image for every PLC (`plc-input-image.ts`, `plc-power.ts`, `plc-observation.ts`); first classic PLC storage mirror retained | — |
| R3.5 | Typed channels with units, range, power reference | DONE-UNVERIFIED | `src/sim/device-channels.ts` read-only adapter, shown in the inspector; ranges only where the model defines them | — |
| R3.6 | Bounded worker queues, events, traces | DONE | Stage 2 mailbox bounds, `tests/stage2-*`; F-08 cost profiled | — |
| R3.7 | Deterministic replay and mutation tests | DONE | Stage 2 replay tests, `factory-scale` determinism, mutation checks recorded per feature | — |
| R4.1 | Editor improvements (copy/paste/undo/keyboard) | DONE (Ladder); ST editor is a text area with the browser's own undo; FBD editor has its own model | `ladder-edit.ts`, browser script | — |
| R4.2 | Supported IEC-inspired subset | DONE | `PLC_SUBSET.md`; TON/TOF/TP/CTU/CTD/R_TRIG/F_TRIG/PID in `engineering/structured-text.ts`; SFC and IL compile to ST | no IEC certification claimed |
| R4.3 | Tags, mapping, DI/DO/AI/AO, expansion modules | DONE | `sim/plc-io.ts`, `PlcTagTable.tsx`, `tests/io-modules*.test.ts`, `sandbox-r07-inspector-browser.cjs` | — |
| R4.4 | Online monitoring, forces, breakpoints, step, trace CSV | DONE | `LiveMonitor.tsx` (watch filter, CSV), `LocalForcePanel.tsx`, `instruction-breakpoint.ts` | — |
| R4.5 | ST/FBD safety and messages | DONE | parser tests, `tests/st-*.test.ts`, FBD tests | — |
| R4.6 | Import/export, PLCopen subset | DONE | `engineering/plcopen-st-xml.ts`, `plcopen-ld-xml.ts` round-trip tests | no vendor project files |
| R4.7 | Multi-PLC tabs and examples | DONE | per-PLC programs, `sandbox-multi-plc-browser`, demo D | — |
| R5.1–R5.4 | Schematic wiring, colours, net labels, devices, templates, analog domains | DONE | `wire-style.ts`, `electrical/*`, `analog.ts`, starter panels | — |
| R5.5 | Instruments | PARTIAL (trend #2, logic probe #4) | multimeter, continuity, phase instruments read the solver | — |
| R5.6–R5.7 | Fault semantics, three-phase labelling | DONE | `sim/faults.ts`, P5 tests, `three-phase` limits text | — |
| R6.1 | Device audit | DONE | generated `DEVICE_CATALOG.md` (92 kinds) with staleness test | — |
| R6.2 | 3D authoring and views | PARTIAL (orthographic #3) | Orbit/Fly/First Person, presets, align, snap, groups, free heading | — |
| R6.3–R6.7 | Assemblies with ports, sensor geometry, library, truth tables, user-authored lines | DONE | `workspace/groups.ts`, `AssemblyLibrary.tsx`, `UNIVERSITY_RECOVERY_REGISTER.md` R01–R28 | — |
| R7.1–R7.6 | Material, actuators, process, events, benchmarks, model limits | DONE | University Recovery R01–R28 rows; `factory-scale`, `r7-soak-benchmark` tests; `model-limits.ts` | — |
| R8.1–R8.6 | Diagnostics, hidden faults, commissioning, evidence, privacy | DONE except trends (#2) | `TroubleshootingPanel`, `FatChecklist`, `commissioning-report`, `redact.ts` (F-12 fixed) | — |
| R9.1–R9.6 | Learning concepts, progression, gallery, scenarios, feedback, employer flows | DONE | `exercises/*`, `LessonPanel`, `sandbox-r9-lessons-browser.cjs`, `qa-candidate-employer-browser.cjs` | — |
| R9.7 | Field test with instructors and students | OWNER | — | yes |
| R10.1, R10.3, R10.4 | Package schema, generated device docs, doc consolidation | DONE | `scene-package.ts`, `DEVICE_CATALOG.md`, this register | — |
| R10.2 | In-app authoring mode | PARTIAL (#8) | scene/assembly export-import | — |
| R10.5 | Contributor templates | PARTIAL (#5) | | — |
| R11.1–R11.4, R11.6, R11.8 | Hardening, routes, CI matrix, flakiness, SBOM, soak | DONE (automated) | CI: Linux, Windows Edge, Firefox/WebKit container, coverage, SBOM; no-retry local matrix | — |
| R11.5 | Real 8 GB Windows performance | OWNER | bundle budgets only | yes |
| R11.7 | Independent controls-engineer review | OWNER | — | yes |
| R12.1–R12.5 | Release candidate, journeys, acceptance, deployment, archive | OWNER (development inputs exist: `BETA_PACKAGE.md`, `JOURNEYS.md`, `RELEASE_CHECKLIST.md`) | — | yes; no deployment without owner approval |
| R13.1–R13.4, R13.6 | Steady Guide navigation, reference, build plans, in-workbench help, offline | DONE | `src/steady-guide/*`, `steady-guide-*.cjs` browser scripts (pass on the integration head) | novice journey review |
| R13.5 | Authentic screenshots | DONE-UNVERIFIED | capture script produces real CI screenshots; publication needs owner sign-off | yes |
| University R01–R28 | 28 engineering findings | DONE with stated limits | `UNIVERSITY_RECOVERY_REGISTER.md` | — |

## Known limits that stay (not defects)

- Educational simulation only: no safety rating, no IEC certification, no vendor project compatibility, no real PLC
  communication, teaching physics (not a rigid-body engine; bounding-box collision for turned or round parts).
- Frontend-only by owner decision: no accounts, cloud sync or server grading; assessment codes are unsigned.
