# Steady Guide screenshot capture and approval matrix

All user-facing screenshots must show **genuine app UI**, never invented or AI-generated facsimiles. Capture uncut source PNGs, then compress reviewed public assets and record SHA, viewport, project state and ALT.

| ID | Required subject | State |
|---|---|---|
| SG-01 | Home page with four destinations | NOT CAPTURED |
| SG-02 | Empty simulator desktop, all workbench controls | PARTIAL: existing real R1 captures, owner review pending |
| SG-03 | Simulator tablet and narrow layout | PARTIAL: existing real R1 768×1024, review pending |
| SG-04 | Physical 3D placement + two selected machines | NOT CAPTURED |
| SG-05 | Logical terminal wiring | NOT CAPTURED |
| SG-06 | Floor plan placement | NOT CAPTURED |
| SG-07 | Filtered component library | NOT CAPTURED |
| SG-08 | Inspector selected component, model limits | NOT CAPTURED |
| SG-09 | Ladder editor | NOT CAPTURED |
| SG-10 | ST editor including supported timer/PID | NOT CAPTURED |
| SG-11 | FBD editor | NOT CAPTURED |
| SG-12 | Live I/O and virtual meter | NOT CAPTURED |
| SG-13 | Gallery of 21 scenes | NOT CAPTURED |
| SG-14 | Sorting before/after genuine scan | NOT CAPTURED |
| SG-15 | Fault and diagnostics overview (no secret answers) | NOT CAPTURED |
| SG-16 | Project library and backup | NOT CAPTURED |
| SG-17 | Two-tab conflict or blocked storage with synthetic project | NOT CAPTURED |
| SG-18 | Learn page and guided lesson panel | NOT CAPTURED |

Existing files now available in public as `/steady-guide/media/r1-*.png` (5 PNGs, about 1.03 MB total). Original GitHub blob references and source metadata are in `public/steady-guide/media/manifest.json`. These screenshots are accurately identified as **R1** evidence and may become stale after later UI changes.

Review viewports: 1440×940, 1366×768, 1280×720, 1024×768, 768×1024 and 390×844. Verify no screenshot contains any private project or assessment secret.

## CI capture evidence and distinction (2026-11-19)

An **eight-image genuine Chromium set** from draft PR #89 commit `f280fc5e` was captured on 2026-11-19 at 12:36 UTC and visually reviewed. It contains actual Home, Steady Guide, empty workbench, Logical view, Floor Plan, 768×1024 tablet, 390×844 Guide and Learn & Practice. These are **review evidence**, not final approved in-app training illustrations. The browser action also now scripts **14 capture states** on the feature branch, adding a filtered photoeye library, program dock (no PLC), diagnostics on empty project, Inspector without a selected device, and local project-library dialog. The richer SG-08/09/12 subject acceptance is **not yet met** by empty-state images. Captured state and training adequacy are different checks; final screenshots require a genuinely populated virtual project.

Source CI artifact: https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/44524998472/artifacts/14532642115 . This artifact is temporary; separately reviewed binary assets are still not committed to `/public` beyond the existing five authentic R1 workbench PNGs.
