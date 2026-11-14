# PLC Skills Lab P11 — Chronological Worker-Verified Factory Trials

**Development date:** November 12, 2026. **Branch:** `engineering/p11-chronological-factory-assessment-2026-11-12`, based on verified P10 source `aacba381b63758d845e836678b8542274f154942`. The original P8 exact-head run queue remains independently open. No merges, deployment, external PLC equipment, SaaS/authentication or payments have been authorized.

## Stage objective

Expand P10's honest preflight into **21 machine-specific, strictly ordered, original practical learning trials**. A learner must actually author Ladder, ST or FBD, connect the supply and physical I/O, run or step the deterministic Web Worker, then witness relevant device/sensor signals on **separate** increasing 50 ms PLC scans. A tutorial button, 3D animation, copied reference code, or advancing clock alone cannot complete a trial.

Every scene has two to three explicit milestones described by real typed registered plant channels. These cover sorting, accumulation, weighing, elevated lifts, gantry grip/release, palletizer counting, crane storage, robotic material sorting, fluid process, bottle filling/capping, material/height/light-curtain inspection, rotary/turntable indexing, reversing lanes and warehouse intake.

## Evidence, scoring, integrity

The P11 source is `src/plant/scenes/assessment.ts`. Machine-specific goals are declared as bounded typed rising-edge/falling-edge or numeric-threshold crossings. **No simulation command is issued by this evaluator.** It reads only actual registered worker data from `RenderSnapshot.plantWorld.signals`, `RenderSnapshot.plcs[plcId].outputs`, and the validated `ProjectFile.wires`.

Required preflight: correct original equipment, powered PLC, all recorded recommended wiring patches, an edited PLC program, no faults/errors and **no debug forcing**. For PLC-commanded actions, real wired Q output must be observed energized before an actuator witness is accepted. The learner can use Ladder, FBD, or ST and receives no points merely for having changed code.

A goal is credited only when its worker signal crosses from the appropriate prior sample on a later simulated scan. **At most one milestone** is earned per worker scan. Completion means only that the explicitly named observations occurred in sequence; it is **not** a pass for a full real-world industrial process, an independently proven algorithm, safety protection, or equivalence with another simulator.

Evidence is kept **ephemeral only** in the UI, bounded to 21 known scene definitions, 2–3 milestone records and at most 60 real Q-output witnesses. Any project/program/wiring/settings change, time rollback, scene change, power/preflight loss, fault, debug forcing, reset or browser restart clears earlier witnesses. No hidden scoring keys or cloud sync.

The P9 scene library and P10 diagnostic panel remain intact. P11 adds an adjacent collapsible ordered trial in `src/ui/sandbox/SceneCommissioningPanel.tsx`, showing exact observed simulated timestamps and outstanding requirements.

## Exact-source acceptance requirements

- `tests/p11-chronological-factory-assessment.test.ts`: all 21 source goals mapped against the genuine worker's equipment signal/command schema; unsolved simulation does not earn results; full powered PLC16/ST -> wired original rotary actuator starts busy and later reaches indexed **on separate worker scans**; no invented output witnesses, stale project scoring, static/high-value initial sensor credit, manual forcing, fault carryover or reset reuse; real source model numeric tank threshold.
- `scripts/sandbox-p11-chronological-assessment-browser.cjs`: actual headless Chromium, editable factory scene, browser-local saved wiring and authored ST, real powered worker scan/rotary movement, chronological UI witnesses, no persisted simulated grade and fresh state after browser restart.
- Linux Actions must pass TypeScript, full Vitest, Vite build, offline, every P1–P10 browser gate, the P11 browser gate, accessibility, Firefox and Linux WebKit. Hosted Windows Edge must also pass for exact P11 head.

**No software verification claim until the exact final commit is green on both workflows.**

## Remaining further work

- Outcomes beyond bounded per-scene observations: multi-case reference grading, negative/wrong-program proof across all 21 scenes, full process sequencing and explicitly instructor-approved independent solutions.
- Analog output/PLC actuator control fidelity (e.g. true 0–10V valve), vendor drivers, industrial 3D robot kinematics, calibrated optical physics, richer authored 3D mechanical components, real 8GB no-GPU Windows hardware, real PLC connectivity, safety/licensing review and owner-user acceptance.
- All PRs remain open/draft and stacked; final selective reconciliation of overlapping branches is required before a later owner-authorized merge/release.

**Release gate: NO-GO.** P11 is original bounded educational assessment, not professional industrial control certification.
