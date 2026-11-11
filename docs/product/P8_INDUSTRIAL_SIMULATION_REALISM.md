# P8 — 3D Industrial Simulation Realism: source and verification register

**Source branch:** `engineering/p8-industrial-simulation-realism-2026-11-11` (draft PR #48, stacked on verified P7 commit `adb7cd53a3ba8e85d576d4968874924b03822110`).  
**Date:** 2026-11-11. **Status:** P8 source development in progress; exact-head acceptance pending. **Do not merge or deploy.**

## Scope and architectural invariants

P8 is an *original, bounded educational 3D simulation* increment, not a clone of FACTORY I/O, certified mechanical physics, calibrated industrial optics, or hardware controller equivalence. The original 50 ms worker PLC scan and five deterministic 10 ms material-flow substeps remain authoritative. WebGL graphics and camera pose do not produce fake PLC inputs or override a saved sensor reading. The core app remains offline-first with no backend, database, accounts, cloud, payments or real PLC network controls.

The full educational P8 code deliverable includes **(1)** active static/dynamic sensor occlusion, **(2)** fixed-obstacle material flow, **(3)** physically scoped first-person inspection, **(4)** reusable offline assembly rotation, and **(5)** recognizably distinct 3D machinery, followed by whole-app browser and Windows verification.

## Implemented capabilities and model limits

| Workstream | Worker or UI implementation | Explicit model limitation |
|---|---|---|
| Directional sensing and mounting | Inherited P7 forward-sensing `beamMode=1` and worker-owned yaw-aligned detection zone | Quarter-turn directions and idealized body reference points, not optics calibration |
| Fixed-structure occlusion | `occlusionMode=1` checks 3D line-of-sight through registered opaque shelf/process-vessel envelopes using the worker scene's geometry | Both solids treated as fully opaque, even when a real rack might have openings; no reflection or transparent materials |
| Moving parcel occlusion | `occlusionMode=2` additionally considers real saved-world body envelopes between sensor and qualified target; inductive proximity can be blocked by nonmetal parcel | Conservative bounded body envelopes, not per-pixel rays or beam intensity; defaults preserve previous scenes |
| Material-flow contacts | `blockMaterialFlow=1` on shelf/process vessel stops a carrier-driven parcel at a new 3D contact; logs worker jam event and exposes real conveyor jam signal | Only opted-in, stationary solids; existing queue/contact logic remains; no general mesh solver or continuous-angle contact |
| PLC-powered variable belt speed | The worker bridge now respects the saved `speedMmS` dial when no numeric speed wire is mapped, instead of incorrectly injecting a 0 mm/s demand into an energized belt | Still not a calibrated external analog-speed I/O protocol; explicit typed numeric control needs a separate bridge |
| 3D scene rotations | Shelf and process tank gain valid worker quarter-turn editing; original P7 carrier rotations remain | Other orientation-locked process/robot mechanisms still disallow unsupported yaw |
| First-person camera | Space initiates gravity-limited jump with no repeated jump on held key; navigation collision height uses actual equipment registry footprints; tall racks remain obstacles and low conveyors can be cleared | Camera is view-only, **not** a physical person body or sensor input. No camera-triggered I/O or human-safety claims |
| Reusable assemblies | Offline saved workcells rotate together by 0/90/180/270 degrees before insertion; each wire, device settings and PLC data preserved; worker owns paste validation | No live linked hierarchical prefabs, CAD import or multi-select bones/rigging |
| Original 3D machinery | Structural rack decks/posts/opaque back, vessel fittings and visible turntable indexing use source-defined equipment / worker progress | Rendering is a truthful teaching illustration, not mesh-level industrial CAD or physics engine |

All new behavior that could change a historical scene is explicitly opt-in or edit-requested. Project save/load continues to omit default settings. A user-created plant is never modified by moving the camera.

## Mandatory software verification matrix

- `tests/p8-optical-occlusion.test.ts`: yaw, sensor zones, fixed occlusion, invalid parameters and compatibility.
- `tests/p8-moving-body-occlusion.test.ts`: opt-in second-body sightline, material classification, height, target-ID exclusion and immutability.
- `tests/p8-fixed-solid-collisions.test.ts`: worker jam, actual conveyor status, yaw/elevation, no legacy opt-in, contact conservation.
- `tests/p8-worker-plc-integration.test.ts`: genuine supply → PLC16 ST → feeder → body → photoeye → PLC input/output → lamp, with blocked/unblocked target.
- `tests/p8-wired-belt-motion.test.ts`: physically moving parcel with real PLC-wired belt, saved speed command fallback, and no invented movement when unpowered.
- `tests/p8-first-person-jump.test.ts`: camera-only gravity, key hold, height-aware collision, Fly compatibility.
- `tests/p8-assembly-transform.test.ts`: bounded 90-degree workcell transform, preservation of inner wires/settings/programs and authoritative worker paste.
- `scripts/sandbox-p8-optical-browser.cjs`: real browser, worker-spawned body and PLC sensor in both modes.
- `scripts/sandbox-p8-jam-browser.cjs`: real browser, worker-driven conveyor versus a rack, with genuine jam/legacy comparison.
- `scripts/sandbox-p8-assembly-rotation-browser.cjs`: browser-local assembly shelf, reload, quarter-turn insertion, real worker paste/wiring and corrupt-reset handling.
- All P7 3D commissioning, Undo/Redo, editable machine, assemblies and clearance tests, earlier PLC/electrical/fault/sorting/assessment browsers, offline/no-WebGL/keyboard accessibility, Firefox/WebKit smoke and native hosted Windows Edge must be green **on the final source head**.

Do not infer success for a changed commit from CI for an older head. The Linux workflow can be cancelled or blocked during Firefox/WebKit installation; that is an open CI gate until it finishes.

## Deferred realism that must not be claimed as completed P8

General arbitrary-angle 3D rigid-body physics and swept mesh contacts; calibrated reflection/refraction/beam ray bundles; moving robot-arm geometry collision and real manipulator kinematics; person-avatar collision and camera-driven sensor activation; high-resolution CAD/FBX imports, true linked hierarchical assemblies, and full 21-scene FACTORY I/O-inspired catalogue are *substantial separate engineering stages*, not acceptable claims for this bounded educational source.

Real low-cost/8 GB Windows PC performance measurements, actual physical PLC/hardware connectivity, owner visual/UX signoff and product safety, standards, licensing or production reviews also remain outside automated CI. **No industrial safety or full Factory I/O parity claims.**

## Exit decision

**P8 software engineering:** may be marked source-complete only when final-head Linux + Windows workflows both finish successfully, including all new P8 and legacy tests.  
**P8 owner/device acceptance:** deferred to real physical hardware and visual review; cannot be marked accepted based solely on hosted CI.  
**Release:** NO-GO and unmerged until expressly authorized. Preserve PR #48 and the verified P7 baseline.
