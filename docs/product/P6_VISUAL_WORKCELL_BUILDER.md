# 3D Industrial Workcell Builder — P6 source development

**Date:** 2026-11-11
**Development branch:** `engineering/visual-workcell-builder-2026-11-11`
**Starting baseline:** PR #43 exact verified head `f52dbf948c322a1ab56145de489481a8b16324d3`
**Release status:** DRAFT / ENGINEERING ONLY / NO MERGE

## Goal

FACTORY I/O is a **3D industrial scene editor and simulation environment**.
PLC Skills Lab must therefore be **3D-first**, not a 2D drawing program.
A learner should create, place, rotate, wire, program and commission an original
workcell using actual 3D models and the authoritative worker. 2D is an optional
precise/fallback viewport for low-spec machines, not the central experience.
Neither renderer can invent a PLC input or physical event.

## Implemented in this increment

- **Primary, actual 3D scene authoring:** the existing scene remains the
  default. Its P3 conveyors, turntable, sensors and mechanisms use the actual
  worker-backed 3D drawings rather than duplicate generic placeholder bodies.
  Users can click/drag these meshes directly; the visual drag ghost remains
  provisional until the authoritative worker accepts the saved `move` edit.
  Double-click on a model or floor changes the Orbit interest point.
- **Three real 3D camera controls:** Orbit, Fly and First Person appear inside
  the 3D viewport. Fly uses WASD and Q/E height, First Person is restricted to
  1.8 m eye height and WASD walking; right-drag turns the view. Both share
  bounded inspection navigation and simplified obstacle-footprint collision.
  Camera positions are display-only; First Person is *not* a PLC sensor input.
- **3D verification:** `tests/workcell-camera.test.ts` checks movement,
  bounds and collision models; the mandatory
  `scripts/sandbox-3d-workcell-browser.cjs` tests actual 3D
  camera navigation and direct 3D machine dragging, saved yaw and undo.
- **Third view — Floor Plan / 2D:** responsive vector factory floor, with
  exact mm-to-floor conversion for the registered P3 equipment and live
  body markers projected from the worker snapshot.
- **Direct graphical editing:** select a device, keyboard-select an obscured
  device, drag a placed device to change its saved coordinates, choose a device
  kind and click to place it, or drag from the existing equipment library.
  A photoeye can be mounted over a conveyor footprint intentionally.
- **Authoritative mutations:** the view sends the existing validated
  `place` / `move` worker commands. The editing toolbar continues to
  dispatch worker-validated group transforms, rotate, copy/paste and undo/redo.
  The local drag preview is never a PLC signal.
- **Geometric details:** nominal conveyor direction arrows follow saved yaw;
  physical footprints use the P3 equipment dimensions and saved settings;
  simple transport-overlap diagnostics are advisory (never evidence that
  the physics solver has rejected an edit).
- **Actual connections:** neutral wire-route overview uses the project's
  existing wire list. Terminal-level editing remains in the Logical/Wiring
  view, which uses the same worker and validates the terminal types.
- **Low-spec operation:** the 2D plan does not require WebGL or a 3D renderer.
  The Physical/3D view is mounted only when selected.
- **Keyboard/workspace:** Alt+3 opens the plan, alongside Alt+1 logical and
  Alt+2 physical. Existing accessible device list and editing tools remain.
- **Acceptance automation:** pure geometry/rotation/overlap tests, plus a
  mandatory browser test that starts from a blank project, places ten real
  workcell devices through the 2D surface, rotates and moves devices, wires
  23 actual terminals, types ST, runs worker-owned parcels, and reloads.

## Measurable acceptance gates

1. `npm run verify:full` — existing TypeScript, unit, build and offline
   integration verification remain green.
2. `tests/floor-plan.test.ts` — floor projection, user-dimensioned footprint,
   orientation, snap, boundary and advisory collisions.
3. `scripts/sandbox-floor-plan-browser.cjs` — physical operator UI only for
   building, wiring and programming; no prewired fixture. Runs with WebGL
   disabled and verifies a real worker body on the northbound route.
4. The genuine WebGL 3D workflow has its own mandatory browser gate and all
   existing P1–P5 browser CI, accessibility, Firefox and WebKit checks must
   remain green on the exact branch head.
5. Windows Edge acceptance and real 8 GB device review are independently
   tracked. No browser CI result can claim physical PLC integration.

## Boundaries and non-goals

This is a practical educational simulation with a deterministic simplified
plant model. The floor plan is *not* an industrial CAD collision engine.
Overlap warnings do not prevent edits or assert that touching conveyors are
illegal. The drawn route segments are connection previews, not exact
terminal-layout cables or evidence that electrical power flows. Device
footprints are model-level dimensions rather than photorealistic assets.

FACTORY I/O material provided by the owner is a design benchmark, not the
application's source. The three camera modes above are functional original
inspection controls, but they do **not** claim exact FACTORY I/O collision,
navigation, First Person sensor detection, full scene-editor feature parity or
hardware equivalence. Full camera-vs-part collision geometry, real sensor
response to a walking avatar, advanced placing/grouping gizmos and high-fidelity
model assets require further authoring/physics development. Siemens networking
and physical PLC integration remain unimplemented/unverified.

Formal owner UI review, browser/platform acceptance and real low-spec hardware
testing remain open, and no cloud/backend, authentication, payments or
production deployment are in scope.
