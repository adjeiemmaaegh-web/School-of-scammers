# PLC Skills Lab — P8 Industrial Simulation Realism

**Engineering continuation:** 2026-11-11. **Review:** draft PR #48, `engineering/p8-industrial-simulation-realism-2026-11-11`, stacked on verified P7 PR #47 (`adb7cd53a3ba8e85d576d4968874924b03822110`). Source work is **implemented, with exact-head CI acceptance to be recorded in the PR**. No merge, release, staging, server, account, database, cloud, payments or machine control is authorized.

## Architecture and nonnegotiable behaviors

The browser-based educational simulator remains offline-first. The genuine typed Web Worker owns the PLC scan, electrical circuit, material bodies, sensor output, equipment faults, simulation events and 3D physical model. Each 50 ms PLC scan advances five fixed 10 ms material steps. Three.js and First Person camera movement cannot independently forge PLC truth. History and assembly paste still use authoritative worker validation; legacy saved workspaces retain their existing behavior unless the user explicitly opts into new realism settings.

This is an **original bounded simulation, not certified hardware control or proven equivalence to Factory I/O, Solink, proprietary industrial CAD, or a general rigid-body engine**.

## Implemented P8 workstreams

| Capability | Authoritative behavior and user control | Deliberate limitation |
|---|---|---|
| Directional target volume | `beamMode=1`, `targetMode=1` check worker-owned 3D body bounds, sensor yaw and beam width/elevation; old body-centre model remains default | Idealized box/cylinder envelopes, not measured beam intensity |
| Optical occlusion | `occlusionMode=1` detects fixed opaque machinery, `2` includes moving parcels and `3` treats explicitly transparent glass as transmissive | Fixed registry envelopes, simplified one-segment line of sight; no glass refraction, calibrated reflectivity or ray-tracing |
| Sensor faults and material specificity | Simulation-clock intermittent failures, quarter-turn sensor misalignment and dirty-lens short-range effects; `materialMode=1` optionally excludes transparent targets from photoeyes, while inductive still classifies metal | Fault cadence and material taxonomy are classroom approximations |
| Machine obstacles | `blockMaterialFlow=1` enables yaw-aware 3D swept parcel contact and jam reporting for rack, vessel and eight further registered stationary machine envelopes | Installed opt-in bounding volumes only; not arbitrary mesh or articulated-arm collision |
| Parcel contact | `contactMode=1` on belt and roller opts into continuous 3D body-to-body broad-phase, including yaw/elevation; default queue model unchanged | Conservative rectangular/cylindrical envelopes, not momentum, friction or deformation |
| Powered conveyors | Fixed a real worker bridge defect that incorrectly injected a zero numeric speed on an electrically enabled belt with only a configured speed setting | No external analog I/O calibration claim |
| Continuous indexing | `rotateCargo=1` on the turntable rotates actual carried world-body position over PLC-driven time, records visual yaw and preserves orientation phase between cycles; angle telemetered from worker | Opt-in quarter-turn teaching kinematics, not arbitrary 6-DoF dynamics |
| First Person movement | WASD/Fly/Orbit and gravity-limited Space jump use original equipment height/footprints for view collision | Not a safety-rated collision/person simulator; no automatic camera-to-PLC input |
| Classroom operator detection | Explicit First Person toggle sends validated, bounded, ephemeral operator position into worker; sensors require `detectOperator=1` and can drive real PLC/ST/wired outputs. Leaving mode disables the actor | Intentional *virtual person proxy*, not camera/computer-vision tracking or real-human presence detection; never saved to projects |
| Reusable workcell composition | Offline assembly shelf preserves wiring, parameters and PLC programs; bounded rotation and two-to-four-cell composition flatten safely with unique IDs, nested snapshots and worker-validated placement | No linked parametric CAD/prefab updates, external files, or unsandboxed scripting |
| Original visual machinery | More distinctive rack decks/structure, vessel details, worker-indexed turntable cargo visualization and read-only worker sensor regions | Low-poly classroom art; not vendor geometry or production mesh contact |

## Test and acceptance matrix

### Source-level regression
- `tests/p8-optical-occlusion.test.ts`
- `tests/p8-moving-body-occlusion.test.ts`
- `tests/p8-optical-body-volume-faults.test.ts`
- `tests/p8-optical-materials.test.ts`
- `tests/p8-fixed-solid-collisions.test.ts`
- `tests/p8-swept-3d-contact.test.ts`
- `tests/p8-wired-belt-motion.test.ts`
- `tests/p8-worker-plc-integration.test.ts`
- `tests/p8-continuous-turntable.test.ts`
- `tests/p8-first-person-jump.test.ts`
- `tests/p8-training-operator-plc.test.ts`
- `tests/p8-assembly-transform.test.ts`
- `tests/p8-assembly-composition.test.ts`

### Mandatory real-browser CI
- `scripts/sandbox-p8-optical-browser.cjs` — worker/photoeye/PLC with physical fixed obstruction
- `scripts/sandbox-p8-jam-browser.cjs` — genuine belt jam and legacy free flow
- `scripts/sandbox-p8-assembly-rotation-browser.cjs` — saved cell rotated and worker-pasted
- `scripts/sandbox-p8-training-operator-browser.cjs` — explicitly enabled First Person virtual operator → worker sensor → PLC → disabled on exit
- `scripts/sandbox-p8-composed-assembly-browser.cjs` — independent cells/wires combined and accepted by worker
- Every earlier P1–P7 browser/Undo/Redo/commissioning exercise, Linux Firefox/WebKit smoke, no-WebGL fallback, TypeScript/Vitest/Vite/offline budgets and genuine hosted Windows Edge CI are regression gates.

**Software exit:** exact final commit must have both fully successful Linux and Windows hosted Actions workflows. One failing/aborted test is not software acceptance, even when all unit cases pass. Earlier sporadic P6/P7 mouse/assembly acceptance timeouts are tracked as reliability observations, not hidden.

## Deferred real-world and scope-specific acceptance

1. Owner-operated **physical low-spec Windows 11 / 8 GB RAM, integrated-GPU and no-GPU fallback** performance and browser sessions; actual input devices and PLC-connected equipment must be evaluated independently.
2. Wider general-purpose arbitrary-angle rigid-body solver, friction and calibrated optical reflection/refraction, dynamic 3D robot-link contact/kinematics, high-fidelity CAD/mesh imports, linked editable parametric prefab hierarchy, and full Factory I/O-inspired scene catalogue **are not implemented or certified in this engineering stage**; treat these as separate larger R&D/scene-library phases rather than falsely claiming P8 includes them.
3. Human safety, industrial integration, legal/licensing, owner UX and commercial deployment review remain **NO-GO**.

P8's eligible milestone is **educational source engineering and CI**, not certified industrial product acceptance. Keep PR #48 draft/open/unmerged and do not proceed with production deployment without owner authorization.
