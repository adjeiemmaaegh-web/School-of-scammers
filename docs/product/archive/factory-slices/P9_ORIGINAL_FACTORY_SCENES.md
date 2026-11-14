# P9 — Original 21-Scene Industrial Learning Library

**Engineering checkpoint:** 2026-11-12.  
**Branch:** `engineering/p9-original-factory-scenes-2026-11-12`, branched from P8 commit `5ef17dd91d8edc175112e253a6913497d5acab77`.  
**Status:** Source development implemented; P8 source acceptance and P9 exact-head GitHub Actions verification **both remain open** until the queued workflows finish. This is a draft/staged review, **not a merge or production release**.

## Goal

Make the existing open, editable three-dimensional industrial automation workbench offer a broad progressive library of **21 original learning layouts**, analogous in *educational breadth* (not copied visuals or source assets) to the operator experiences in factory-simulation software. Each scene is a user-editable starting point, not a playable video, inaccessible preset, pre-solved wiring, fake PLC output, or commercial vendor scene reproduction.

This is a **P9 gallery and scenario-authorship stage**. It does *not* imply that all 21 vendor-reference industrial scenes or their advanced machine physics are implemented in the same manner. Individual 3D device dynamics remain constrained by the registered P3/P8 educational models.

## Delivered engineering scope

### Catalogue integrity

Preserve all ten existing scene IDs in original order:

1. `sorting-line` — photoeye and diverting line
2. `gate-accumulation` — stopper accumulation
3. `weigh-reject` — mass threshold pusher
4. `two-level-lift` — two-level transfer
5. `gantry-transfer` — 2-axis gripper
6. `palletizing` — layer palletizer
7. `mini-warehouse` — rack and crane
8. `robot-sort` — robotic sorting
9. `mixing-tank` — heated batch processing
10. `bottle-line` — fill and cap

Add eleven **original** arrangements:

11. `material-inspection` — inductive/capacitive comparison
12. `height-guard` — height sensing, stopper and pusher
13. `three-way-handoff` — three-way roller transfer and worker-indexed turntable
14. `reversible-roller-lane` — reversible accumulation
15. `parallel-sort-cells` — independent lines
16. `scissor-lift-station` — elevated transfer and lift limits
17. `rotary-inspection` — indexed part presentation
18. `guarded-conveyor` — educational optical stop (NOT safety rated)
19. `temperature-batch` — level, heat, mixing and valve
20. `flow-valve-diagnostics` — numeric outlet travel and fault inspection
21. `robot-warehouse-receiving` — crane/rack/robot intake

Each includes a deterministic seed, a valid register-sourced equipment layout, reference signal names, an *illustrative* ST solution only shown under an explainer, and a grounded acceptance/learning objective. The worker never silently injects that solution or wiring.

### Learning navigation and overwrite safety

- Full-text search and five subject categories with Foundation, Intermediate and Advanced labels.
- Original skills and a short description in every scene card; search is deterministic and local only.
- If a project has **any existing devices**, request an explicit second confirmation or allow Cancel before replacing it; otherwise create the editable scene directly.
- Preserve old gallery selectors and real worker `loadPlantScene` command, while requiring a new P9 browser acceptance gate for the gallery, searching, loaded scene integrity and overwrite cancellation.

### Persisted 3D placement semantics

Existing P3 scene import previously discarded **yaw** and nonzero **elevation** from the authoring catalogue. For example, the elevated outfeed in `two-level-lift` used to become an ungrounded floor conveyor on import. P9 preserves these in the project's optional `yawDeg` and `elevationMm` properties and passes them directly to the P3 worker. Rules:

- Elevation is only allowed for P3 equipment, as a safe integer **0–2500 mm**. It is optional, absent in legacy files, and never implicitly applied to a PLC or 24 V power supply.
- Rotations remain supported canonical 0, 90, 180, 270 degrees; the scene import does not override user-authored PLC code or wire electrical terminals.
- Existing 2D projects with no elevation have their original behavior and serialized shape.
- P9 preserves imported elevation through the worker, save/load, rendering coordinates and later normal 3D editing. This is an idealized elevated static attachment, not proof of complete mechanical collision, continuous surface support or vendor hardware behavior.

## Verification and stage acceptance matrix

1. `tests/p3-equipment-contract.test.ts` now checks all 21 starting plants, exact preservation of the historic ten, unique scene IDs and seeded worker stepping.
2. `tests/p9-21-scene-catalogue.test.ts` covers identity, deterministic metadata, five categories, search, all 21 *real* worker scene imports, **zero prewired outputs**, seed stability, numeric/bool channel mappings, yaw/elevation project roundtrip, strict elevation rejection and nonexistent scene fail-closed behavior.
3. `scripts/sandbox-p9-21-scenes-browser.cjs` creates and filters the gallery in Chromium, opens genuine editable worker projects, proves replacement requires confirmation, verifies no automatic wiring/ST solution, confirms orientation/elevation save/reload, then starts real worker simulation.
4. `.github/workflows/ci.yml` requires the P9 browser acceptance after existing P7/P8 E2Es. All prior browser tests, Linux Firefox and WebKit, offline/no-WebGL, accessibility, TypeScript/Vitest/Vite, performance budgets and hosted native Windows Edge remain gates.
5. **Only final-head green Linux and Windows CI** is sufficient to mark P9 software engineering verified. P8's queued final-head workflows are a separate open ancestor gate; P9 does not silently certify P8.

## Known limitations and release constraints

These 21 scenes are **original unsolved educational layouts**, not 21 claimed engineering-identical FACTORY I/O scenes, real safety cells, fully kinematic industrial machines, advanced PLC communication drivers, or hardware PLC verification. Large-scale mechanical collisions, photometric sensor calibration, true 3D CAD import, linked external PLC networks, structured assessment criteria for all 21 scenes and owner-device measurements remain explicit future work or acceptance tasks.

Nothing in P9 authorizes a merge of P7/P8, external PLC connectivity, a server, accounts, database, payments, staging, hardware testing or production release. Keep this PR draft and stacked until P8 verification and P9 software checks are independently green.
