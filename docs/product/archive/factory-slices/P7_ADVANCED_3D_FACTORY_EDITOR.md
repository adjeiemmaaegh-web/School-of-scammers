# P7 Advanced 3D Factory Editor — engineering evidence and acceptance

**Status:** original 3D scope on draft PR #45; 1,009/1,009 verified continuation on draft PR #46; follow-up software gap closure on draft PR #47 (exact-head verification required). P6 baseline is unmerged PR #44 at `c8b9aa5ab19e009ff161ae8e6e3d50ada217192f`. No merge or production deployment.  
**Date:** 2026-11-11.  
**Primary user correction:** FACTORY I/O is three-dimensional. PLC Skills Lab must be a **3D-first interactive factory**, with the 2D floor plan serving only as precision and low-spec fallback.

## Actual implemented source

1. **3D-native placement.** A viewport toolbar permits choosing any registered component, clicking the 3D floor or existing machinery, seeing an in-scene preview, and persisting a worker-accepted `place` command. The existing palette also supports HTML drag/drop onto the Three.js floor. Preview coordinates use the same 1080×580 saved layout, mm scaling, component dimensions and snap grid as the authoritative worker. No separate 2D physics.
2. **3D transforms.** Existing drag-from-model and scene-anchored label mechanisms remain. A selected equipment item exposes scene-anchored keyboard-accessible ← ↑ ↓ → and 90° controls, dispatching the existing worker-backed move/rotate edit and preserved undo history.
3. **Carrier/sensor authoring.** A selectable alignment option centers a P3 photoeye, prox sensor or light curtain on the nearest matching registered transport footprint. Turning alignment off preserves exact user placement. The worker is unchanged and the geometry is not claimed as an independent simulation or physical mounting constraint.
4. **Visual fidelity.** Original lightweight conveyor frames, distinct rollers or belt surfaces, rail edges, motor housing and a circular marked turntable replace generic rectangular illustrations. Mesh dimensions/rotation derive from P3 equipment descriptors. Rendering never creates parcels or drives the model.
5. **Sensor-zone honesty.** The existing P3 sensor algorithm sees objects in an axis-aligned square (within saved `rangeMm`) and bounded vertical height. The 3D overlay intentionally draws **that actual modeled detection volume**, not a decorative directional laser that would misrepresent its functionality. Visible color/selected tags use the worker's real signal readings and fault state. Realistic directional-beam sensing is a separate physics requirement.
6. **Commissioning evidence.** In-scene selected-equipment worker signal readouts, fault status, worker body locations/count and an explicit button opening the validated terminal-wiring board. A 3D experiment remains only as good as its genuine source simulation.

## Verification contract

- **Native unit tests:** `tests/p7-3d-authoring.test.ts` covers worker-space dimensions, no mutation, grid snap, nearest carrier alignment, optional user override and overlap diagnostics. Existing 3D camera and simulation suites must remain green.
- **Mandatory full UI E2E:** `scripts/sandbox-p7-3d-commissioning-browser.cjs` must start from blank stored project and place ten devices by clicks on a real perspective 3D WebGL canvas (no preset project or 2D floor). It then rotates/moves machines in the 3D scene, wires 23 real source/destination terminal pairs, types/activates Structured Text, runs the worker-driven conveyor/turntable circuit until a parcel travels north, and verifies actual signals and save/reload.
- **Existing P6 3D and 2D tests:** preserve the working 3D camera, yaw/drag/undo and WebGL-disabled commissioning path.
- **Full CI:** TypeScript, Vitest, production build, all legacy browser scenarios, accessibility, CPU fallback, Firefox, WebKit and native Windows/Edge checks. Exact branch-head evidence must be recorded; a prior build cannot verify later changes.

## Explicit exclusions and open gates

