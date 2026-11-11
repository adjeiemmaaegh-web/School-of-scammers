# Visual Industrial Workcell Builder — P6 source development

**Date:** 2026-11-11
**Development branch:** `engineering/visual-workcell-builder-2026-11-11`
**Starting baseline:** PR #43 exact verified head `f52dbf948c322a1ab56145de489481a8b16324d3`
**Release status:** DRAFT / ENGINEERING ONLY / NO MERGE

## Goal

A learner must be able to create, inspect, position and program an original
industrial workcell from a blank browser workspace without editing JSON. 2D
and 3D views must describe the same authoritative worker project; rendering
must not manufacture physical events, PLC I/O or simulated success. The 2D
authoring view must work without a graphics processor or WebGL.

## Implemented in this increment

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
4. All existing P1–P5 browser CI tests, accessibility, responsive views and
   Firefox/WebKit smoke remain green on the exact branch head.
5. Windows Edge acceptance and real 8 GB device review are independently
   tracked. No browser CI result can claim physical PLC integration.

## Boundaries and non-goals

This is a practical educational simulation with a deterministic simplified
plant model. The floor plan is *not* an industrial CAD collision engine.
Overlap warnings do not prevent edits or assert that touching conveyors are
illegal. The drawn route segments are connection previews, not exact
terminal-layout cables or evidence that electrical power flows. Device
footprints are model-level dimensions rather than photorealistic assets.

FACTORY I/O material provided by the owner is a design benchmark; its scene
editor, camera collision, sensor effects and Siemens networking have not been
replicated or hardware-verified here. True orbit/fly/first-person navigation
with matching collision semantics remains a separate subsequent engineering
increment; this stage does not claim that pressing a camera button enables
physical-body detection.

Formal owner UI review, browser/platform acceptance and real low-spec hardware
testing remain open, and no cloud/backend, authentication, payments or
production deployment are in scope.
