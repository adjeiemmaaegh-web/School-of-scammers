# P7 Advanced 3D Factory Editor — engineering evidence and acceptance

**Status:** source development on draft PR #45; staged on verified PR #44 commit `c8b9aa5ab19e009ff161ae8e6e3d50ada217192f`. No merge or production deployment.  
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