This is a **simplified educational simulation**, not a claim of equivalent FACTORY I/O functionality or real industrial safety. These are still open: directionally accurate photoelectric beams and configurable beam/mount angles; component-specific physical constraints and genuinely rejected invalid collisions; long-lived 3D groups/prefabs beyond existing saved copy/duplicate/group transforms; high-resolution imported factory CAD assets; accurate person-avatar physics, camera-body collision and camera-triggered sensors; physical Siemens PLC networking; low-spec real owner's hardware validation; and production/safety signoff.

The advisory carrier-overlap warning does **not** block placement because intentional handoffs require intersecting transport envelopes. A camera's simulated position never becomes an input signal, and the render layer never infers detection from a drawn volume.

**Release state:** NO-GO for full Factory I/O parity / real hardware / production. The draft may remain open when source development verification is green.


## P7 additional software-gap closure — draft PR #47 (11 November 2026)

This work builds **on the verified 3D commissioned workcell** in PR #46, without
changing the project into a 2D editor or starting backend/cloud services.

- **Sensor accuracy:** the actual P3 photoeye/inductive/capacitive worker model
  now accepts optional `beamMode=1` and `beamWidthMm`, using configured
  quarter-turn yaw for forward rectangular detection. The default
  `beamMode=0` preserves existing legacy area-sensor behavior. A shared
  pure zone descriptor drives both real worker sampling and the translucent
  3D detection-volume preview, including dirty-lens range reduction. This
  corrects a discovered pre-existing preview defect: the legacy P3 area
  detector uses a square with side length `rangeMm`, whereas the former 3D
  visualization depicted a square twice that width. This is still idealized
  body-centre detection, not accurate photoelectric hardware optics or
  raycast occlusion. Validation rejects invalid beam settings.
- **View ergonomics:** an explicit accessible `Fit scene` button computes
  bounds from the saved, yaw-aware 3D equipment footprint and reframes the
  Orbit camera. This changes the view only, never a sensor or worker state.
- **Narrow invalid-placement protection:** newly near-total superposed
  **same-kind, same-orientation material carriers** are now rejected by the
  worker for Place, Move and workspace-edit commands. Overlapping conveyor
  handoffs, sensor mounting, crossed machinery and historically saved
  layouts remain permitted. This is an intentionally bounded rule, not a
  generalized collision/contact engine or industrial safety guarantee.
- **Reusable local assemblies:** the simulator can save selected equipment,
  internal wires, device parameters and PLC programs as a browser-local
  reusable assembly and request insertion via the existing worker-validated
  paste command. Limits: 12 saved assemblies, 120 kB per fragment and
  450 kB total library JSON. The shelf survives a browser reload and supports
  deleting templates without altering placed equipment. This is an offline
  assembly shelf, not a complete linked hierarchical prefab editor or a
  centralized scene-library service.

**Additional automated gates:** `tests/p7-directional-sensors.test.ts`,
`tests/p7-camera-framing.test.ts`, `tests/p7-carrier-clearance.test.ts`
and `tests/p7-assembly-library.test.ts`, plus mandatory browser scripts
`scripts/sandbox-p7-clearance-browser.cjs` and
`scripts/sandbox-p7-assemblies-browser.cjs` in Linux CI. Exact branch-head
TypeScript, Vitest, WebGL browser commissioning, existing PLC regressions,
accessibility, CPU/no-WebGL fallback, Firefox, WebKit and Windows Edge must
all pass before this increment is considered verified.

### What software and real-world work still remains

The following are **not falsely marked complete** by these bounded P7
improvements: real-directional optics with obstacles/occlusion and calibrated
reflection; general 3D solids, continuous arbitrary-angle transforms,
machine-body collision accuracy, full prefab hierarchy and industrial CAD;
Factory I/O's broader 21-scene catalogue and individual scene fidelity;
true first-person avatar collision/jump/sensor-trigger semantics; industrial
PLC protocol drivers and verified Siemens connections; performance on the
owner's physical low-spec Windows hardware; full owner UI review; and
industrial-safety, licensing and release approval. Several of these are
substantial **future stages**, not quick P7 bug fixes.

**No production or full Factory I/O-equivalence signoff.**
