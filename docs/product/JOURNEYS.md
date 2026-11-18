# User journeys and their evidence (roadmap R12.2)

Each journey names the script that drives it in a real browser from an empty project (or the stated starting point). A passing script is automated evidence only. The journeys have not been walked by real students or instructors, and no screen recording or physical-device run is attached: those are owner gates.

| Journey | Script(s) | Notes |
|---|---|---|
| Empty project, place, wire, program a starter | `scripts/sandbox-browser-acceptance.cjs`, `scripts/sandbox-p2-browser-acceptance.cjs` | Latch, run, stop, wrong logic, broken wire |
| 24 V motor panel with protection | `scripts/sandbox-p4-panel-browser.cjs` | Breaker, overload, E-stop, meter |
| Reversing starter | `scripts/sandbox-p4-reversing-browser.cjs` | Interlocks, E-stop, broken NC link |
| Analog tank | `scripts/sandbox-analog-browser.cjs`, `scripts/sandbox-p3-tank-browser.cjs` | Numeric input, level control |
| Sorting and pneumatics | `scripts/sandbox-p3-sorting-browser.cjs`, `scripts/sandbox-p14-cylinder-faults-browser.cjs`, `scripts/sandbox-p13-relay-cylinder-browser.cjs` | Photoeye/diverter; cylinder with limit switches and faults |
| Multi-PLC scene | `scripts/sandbox-p7-multiplc-browser.cjs`, `scripts/sandbox-p10-multiplant-browser.cjs` | PLC-to-PLC signalling over a shared common |
| Hidden fault diagnosis | `scripts/sandbox-p5-faults-browser.cjs`, `scripts/sandbox-p5-sensor-browser.cjs` | Symptom-only alarm, multimeter, replace the faulty part |
| Graded scenario / assessment | `scripts/sandbox-p6-scenario-browser.cjs`, `scripts/qa-candidate-employer-browser.cjs`, `scripts/qa-share-code-browser.cjs` | Local, unsigned result codes |
| Guided lesson | `scripts/sandbox-r9-lessons-browser.cjs` | Start, honest failure, UI build passes, wrong build fails, acceptance checklist |
| Save, library, export/import, versions | `scripts/sandbox-r2-project-library-browser.cjs`, `scripts/sandbox-project-storage-browser.cjs` | Two-tab conflict, restore, damaged record, no IndexedDB, scene package |
| Offline start and update | `scripts/offline-acceptance.cjs`, `scripts/offline-update-browser.cjs` | New build waits for a reload prompt |
| Workbench use at five screen sizes | `scripts/sandbox-r1-workbench-browser.cjs` | Screenshots in `docs/qa/r1/` for owner review |
