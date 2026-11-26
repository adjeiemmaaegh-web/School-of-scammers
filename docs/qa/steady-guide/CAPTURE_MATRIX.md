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

## Populated screenshot evidence workflow (2026-11-20, feature development)

The browser capture recipe now requires **actual project device and wire counts** and records SHA-256 for each original PNG, the checked-out source commit, viewport, state, a descriptive ALT candidate and pending human-review status. An isolated disposable browser profile creates a real six-component starter panel, connects eleven named terminal wires through existing simulator buttons, and captures these verified review subjects:

| New candidate | Programmatic proof and important limit |
|---|---|
| SG-04 | Six actual placed starter devices including PLC and motor; does **not** prove two selected industrial machines or field 3D acceptance |
| SG-05 | Eleven real terminal wires and visible logical schematic; not real electrical safety compliance |
| SG-06 | Populated 2D Floor Plan of that same project |
| SG-08 | Motor selected through real schematic; Inspector is populated, not an empty placeholder |
| SG-09 | Three-contact Ladder example actually loaded into the real PLC editor |
| SG-10 | Real ST editor; **timer/PID source still not demonstrated** |
| SG-11 | Real FBD graph editor; compiled FBD execution still not demonstrated |
| SG-12 | Real worker scans and 24 V virtual meter probes; comprehensive live-I/O review still open |
| SG-13 | Twenty-one source-backed Guide atlas cards; simulator scene-picker comparison remains open |

The existing fourteen screenshots remain separately identified (some explicitly empty-state). The expanded suite is **23 captured review states** if the run succeeds; state assertions prevent missing subjects from silently becoming accepted. Visual quality, current-version screenshot annotation and SG-14/15/17/18 advanced subjects still need review or further captures. CI artifacts are temporary evidence, never automatically copied into `public`. Earlier matrix statuses are conservative and are not converted into accepted simply because a screenshot exists.

**CI correction:** The first attempt at this expansion (`8735ee32`) did not reach the capture step because a new asynchronous status-announcement test asserted too early. The next draft-branch commit fixes that wait and gives each populated capture a unique evidence ID (for example `SG-08-populated` with `subjectId: SG-08`). Actual 23-state image generation and review remain unverified until a new CI artifact exists.

**Capture test correction:** CI run `44652465050` confirmed that the six-device starter-project step executes but timed out at the Inspector heading. The populated Inspector uses `.sandbox-inspector-top h2`, not the empty checklist's heading selector. The next capture revision checks selected ID and model-limit evidence and preserves screenshot artifacts in a separate QA upload even on failure. SG-04 was exercised, but no entire capture suite was accepted.

## Visual readability review and native focused crops (2026-11-20)

The successful automated run `44653094416` created 23 PNGs and a manifest. Independent extraction verified **23/23 SHA-256 hashes, 23 unique IDs and the exact commit `2139c994`**. A nine-image contact-sheet review exposed that the SG-09 Ladder, SG-10 ST, SG-11 FBD and SG-12 virtual-meter subjects are difficult to read near the bottom of the 1440×940 whole-window captures; SG-08's detailed model text can also be truncated by the panel viewport. SG-13's original capture landed in the middle of a long list rather than its heading.

The next capture revision retains all 23 original context screenshots, aligns the scene atlas at its beginning, and adds **five native DOM-element screenshots** (SG-08/09/10/11/12 focused), bringing the capture recipe to **28 separate PNG review states**. These are genuine screenshots directly from the running application, with each focused file linked to its full-window parent in the manifest. They must not be described as unmodified full-screen images. They need another exact-head CI run and human visual approval; a cropped readable view does not certify a training walkthrough or real PLC hardware equivalence.

## Focused-capture framing correction (2026-11-20)

Downloaded the initial 28-image artifact for `d72451b3` and verified **28/28 PNG hashes**, **28 unique IDs** and exact source SHA. Visual inspection detected that `ElementHandle.screenshot()` for the oversized desktop programming/diagnostics editors captured unrelated upper workbench pixels and blank space, because those elements extend outside their clipped, independently scrollable panes. **These five focused PNGs did not meet subject-level visual acceptance despite passing capture/metadata CI.**

The next capture revision uses the simulator's own Inspector/Dock resize controls, scrolls the actual target inside its real pane, and crops **only the visible viewport intersection of that pane**. It records the scroller selector and visible crop dimensions. Whole-window original captures remain unchanged and are still linked. The revised five focused images require a fresh exact-head CI artifact and independent visual examination; they must never be represented as full-editor screenshots. Do not publish old focused images.

## First-lamp real-UI verification (development-only)

The tutorial now includes a structured named-terminal checklist that is tied to both a registry-validating native test and a new Chrome **manual UI** build-and-test recipe. The recipe creates the three real virtual devices using the existing searchable equipment library, connects three exact terminals using real controls, observes the virtual lamp OFF → ON → OFF through live worker scans, deliberately removes one wire and confirms the lamp stays OFF, and returns to Steady Guide without changing the project. This is functional evidence, not an additional screenshot or safety approval; its exact-commit CI result is required before acceptance.
