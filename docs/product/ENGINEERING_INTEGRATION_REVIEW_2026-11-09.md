# Integration review — analog PLC bridge + isolated P2 LD/ST subset (9 November 2026)

**Branch:** `engineering/integration-analog-p2-review-20261109`
**Base:** `main` at `4b43c77f14a3aa73a7d8df48f2f0aa05fc543b77`.
**Upstream sources:** PR #28 (`engineering/plant-contract-and-browser-ack`), PR #29 (`engineering/analog-tank-plc-bridge`), selected independent P2 runtime/editor/test files from PR #31 (`engineering/p2-programming-depth-source`).
**Disposition:** draft engineering integration only; **not** a combined P1–P4 release or a completed three-conveyor/turntable acceptance.

## Evidence and scope

The audit read `CLAUDE.md`, the automation-platform developer skill, PRD v4, architecture, simulator-first audit, handover, workbench blueprint, plant library brief, sandbox-breadth progress and the 921-line consolidated FACTORY I/O text reference. Six PRs #28–#33 were inspected via current GitHub metadata, source handoffs and changed-file lists. Their source changes span **111 distinct paths**, with **12 paths edited on more than one PR**. All six PRs remain unmerged to main at the time of review.

The new review branch:
1. Preserves the current `main` tree (including the owner-provided FACTORY I/O reference documents) and carries over all 18 file differences from stacked PRs #28/#29, including existing wired PLC16 numeric `tank.LEVEL` feedback, isolation of numeric signals from the 24V solver, fail-closed open wire detection, 50ms scan, analog browser recipe and test-stabilization patches.
2. Adds only self-contained P2 runtime/editor/test files for **bounded WHILE, ABS/MIN/MAX/LIMIT in Structured Text** and **Ladder SET/RESET**. The remaining P2 FBD/debugging modules and their changes to shared worker types are **not** copied.
3. Adds `tests/analog-p2-integration.test.ts` using the actual worker to execute a user-authored PLC16 ST function/WHILE controller through wired pump hardware representation, deterministic tank process updates, fault-open and invalid LIMIT fail-closed paths.
4. Does **not** present original benchmark screenshots/videos as executable application code or assume any real Siemens PLC connectivity.

## Implementation and merge-state matrix

| Workstream | On main? | Present on original PR branch? | Present on integration review branch? | Independently verified on combined branch? |
|---|---|---|---|---|
| Existing deterministic worker, classic PLC map, basic LD/ST, 24V graph, browser-local projects | Yes | Existing baseline | Preserved | Pending current-head CI |
| #28 stable browser acknowledgement tests and plant-library contract | No | Yes | **Integrated** | Pending |
| #29 isolated tank numeric input to PLC16 ST driving wired pump | No | Yes | **Integrated** | Pending |
| #30 P1 multi-select, group editing, snap, rotate, undo/redo | No | Yes | **Deferred** due shared UI/worker conflict | No |
| #31 P2 bounded ST WHILE/functions, Ladder SET/RESET | No | Yes | **Selected runnable subset integrated** | Pending |
| #31 FBD, tag table, breakpoints, local forces | No | Yes | **Deferred** due shared PLC state/worker conflict | No |
| #32 P3 body world, 25 device definitions, ten editable scenes | No | Yes | **Deferred** due engine/registry/3D conflicts | No |
| #33 P4 three-phase domain, star/delta and virtual instruments | No | Yes | **Deferred** due shared electrical/worker/UI conflicts | No |

Other modules from independent PRs remain intact on their original branches; they have not been deleted, closed or merged. No wholesale `ours`/`theirs` conflict resolutions were made.

## Primary conflicts to reconcile next

The twelve multiply edited paths are:
`src/app/SandboxPage.tsx`;
`src/components/electrical-defs.ts`;
`src/components/registry.ts`;
`src/program/ProgrammingDock.tsx`;
`src/program/StructuredTextEditor.tsx`;
`src/program/p2-contract.ts`;
`src/render/Sandbox3D.tsx`;
`src/sim/faults.ts`;
`src/sim/orchestrator.ts`;
`src/sim/plc-io.ts`;
`src/sim/plcs.ts`;
`src/sim/signals.ts`.

Review these at the function/type/scan-phase level, not by replacing entire files. Preserve the original fixed classic PLC map and PLC16 configurable digital tag validation, ensure a single numeric signal bus, keep 24V and three-phase domains separate, carry P1 transforms through actual P3 physics before enabling rotation, and ensure P2 FBD/forces do not bypass physical inputs or scenario restrictions.

## Test and acceptance plan

The review branch needs **fresh** full-head evidence. The PR #29 reported a successful prior-head Linux and Windows Edge CI run; P2 source reports prior CI on intermediate heads, but neither establishes integration acceptance.

Run `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run verify:full`, and targeted real-browser `scripts/sandbox-analog-browser.cjs`. Ensure the existing browser suites remain green. The new regression must verify real worker tank movement and output shutoff, deterministic replay, numeric-wire open fail-closed, and invalid ST calculation fail-closed. Record exact SHA, job URL and failures; do not claim a pass from source inspection.

**End-to-end scenario supported here:** a user-authored tank, pump, PLC16 and supply; digital and numeric wiring; editable ST; powered Run; physical tank level feedback shuts off the pump; wire fault changes output; save/reload via the existing analog browser test. **Not yet supported as an integrated acceptance case:** three conveyors + working orientation-aware turntable transfer, two diffuse sensors, box movement, multi-axis 3D editing, and complete save/reload in one scene. That must be proven after P1/P3 merge rather than scripted in the renderer.

## Outstanding gaps, highest priority first

1. Reconcile P1/P2/P3 shared orchestrator, signal contracts, PLC state and saved-project typing without loss of analog functionality. Build a genuine generalized multi-device workcell with sensor-driven PLC outputs and worker-owned body motion.
2. Integrate P1 orientation/selection, original 3D scene controls and P3 world coordinate/rotation physics; reject invalid placement visibly.
3. Add the P2 FBD editor/runtime, debugging and trace bridges under actual PLC snapshot semantics, without letting debug forces bypass graded exercises or physical safety interfaces.
4. Integrate P4 isolated 3-phase/star-delta domain and worker-only motor truth, keeping its illustrative limitations explicit.
5. Verify cross-branch project migration, fault persistence, low-resource rendering, no-WebGL controls, accessibility, and clean recovery/undo.

## Separately unverified owner/device items

Real PLC Ethernet/driver operation, physical contactors/sensors/motors, electrical accuracy and protection ratings, actual factory-equipment collision calibration, low-spec/embedded GPU performance, full Chrome/Edge/Firefox/Safari compatibility on owner hardware, and owner visual/usability acceptance are **not** established. No backend, auth, cloud sync, payment, production deployment, certified PLC/IEC claims or main-branch merge is authorized.
