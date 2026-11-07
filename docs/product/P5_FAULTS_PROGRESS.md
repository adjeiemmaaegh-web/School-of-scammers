# P5 — Faults and diagnostics

**Status:** Active P5 source development on `engineering/p5-faults-diagnostics`, stacked on the unmerged P0–P4 draft branches (PRs #14–18). **Not merged, not accepted, not deployed.** No backend, accounts or cloud. P5 full exit is **INCOMPLETE** (see "Still open").

PRD P5 exit criterion: *an instructor injects a fault; the learner diagnoses it with the tools and restores operation.* This slice delivers that loop for the 24V start/stop motor circuit and any layout containing the same devices.

## How a fault works

A fault never sets a symptom or a UI flag. It changes **what the authoritative circuit solver is given** (`buildCircuit` and the wire list in `src/sim/orchestrator.ts`), so every consequence comes from the same netlist the learner measures with the multimeter. The fault model is pure and DOM-free: `src/sim/faults.ts`.

| Fault | What the solver sees | What the learner can observe |
|---|---|---|
| Open conductor | the wire stays in the project and wire list but conducts nothing | wire is listed as connected; meter reads **floating** downstream of it, 24 V upstream |
| Contactor coil open | coil is not part of the circuit | PLC Q0.0 is on and **24 V is across A1–A2**, but the contactor never pulls in |
| Contactor contacts welded | NO contacts forced closed (linked NC forced open) | motor runs with no command and **cannot be stopped**; the armature indicator is released, so the weld is not visible |
| Motor winding open | load is not part of the circuit | contactor closes and **24 V is at the motor terminals**, but the motor never runs |
| Pushbutton stuck | contact state ignores the operator (stuck as if pressed or released) | START starts itself, never starts, STOP blocks every start, or STOP stops nothing (latent until used) |

Not injectable: the training E-stop (deliberately), PLC internals, sensors.

## Commands (all in `src/sim/signals.ts`)

`injectFault` (worker assigns the id; allowed while running), `injectSeededFault` (`seed` picks one applicable fault deterministically via mulberry32 over a fixed candidate order), `clearFault`, `revealFault`, `repair` (replace a part or re-terminate a wire; **requires the simulation paused**, same rule as every other edit). Faults live in the optional `ProjectFile.faults` field, so old v1 projects load unchanged and fault-free projects keep their exact v1 shape. Deleting a wire removes any open-conductor fault on it so exports always validate.

## Hidden faults and alarms

- A **hidden** fault is listed only as "Hidden fault N" and logged as "A fault was injected (hidden)" until revealed. This is a **practice convenience, not security**: exported project JSON contains the fault.
- **Alarms** (`src/diagnostics/alarms.ts`) are supervisory and report a **symptom only**, never a cause: `START_FAILURE` (Run output ON for 1 s with the motor not energized) and `UNCOMMANDED_RUN` (motor energized for 6 scans with Run OFF). Different faults deliberately produce the same alarm. They are active/cleared records in a bounded history (40).
- `repair` logs only "Replaced X with the simulation isolated". It never says whether anything was wrong, so guess-and-replace is not rewarded, and replacing a healthy part visibly changes nothing.

## UI

`src/ui/sandbox/TroubleshootingPanel.tsx`, in the Test stage under the multimeter: collapsible instructor controls (inject, mystery fault with seed, reveal, clear), an always-visible *Replace a part*, and the alarm history. Light, dark and phone widths checked; no horizontal overflow at 390 px.

## Evidence (local run, Linux, headless Chromium)

- `tests/sandbox-p5-faults.test.ts` — 32 tests: each fault's real consequence and meter story, symptom-only alarms and no hidden-cause leakage, repair rules, validation, seeded reproducibility, project round-trip and legacy load, deterministic replay, no alarm false positives over a full start/stop cycle. A **mutation check** (disabling each hook in turn) made 2–5 tests fail each time, then all 32 passed again once restored.
- `scripts/sandbox-p5-faults-browser.cjs` — drives the real UI: hidden coil fault → silent symptom → alarm → on-screen multimeter diagnosis (24 V across the dead coil) → reveal → replacing a healthy part changes nothing → replacing the contactor restores the motor and clears the alarm → seeded repeatability → hidden fault survives reload. Passed 10/10 consecutive runs.
- Whole suite at this commit: 659/659 unit tests; all nine sandbox browser scenarios pass. CI runs the new script after the P4 reversing step. **CI verified:** `ci.yml` was dispatched manually on the branch (CI does not run on plain branch pushes): [run 42334198337](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42334198337) on `f60ce7f` succeeded end to end, including this E2E, the P4 reversing E2E, bundle budgets, offline, accessibility, no-WebGL and the Linux Firefox/WebKit smoke. The Windows Edge workflow, low-spec Windows and real-GPU 3D runs were not performed.

## Still open

Faults on sensors, the photoeye/level probe, pneumatics and the tank workcell; intermittent faults; more alarm rules (e.g. overload and breaker alarms, feedback-input mismatch); an execution-trace export tied to a fault session; scoring of repairs (P6); instructor/learner separation beyond a UI convention; owner visual review; real-device and cross-browser acceptance. The fault parts are idealised 24 V abstractions, not failure physics, and nothing here is safety-rated or certified.
