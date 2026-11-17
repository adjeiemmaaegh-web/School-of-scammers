# Changelog

Versioning policy: `package.json` version is the app/build version (0.x until the owner declares a beta). `ProjectFile.formatVersion` is the saved-project schema version (currently 1); it changes only with a migration and a round-trip test. The project library record has its own schema number (`LIBRARY_SCHEMA`). Entries are written from merged work; unmerged branches are not listed.

## Unreleased (stacked PRs #82, #83 and follow-ups; not yet merged to `main`)
- R0: master roadmap, status register, baseline evidence, early reports archived.
- R1: canvas-first workbench consolidation, explicit tool chip and V/T/I shortcuts, persisted panel visibility.
- R2: offline project library (IndexedDB), version history, backup/import, tab-conflict handling; service worker waits for a reload prompt.
- R3: golden tick tests, device contract, equipment-state phase extracted from `tick()`.
- R4: Structured Text function blocks (TON, TOF, TP, CTU, CTD, R_TRIG, F_TRIG) and `T#` literals; Ladder limit 32 rungs / 48 tags.
- R6/R8/R9/R10: generated device catalogue, hidden-fault export redaction, commissioning report export, suggested course path, contributor guide.
- R7/R11: bounded soak and benchmark test (10 simulated minutes, maximal project).

## 0.1.0 (merged to `main` as of PR #26 and PR #70)
- Open 3D sandbox simulator with multi-PLC, configurable I/O, relay, timer relay, cylinder, stack light; P1–P25 factory work; local assessment flow.
