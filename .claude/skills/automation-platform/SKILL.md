---
name: automation-platform
description: >-
  Build and work on EFO Skill Lab — the browser-based virtual industrial-automation
  simulator (Packet-Tracer-style sandbox + TIA-Portal-style PLC programming +
  Factory-I/O-style 3D plant). Use when adding or changing components, the PLC
  program engine/editors (Ladder/FBD/ST), the wiring/netlist, the plant/device
  simulation, the tick orchestrator, diagnostics, project files, or exercises in
  this repo. Read before writing simulator code so the engine stays authoritative,
  deterministic, and integrated.
---

# EFO Skill Lab — developer skill

You are building an **open industrial-automation simulator**: a user drags PLCs, sensors,
motors, conveyors from a library onto a workspace, wires them to PLC I/O, programs the PLC
in Ladder/FBD/ST, presses **Run**, and a real scan engine drives a live plant they can
observe and troubleshoot. Read `docs/product/PRD.md` (what & why) and
`docs/product/ARCHITECTURE.md` (how) before non-trivial work. This skill is the day-to-day
operating guide.

## Golden rules (do not violate)

1. **The engine is authoritative; the renderer only draws the published snapshot.** No UI/visual element is ever a source of truth. Phase 10 of the tick publishes an immutable `RenderSnapshot`; the UI renders that.
2. **One tick order, one place.** The deterministic phase order lives only in `src/sim/orchestrator.ts` (PRD §7 / ARCHITECTURE §3): commands → electrical → PLC inputs → scan → outputs → actuators → plant physics → sensors → events → snapshot. Don't reimplement ordering elsewhere.
3. **Determinism.** Simulation code is pure and DOM-free. No wall-clock, no `Date.now`, no `Math.random` — use the seeded RNG in `WorldState`. A scenario + command log + seed must replay identically (it's a test gate).
4. **Run the user's real logic.** The PLC engine executes the user's compiled `ProgramIR` through a scan cycle. Never animate a canned result; never auto-correct a wrong program. Wrong logic/wiring → wrong behaviour, visibly.
5. **Build on the salvaged engine, don't rewrite it.** `src/core/plc.ts`, `src/engineering/*`, `src/engine/*` are the execution/electrical/plant foundation (and 536 passing tests protect them). Extend them behind the new module seams.
6. **Originality & honesty.** Original UI and component models; TIA Portal / Factory I/O / Packet Tracer are references, not sources — no proprietary assets/branding/claimed compatibility. Everything is an educational simulation, never safety-rated or certified; say so.
7. **Design the experience before expanding the engine.** Owner chose a UX/UI-first workbench increment after P1 and before P2/P3. Read `docs/product/UX_WORKBENCH_V1.md`; preserve the screen framework (project heading → Build/Wire/Program/Test navigation → device library + 3D floor + live inspector → engineering dock), validate responsive/accessibility and owner review separately from engine QA. Do not make speculative feature additions while evaluating the design.
8. **No backend in current versions.** Do not add authentication, Supabase, APIs, cloud storage, SaaS infrastructure, accounts, payments or server dependencies. Browser-local projects and existing local assessment codes are sufficient unless the owner explicitly changes scope.
8. **No doc churn.** The previous developer generated ~70 "increment report" files. Don't. Update the PRD/ARCHITECTURE/handover when direction changes; otherwise let code and tests speak.

## Current P0/P1 implementation (not yet accepted)

Revised owner-approved decisions: **interactive 3D-first from P1**, Ladder-first, and a start/stop contactor/motor vertical slice. Implemented files: `src/components/registry.ts`, `src/sim/{signals,orchestrator,worker}.ts`, `src/program/LadderEditor.tsx`, `src/app/SandboxPage.tsx`, and `tests/sandbox-integration.test.ts`. The P1 supported subset is one PLC, one supply, one Ladder rung, a bounded 24V ideal circuit, real original low-poly WebGL geometry but no advanced mechanical physics yet. It directly uses `engineering/ladder.ts` and `engineering/electrical.ts`; do not claim it already reaches commercial PLC/electrical fidelity. Keep current assessment routes working. Do not claim P0/P1 complete until full automated and browser evidence exists.

## P2 programming continuation — bounded, not complete

The owner authorized proceeding from the UX-first prototype into a P2 programming increment. Read `docs/product/P2_PROGRAMMING_PROGRESS.md`. One Web Worker executes either a saved LadderDocument or bounded compiled ST source; do not simulate ST in UI, invent timers driven by browser wall time, or duplicate scan ordering. Backwards-compatible `formatVersion:1` projects may omit language/source. Live tag values, timer/counter memory and the scan breakpoint originate in worker snapshots. Do not describe this as full IEC 61131-3 support, completed P2 or production acceptance; compiler, safety, device and cross-browser gates remain.

## Mental model (the layers)

- **Project / WorldState** — the document: components, wires, programs, tags, plant layout, faults, clock + seed. Runtime truth lives in a Web Worker.
- **Components** (`src/components/`) — library items with typed **terminals**, a pure **behavior()**, and a **visual()**. Registered in `components/registry.ts`.
- **Wiring / netlist** (`src/wiring/`) — resolves wires between terminals into propagated signals (wraps salvaged `engineering/electrical`, `terminal-wiring`, `dc-network`).
- **Program** (`src/program/`) — LD/FBD/ST editors compile to a shared `ProgramIR` executed by the engine (wraps `core/plc.ts`, `engineering/ladder*`, `structured-text`).
- **Plant** (`src/plant/`) — device kinematics + sensor geometry (wraps `engineering/workcell*`, `conveyor-process`, `pneumatic-cylinder`, `analog-tank`).
- **Orchestrator** (`src/sim/`) — the tick clock + the typed signal/event interface (`signals.ts`). Authoritative. Runs in `worker.ts`.
- **Render** (`src/render/Sandbox3D.tsx`) — real Three.js/React Three Fiber workbench from P1, with original 3D equipment/cables, a camera, terminal interactions, and low-resource settings. Draws snapshot values only. No-WebGL users retain a functional accessible wiring/controls panel.
- **Diagnostics** (`src/diagnostics/`) — multimeter, watch, trace, alarms from the snapshot/events (wraps `engineering/scan-debugger`).
- **Exercises/assessment** (`src/exercises/`, currently `src/app`+`src/platform`+`src/trades`) — guided + employer modes layered on a saved project (re-hosted onto the sandbox in P6).

## Recipes (the common tasks)

**Add a component (device):**
1. Create `src/components/defs/<kind>.ts` exporting a `ComponentDefinition`: `kind`, `category`, `label`, `terminals`, `defaults`, pure `behavior(ctx)` (read wired signals → write outputs/kinematics), `visual(ctx)` (→ `VisualState`).
2. Register it in `src/components/registry.ts`.
3. Add original 3D geometry in `src/render/Sandbox3D.tsx`; preserve accessible terminal/operating controls and avoid costly meshes on low-spec devices.
4. Add a behaviour test under `tests/`. No orchestrator change.

**Add a PLC instruction/block:** extend `src/program/ir.ts` and the interpreter (lean on `core/plc.ts`), wire it into the relevant editor(s), round-trip test it. Keep the supported set documented; unsupported → explicit error.

**Add a plant behaviour:** `src/plant/devices/<kind>.ts` — kinematics + sensor geometry, advanced in tick phase 7/8. Pure & seeded.

**Add a diagnostic:** read `RenderSnapshot` / `SimEvent[]` in `src/diagnostics/`. Never reach into WorldState from the UI.

**Add an exercise/assessment:** a saved project + objectives + rubric (reuse `src/platform` rubric/evidence/assignment code). In learning mode hints are on and edits free; in assessment mode the scenario + seed are frozen and evidence is recorded.

## The signal/event contract (summary)

- UI → orchestrator: `Command[]` (place, move, wire, setProp, loadProgram, run/pause/step, force, injectFault, operate).
- Orchestrator → UI: `RenderSnapshot` (components, wires, io map, measurements, alarms) + `SimEvent[]`.
- Full types in `src/sim/signals.ts` (ARCHITECTURE §4). Everything crosses the worker boundary by structured clone; keep payloads serializable.

## Verify before you commit

```bash
npx tsc --noEmit        # types
npm test                # Vitest — keep all engine tests green
npm run build           # tsc -b + vite + offline precache
npm run verify:full     # the deploy gate (Vercel & CI run this): offline checks + typecheck + tests + build
```
Also do a headless Playwright play-through of the affected vertical slice (build → wire → program → run → observe) with no console errors, as the repo already does per exercise. Commit in small, working increments; keep `main` deployable.

## Where to look
- Vision & scope: `docs/product/PRD.md`
- Build design, module boundaries, tick pipeline, signal types, salvage map: `docs/product/ARCHITECTURE.md`
- Current status & next steps: `docs/product/HANDOVER_CHECKLIST.md`
- The salvaged engine: `src/core/`, `src/engine/`, `src/engineering/` (+ `tests/`)
- The retained assessment product (becomes a mode): `src/app/`, `src/ui/`, `src/platform/`, `src/trades/`
