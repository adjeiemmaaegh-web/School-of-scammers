# P12 — Multi-Case Factory PLC Validation (Development Record)

**Date:** 2026-11-12  
**Source branch:** `engineering/p12-multicase-factory-validation-2026-11-12`  
**Parent:** exact CI-verified P11 `450247c3b52cf9724555060501d0c930e8f332fa` (draft PR #51)  
**Production:** NO-GO. No merge, deployment, payment, accounts, cloud, external PLC, or electrical safety authorization.

## Engineering goal

P11 observes two or three chronological worker-signal milestones from the currently running simulation. P12 adds a distinctly stronger **program counterexample harness**: independently rerun the submitted real learner Ladder/FBD/ST and physically modeled machine with different 24 V inputs, withdrawal, an injected plant failure, then repair. The same program must pass **all four** independent cases; a constant-ON or constant-OFF program demonstrably fails instead of earning credit from a single coincidental event.

The first calibrated P12 matrix targets six original factory scenes:
- rotary-inspection: index idle, button request, early release/hold, stuck actuator and repair
- two-level-lift and scissor-lift-station: stationary baseline, rise to real top limit with PLC feedback, stop at intermediate height on release, stuck lift and repair
- guarded-conveyor: belt run when clear, belt stop + physical stopper on blocked input, return after clear, stuck stopper and repair
- height-guard: tall input triggers the physical stopper; normal/release/stuck/repaired cases
- material-inspection: reject gate follows material input, returns home and recovers after a jam

The remaining fifteen original scenes continue to use P11's worker-observed chronological goal checks. Their P12 multi-case reference matrices are **not yet implemented**. This avoids claiming all 21 are fully independently graded.

## Actual input/control and test isolation

`src/plant/scenes/matrix.ts` operates exclusively on a cloned, validated `ProjectFile`, using the existing authoritative `createWorld()` and `tick()` simulation API, not DOM/Three.js, direct PLC coil values, a fake model, external network calls or wall clock.

For each case, an ephemeral **genuine 24 V normally-open pushbutton** is inserted in the clone, connecting its actual A and B terminals between the registered supply P24 and PLC16 input I0.0. The original material-sensor wire into I0.0 is temporarily removed from that **test clone only** to create repeatable low/high operator stimulus. The original submitted workcell MUST already have its real physical sensor terminal wired to I0.0 (where applicable), the required PLC Q outputs mapped to actuator CMD loads, and the appropriate sensor supply/return and machine electrical common connections. The original user-authored program is unchanged. Physical feedback from top/index sensors into PLC I0.1 remains connected during tests.

Each case loads a fresh engine. It exercises only real `operate` commands on the test button and actual `setPlantFault`/clear while paused for the isolated plant failure. The worker calculates all PLC outputs and device motion. The fixture, fault and any temporary wiring are NEVER written back to the learner's project or included in saved/exported data.

The runner requires a learner-edited PLC program, original registered scene equipment, valid 24 V supply/PLC, documented exact I/O training patches, no outstanding user faults and no duplicate test-fixture ID. It also demands dedicated Q outputs, so unrelated parallel command loads cannot make the response accidentally appear correct.

## Four independent cases for every supported workcell

1. **Idle:** With the test NO button open, observe a genuine powered PLC and required off/on state. Constant-ON and uncommanded motions fail.
2. **Demand:** Close the test button. Verify energized wired Q, actual machine response, travel limit/return where defined, and correct stop on indexed/top feedback for rotary and lift. Constant-OFF and no-interlock solutions fail.
3. **Release:** Open the button while motion is underway or a stop/reject is active. Verify commanded shutdown, actuator return/holding behavior and no unsafe/unexpected completion within the bounded teaching model.
4. **Fault and repair:** Inject a real supported plant failure while the PLC still requests action, verify that the machine **does not** falsely reach the demanded state, clear the fault while paused and verify fresh physical motion/recovery in the worker.

The per-case result includes pass/fail, exact model reason and worker simulated millisecond timestamp, plus a bounded scan count. The UI can only request the test; it does not write simulation outcomes or generate a passing score.

## CPU/offline architecture and acceptance

The test runner lives in a dedicated browser module worker `src/sim/p12-assessment.worker.ts`. Its work is bounded by the fixed six named scene specs and a project-size cap, and does not interrupt or overwrite the existing simulation's worker. The React panel `src/ui/sandbox/SceneMatrixPanel.tsx` is explicitly user-triggered, read-only, displays actionable missing wiring and resets its transient report on any project/source change or scene change. Closing/reloading the browser discards the result.

The P3 worker bridge also fixes a genuine earlier integration flaw: omitted numeric `height` inputs are now ABSENT instead of fabricated zeros, allowing correctly energized discrete UP/DOWN lift commands to take effect. This does not imply arbitrary analog PLC outputs are implemented.

**Automated acceptance for the exact P12 head:**
- `tests/p12-multicase-factory-validation.test.ts`: all six named scenes pass with an independently programmed, real worker/PLC project, 4 cases each; runs are deterministic; wrong constant-ON/constant-OFF and missing end-limit interlocks fail; broken wiring, unresolved fault or colliding fixture fails closed; no project mutation.
- `scripts/sandbox-p12-multicase-browser.cjs`: real Chromium factory scene, authored Structured Text + physical 24 V wiring, invokes an actual second browser worker, verifies four passing outcomes, edits the project into a wrong constant-ON program and proves the matrix fails, all without saving any test fixture or results.
- `.github/workflows/ci.yml`: P12 browser test is mandatory after P11. Full Linux TypeScript/Vitest/Vite, existing P1–P11 E2Es, accessibility, offline, no-WebGL, Firefox and Linux WebKit, and native hosted Windows Edge workflows must pass on the same P12 commit.

**Development source is not accepted until both exact-head workflows are completed successfully.**

## Remaining beyond bounded P12

The remaining 15 scene-specific multi-case matrices, complete reference traces and multiple valid solutions, fully independent instructor grade/certification, sophisticated articulated robot/industrial general physics, calibrated sensing, analogue actuator output networks, external PLC drivers, owner-run 8 GB no-GPU Windows hardware, physical PLC performance, security/licensing, safety and user acceptance remain open. These are explicitly separate from automated browser/CI verification.

This is a legally original **educational industrial simulator**, not verified parity with a commercial factory-simulation product, certified electrical safety equipment, or an industrial commissioning system.
