# PLC Skills Lab — engineering integration review

**Date:** 2026-11-10 · **Integration PR:** [#41](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/41) · **Branch:** `engineering/integration-industrial-workcell-2026-11-10`

**Decision:** IN PROGRESS / NO MERGE / NO RELEASE. This file is the single reconciliation and acceptance handoff, not a claim of a finished broad industrial simulator. It supplements the existing canonical PRD and architecture. The only acceptable source of operational truth is the validated Web Worker; the 3D renderer and controls are views/actions.

## Baseline and provenance

- Baseline: PR #29 `engineering/analog-tank-plc-bridge`, head `5bfff401fb5c7b2696c2163d8d138e84657593a4`, stacked on PR #28 `engineering/plant-contract-and-browser-ack` at `7f8fb4ced6790f4e2103e599418a9cfcf463264b`.
- Reconciled PR #34's original workspace into this branch, without overwriting PR #29's `SandboxPage.tsx` numeric I/O readout (`activePlcView.io.analogInputs`) or `ProgrammingDock` numeric-input prop.
- P5 additions: menu/tool chrome, supported-equipment family filters, spatial Logical/Wiring board with real terminal actions, Physical/3D view, inspector and dock toggles, keyboard accessibility and existing worker simulation status, browser and unit tests.
- The `scripts/sandbox-analog-browser.cjs` integration scenario now clicks **actual P5 diagram terminals** `tank.LEVEL` → `ctrl.AI0` (not a direct worker/test injection). The saved project's genuine ST program reads `Analog0 : REAL` and drives `Out0` / physically wired pump; the worker's actual tank-level feedback eventually stops the pump. The script checks numeric units, PLC reading, source, UI wire path and save/reload. Its CI outcome must be checked on the exact integration head.
- PR #34's verified P5 source build is independent evidence, not automatic evidence that its code works combined with PR #29; PR #41 requires its own CI.
- No merge of original PRs or `main` has been executed. No backend, cloud, authentication, physical PLC connection or production deployment authorized.

## Evidence-based source and integration matrix

| Workstream | Main (original bounded model) | Original source PR | In this integration branch | Confidence and remaining test |
|---|---|---|---|---|
| #28 worker-acknowledged browser controls / Phase A contract | Original tests and plant brief | Source written, open/unmerged | **Inherited transitively through #29** | Confirm broad CI, retaining changed P4/P7 scripts |
| #29 typed numeric 0–1000 ml tank → PLC16 AI0/AI1, ST and 24V pump | Not in main at audit | Source written/tested on stacked branch | **Integrated** (base) | Browser numeric physical wiring and worker state on #41 |
| #30 P1 multi-select/group/duplicate/snap/history | Existing basic single selection, move, undo | Source written, open/draft | **Not integrated** | Overlaps `SandboxPage`, `Sandbox3D`, `signals`, `orchestrator`, worker; reconcile intent/history with actual snapshots |
| #31 P2 FBD, richer Ladder/ST/tag table and debugging | Working bounded LD/ST | Source written, open/draft | **Not integrated** | Reconcile PLC language union, runtime state, IR/trace and per-PLC program storage |
| #32 P3 25 equipment types, five 10ms world substeps, 10 scenes | Simplified conveyors/tanks and one-off workcells | Source written, open/draft | **Not integrated** | Reconcile numeric bridge & 24V command image in `orchestrator`, `signals`, `plcs`, `plc-io`, `registry`; preserve per-device body IDs and geometry |
| #33 P4 three-phase star/delta, faults and instruments | Simplified protected **24V** starter / reversing | Source written, open/draft | **Not integrated** | Reconcile distinct 400V/24V types and constraints with #29 and #32; do not overwrite 24V fault model |
| #34 P5 organized simulator workbench | Earlier Build/Wire/Program/Test UI | Source written, independently CI-verified, open/draft | **Reconciled into #29 base** | Run exact combined branch browser, accessibility, performance and no-WebGL |
| End-to-end 3 conveyor + turntable authored workcell | Not available at main's equipment breadth | Parts present within independent #32 source | **Missing on combined branch** | Must wait for #32 runtime integration and proper PLC-to-plant wiring; do not substitute scripted motion |

**Distinguish statuses:** “Source written on an unmerged PR” does not mean merged or independently accepted on the combined branch. Main's bounded LD/ST, 24V wiring, small sorting/tank plant, scenarios and troubleshooting are actual existing implemented capabilities, not full IEC or factory-scale mechanics.

## Important shared-file conflict register

| Shared file | Concurrent PRs | Integration policy |
|---|---|---|
| `src/app/SandboxPage.tsx` | #29, #30, #31, #32, #33, #34 | Rebuild compositional UI; preserve PR #29 numeric display and PR #34 logical action bindings; integrate each added tool behind real worker commands |
| `src/sim/signals.ts` | #29, #30, #31, #32, #33 | One discriminated `Command`, one `ProjectFile` validation/schema, one `WorldState` and snapshot; no duplicate analog/phase/plant state contracts |
| `src/sim/orchestrator.ts` | #29, #30, #31, #32, #33 | One ten-phase deterministic 50 ms tick; plant substeps within plant phase; separate numeric and 24V and three-phase domains; no duplicate command handlers |
| `src/sim/plcs.ts`, `plc-io.ts` | #29, #31, #32 | Preserve fixed classic tags, configurable terminal-to-tag model and missing-analog fail-closed behavior; add FBD safely |
| `src/components/registry.ts` | #29, #32, #33 | Union only validated terminal descriptions, preserving numeric and phase roles, no extra palette entries without runtime |
| `src/render/Sandbox3D.tsx` | #30, #32, #33 | One scene/interaction layer reading worker state, preserve P5 occlusion fix and no-WebGL access |
| `src/sim/faults.ts` | #29, #32, #33 | Preserve wire faults, plant faults, and phase/thermal fault semantics without false readings |
| `src/components/electrical-defs.ts` | #32, #33 | Keep DC plant equipment models and three-phase descriptions in distinct terminal domains |
| `src/program/ProgrammingDock.tsx` | #29, #31, #32 | Preserve `analogInputs` input metadata while adding FBD and debug capabilities |
| `.github/workflows/ci.yml` | #29, #34 | Both numeric and organized-workspace E2E remain required; do not remove tests to obtain a green run |

## Full vertical-slice acceptance

**Implemented candidate on PR #41:** open a local project (or build one manually), use Logical/Wiring to connect a **real** numeric `tank.LEVEL` channel to `plc16.AI0`, wire supply/PLC/pump 24V, author or edit ST with `Analog0 : REAL` and `Out0 := Analog0 < 250.0;`, run scans, observe tank level increasing and the pump stopping when threshold is reached, pause, and reload with numeric mapping preserved. The project and PLC scan remain owned by the same worker.

**Explicit limitation:** This is an honest coherent **tank** slice, not yet the requested three-conveyor/turntable integration proof; no verified simulated conveyor-to-turntable transfer, no official Siemens driver, and no complete P1/P2/P3/P4 branch consolidation. Its earlier numeric tests do not prove this combined UI without the modified browser test passing.

## Remaining engineering work, ordered

1. Resolve #29 ↔ #32 numeric I/O/physical world contract; wire PLC16 inputs to real P3 signals and PLC outputs to per-instance commands. Add replay tests and prove one conveyor/sensor/actuator circuit end to end.
2. Integrate #30 authoring with #34's logical/physical canvas; add yaw-safe geometry, select/move/duplicate/group from real project data, saved roundtrip and collision feedback.
3. Deliver the complete **three roller conveyors + turntable + two sensors + PLC** user-authored acceptance with true body transfers; stop when unsupported and document exact failure.
4. Merge #31's FBD and debugger into unified per-PLC state while keeping existing LD/ST, analog and tag mapping sound; validate invalid/disconnected mappings.
5. Integrate #33's separate three-phase domain; verify crossed/missing phases, real wired star/delta dead-time and thermal diagnostics without treating the 24V model as 400V.
6. Test one combined branch with `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run verify:full`, focused worker/browser E2Es, 8 GB Windows Edge, Firefox, WebKit and no-WebGL.
7. Review originals/licenses and visual behavior on owner's real low-spec computer; get explicit owner acceptance before any merge/release.

## Independent owner/operator acceptance (not code-developer claims)

Physical PLC, production wiring/safety, proprietary IDE compatibility, real plant-mechanics calibration and hardware networking are **not tested and not promised**. Owner review must also check camera use, screen-reader keyboard access, visual device dimensions, low-spec frame rate and equipment placement in authentic shop/teaching contexts.

**Never mark full P1/P2/P3/P4 or integrated product completed until combined runtime integration, tests and review are evidenced.**
