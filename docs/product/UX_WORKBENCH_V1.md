# UX/UI blueprint — 3D automation workbench (design-first increment)

**Status:** review prototype, not owner-accepted or merged. **Depends on:** P0/P1 3D branch `feat/p0-p1-sandbox-foundation`. **Architecture:** frontend-only, no server, cloud, auth, database, employer accounts, or payments. **Date:** 6 November 2026.

## Product promise and boundaries

The primary product is an open, self-directed industrial automation workbench: the learner builds a circuit like Packet Tracer, authors and runs real educational PLC logic, and observes a connected 3D plant. The existing guided-exercise / employer-assessment product is retained unmodified; its later integration is P6. UX should feel credible to technicians without turning a learning task into a wizard. Never imply Factory I/O or Siemens hardware, programming or physics parity. This phase changes **information architecture and presentation**; the authoritative worker scan, Ladder interpreter, 24V circuit solver and persisted project schema are retained.

## Target users and top tasks

- **First-time student:** discover components → place six devices → connect pins → load and edit a latch rung → Run → press Start/Stop → diagnose a missed connection.
- **Experienced technician:** navigate rapidly between 3D workbench, editable logic and live diagnostics; compare the I/O state to the circuit; inspect individual device terminals.
- **Instructor/employer:** enter retained exercises/assessment mode without confusing it with a sandbox grading system. Assessment migration is not in this increment.
- **CPU-only/no-WebGL user:** use the same component library, terminal patch panel, controls and scan feedback. No impossible WebGL requirement for control learning.

## Navigation hierarchy and workspace anatomy

Global shell: product identity and two explicit destinations (Sandbox / Exercises & Assessment). Within **Sandbox**, the working surface uses five stable regions:

1. **Project heading and run bar:** a legible project title, locally saved status (only if actually written), Run/Pause, Step and Reset. Warn if simulation is running before editing. No misleading cloud or collaboration UI.
2. **Workflow navigator:** four *shortcuts*, not a forced wizard — **Build**, **Wire**, **Program**, **Test**. Each has real navigation to an active region; current shortcut is visually emphasized. Never claim the entire project is verified merely because a count has been reached.
3. **Device library (left):** search, original low-poly device categories, compact description; drag into 3D or click to add; disabled while Run is active. Preserves the exact component registry and command API.
4. **Live 3D scene (center) with contextual inspector (right):** orbit/pan/zoom and direct device selection; selection details include device status, terminals, press/release for buttons and Move-in-3D. With no selection, show a **guided checklist** based on actual project and scan data (advisory only). The separate patch panel remains fully keyboard/touch accessible.
5. **Engineering dock:** editable Ladder logic, real wiring list/voltage probes, live I/O and event trace; remains accessible, not a fake screenshot. Each command changes only worker-owned state.

## Interaction contracts

**Selection:** clicking a 3D equipment mesh selects that component in the inspector; selection must not change electrical/PLC values. Reset/clear/import remove stale selection. Device terminal selection remains independent: clicking terminal A then terminal B sends `wire`; cancel clears the pending endpoint. The inspector terminal buttons and patch panel route through the same handler.

**Placement:** palette drag uses a camera raycast to the floor. Palette click adds a real component at a default project coordinate. Move-in-3D selects a device, then the next floor click sends `move` to the existing worker. Never move a device purely in React without a worker command.

**Progress:** counts such as “6 devices / 11 wires” are **observations**, never a proof of correctness. Verification belongs to live PLC and circuit behavior, with errors shown in the diagnostic feed. A completed first circuit is proved only by the motor's response to correct and incorrect user-programmed logic.

**Run/Pause/Step:** the current toolbar is always discoverable; scan count comes from the worker. “Running” is explicit. Editing controls disable while running as the engine requires.

**Persistence:** localStorage and JSON import/export are retained. Do not claim cloud save, autosync or remote backup. Any local-storage failure should show a clear actionable export suggestion.

**Accessibility:** 3D is a richer view, not the only path. Search, palette buttons, device inspector, patch panel, program editor, toolbar and diagnostics must have accessible labels, keyboard navigation and reasonable contrast. Use text status in addition to colors; no motor state inferred only from glow.

## UX review states

- Blank project: understandable first action, “Place starter layout” (places equipment but does **not** secretly wire/program it).
- Placed equipment, no wires: clear terminal-selection guidance; Inspector shows selected device.
- Partial wiring: a visible pending terminal and Cancel Wire action; mistakes can be removed.
- Run state: primary control changes to Pause; instructions explain edits must wait.
- Correct latch: Start turns the motor on, releasing Start retains the latch, Stop turns it off.
- Incorrect logic / removed PLC output: motor remains or becomes off as dictated by electrical and PLC state; inspector and trace reflect truth.
- No-WebGL / narrow viewport / touch: real controls remain usable; scene fallback is honest.
- Local storage unavailable: export guidance, not a false “saved” confirmation.

## Design tokens and visual language

**Direction:** technical industrial desktop rather than a marketing landing page. Charcoal/steel workbench for 3D; warm readable off-white (light) or rich graphite (dark) supporting panels; amber for active interaction; turquoise/green for confirmed simulated live state; red for actual errors. Use the existing brand mark, typography and theme controls. Keep existing product palette tokens authoritative and scope new workbench tokens to `.sandbox-page` to avoid changing the retained assessment app.

Use restrained type sizes, consistent 8–12px spacing, compact but comfortably tappable controls, a camera/help legend, and strong foreground/background contrast. Reuse existing `panel`, `btn`, `eyebrow` and status-pill primitives where possible. The 3D scene must remain visually dominant even at 1280px width. At tablet/mobile widths, stack panels and allow scroll instead of hiding critical functions.

## Review / acceptance checkpoints

- [ ] Owner reviews the workbench's visual hierarchy, terminology, density and mobile layout.
- [ ] Build/Wire/Program/Test navigation reaches the intended functional region without losing state.
- [ ] Selection in 3D updates the inspector, and inspector actions use the real worker commands.
- [ ] Existing `/sandbox` browser E2E passes: place → wire → edit → Run → motor → incorrect logic/wire.
- [ ] Existing v3 exercise/assessment routes remain unchanged and pass their smoke tests.
- [ ] Vitest, typecheck, bundle budget, no-WebGL, accessibility, Chrome/Firefox/WebKit and Windows checks are recorded with exact scope.
- [ ] Physical low-spec/GPU/manual visual review tracked separately and not represented by headless CI.

## Engineering handoff

After owner approval of this UX increment, proceed to P2 PLC programming depth and P3 advanced 3D devices **inside the approved screen framework**. New features should map to the device library, program editor, inspector or diagnostics without a new top-level app. Do not replace the deterministic scan engine or reintroduce backend systems as part of future frontend development.
