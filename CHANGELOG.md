# Changelog

Versioning policy: `package.json` version is the app/build version (0.x until the owner declares a beta). `ProjectFile.formatVersion` is the saved-project schema version (currently 1); it changes only with a migration and a round-trip test. The project library record has its own schema number (`LIBRARY_SCHEMA`). Entries are written from merged work; unmerged branches are not listed.

## Unreleased (stacked PRs #82, #83 and follow-ups; not yet merged to `main`)
- R0: master roadmap, status register, baseline evidence, early reports archived.
- R1: canvas-first workbench consolidation, explicit tool chip and V/T/I shortcuts, persisted panel visibility.
- R2: offline project library (IndexedDB), version history, backup/import, tab-conflict handling; service worker waits for a reload prompt.
- R3: golden tick tests, device contract, four tick phases extracted (`src/sim/phases/`).
- R4: Structured Text function blocks (TON, TOF, TP, CTU, CTD, R_TRIG, F_TRIG) and `T#` literals; Ladder limit 32 rungs / 48 tags.
- R6/R8/R9/R10: generated device catalogue, hidden-fault export redaction, commissioning report export, suggested course path, contributor guide.
- R9.3-R9.5: guided lessons with a generic outcome grader. R8.4: acceptance checklist. R10.2: scene authoring details. R6.2: alignment/distribution. R11.1: hostile-input fuzz.
- R6.2 (part): Top/Front/Side camera presets.
- R8.1: diagnostics overview.
- R5.5: meter continuity mode.
- R10.1: data-only scene package format (title, level, objectives, hints, project) with library import/export.
- R5.1 (part): wire colour and net label (presentation only, saved in the project as optional `wireStyles`, validated on load, pruned with the wire).
- R4: teaching PID function block in Structured Text (clamped output, anti-windup).
- R11: more panels load on demand (programming dock, live monitor, troubleshooting, plant scene, floor plan); sandbox route 575 to 504 KiB gzip.
- UX7: reference workbench layout for windows 1500 px and wider (full-width header, one compact selection toolbar, Move and Views menus, three-column component library). Account and notification icons and a CPU-load readout from the reference mock-up are deliberately not implemented.
- R09/R23: configurable scan period (10-500 ms), simulation speed 0.1x-10x with scan-cost diagnostics.
- R08: PLC capacity raised (256 rungs, 512 tags, ST 5000 statements) with static and run-time budgets.
- R10: factory scale raised to 250 components, 1000 wires, 240 bodies, 200 plant devices; physics broad phase (4.5x faster at the maximum) with a differential test against brute force.
- R12 (part): maintained selector switch, 24 V buzzer and 24 V alarm siren (electrical-model loads and contacts, PLC-drivable).
- R02/R16/R26: material catalogue, friction-limited belt carry, feeder quantity/depletion/variation, product collector; hard-wired belts now run without a PLC; plant devices show live status.
- R03 (part): inclined belt conveyor (friction decides who climbs).
- R04/R17/R21 (part): retroreflective photoeye, laser displacement sensor, RFID reader, machine-vision inspection sensor and measuring-wheel encoder, with continuous aim.
- R06 (part): compressed-air supply (compressor receiver, regulator, air lines) with pressure-aware cylinders and faults; device settings accept decimal steps.
- R7/R11: bounded soak and benchmark test (10 simulated minutes, maximal project).

## 0.1.0 (merged to `main` as of PR #26 and PR #70)
- Open 3D sandbox simulator with multi-PLC, configurable I/O, relay, timer relay, cylinder, stack light; P1–P25 factory work; local assessment flow.
