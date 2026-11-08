# Plant library — brief for the co-developer

**Goal.** Grow the simulator's plant from "a handful of device models and one tank" into a library of industrial equipment and ready-made scenes (conveyors with stoppers and pushers, lifts, palletizers, pick-and-place, turntables, a small warehouse, a robot arm, process equipment) that behave physically enough that a student's PLC logic has to deal with real timing, friction, jams and sensor geometry.

**Honest target.** We aim to *match the breadth* of what a student expects from a 3D plant simulator. We do **not** claim Factory I/O parity, physical accuracy, or safety rating anywhere in code, UI or docs. Every model is an educational simplification and says so in its header comment.

**Split of work.** You write the pure plant source (`src/plant/**` and the physics core). The integrator (the main session) owns everything that connects it: `src/sim/orchestrator.ts`, `src/components/registry.ts` and `electrical-defs.ts`, the `Command`/`RenderSnapshot` contract in `src/sim/signals.ts`, fault injection, project save/load, the 3D React components in `src/render/`, the inspector and cards, browser E2E and CI. If you need a change in one of those files, describe it in your PR and do not edit it.

Read first: `CLAUDE.md`, `docs/product/ARCHITECTURE.md`, `.claude/skills/automation-platform/SKILL.md`, and these working examples of the pattern you extend: `src/plant/cylinder.ts` (wraps `src/engineering/pneumatic-cylinder.ts`), `src/plant/sorting-conveyor.ts`, `src/plant/tank-process.ts`, and `src/components/electrical-defs.ts`.

## 1. Hard rules (a PR that breaks one is rejected)

1. **Pure and DOM-free.** No `window`, `document`, React, Three.js, timers, `Date.now`, `Math.random`, `fetch`, or async. Plant code runs inside the worker.
2. **Deterministic.** Same project + same command sequence ⇒ byte-identical snapshots. Randomness only through the seeded RNG already used by `faults.ts` (pass the seed in). Avoid transcendental functions (`sin`, `cos`, `pow` with fractions) in state that feeds back into the simulation; precompute tables or use rational approximations. Round state to a fixed quantum (1e-6) after each step, as `sorting-conveyor.ts` does, so replays match.
3. **Fixed step.** The integrator's scheduler calls each equipment `step()` exactly once per 10 ms substep (five substeps per 50 ms PLC scan). Equipment must not substep again or advance the shared clock; the world scheduler owns time and collision resolution. Never use variable-length integration.
4. **The engine is authoritative.** Sensors report what the *simulated geometry* says. The renderer only draws the published snapshot. No canned animations: a box moves because a belt drives it, a pusher pushes it, gravity drops it.
5. **Bounded.** Hard caps on bodies per scene (start with 60), on constraints, on events per scan. Over the cap: refuse the spawn with an event, never grow unbounded. Performance budget: a full scene step must cost under 2 ms on a mid laptop (benchmark test included).
6. **Original assets only.** No copied models, textures, names or layouts from any commercial product. Geometry is described as primitives (box, cylinder, extrusion) we render ourselves.
7. **Frontend-only.** No backend, no network, no accounts. 
8. **Honest naming.** No "realistic", "accurate", "certified", "safety" in labels or comments, except in a limitations list.
9. **Every equipment type ships with:** unit tests (behaviour, determinism replay, bounds), a mutation-style check you ran yourself (break the rule, see a test fail, restore), a header comment listing its simplifications, and a performance test.

## 2. The model: a plant world of bodies and equipment

Put the shared physics core in `src/plant/world/` and each equipment in `src/plant/equipment/<kind>.ts`.

Units: **millimetres, milliseconds, kilograms**. Axes: x along the floor width, y along depth, z up. Positions are numbers rounded to 1e-6 after each substep.

```ts
// src/plant/world/types.ts
export type Vec3 = { x: number; y: number; z: number };

/** A thing that moves through the plant: a box, a crate, a bottle, a pallet, a bag. */
export type Body = {
  id: string;                    // stable, assigned by the world: "b1", "b2"... (never random)
  shape: 'box' | 'cylinder';
  size: Vec3;                    // mm; cylinder uses x as diameter, z as height
  massKg: number;
  pos: Vec3;                     // centre of the body footprint at its base
  yawDeg: number;                // multiples of 90 are enough for v1
  vel: Vec3;                     // mm/s
  supportedBy: string | null;    // equipment id or body id carrying it, null = falling
  tags: Record<string, string | number | boolean>;   // e.g. { kind: 'marked', colour: 'red' }
};

export type World = {
  bodies: Body[];
  nextBodyId: number;
  timeMs: number;
  events: string[];              // drained by the integrator every scan
};
```

Physics tiers (build in this order; each tier is a separate, tested layer):

- **Tier 1, carry.** A body on a moving surface takes the surface velocity (friction-coupled: below a slip threshold it matches; above it, it slips and accelerates by `mu * g`). Covers belts, rollers, turntables, lifts.
- **Tier 2, contact.** Axis-aligned footprint collision between bodies and between bodies and equipment blocks. Bodies stop at stoppers and gates, are pushed by pushers/cylinders, queue behind each other (accumulation), jam when blocked, and fall off an edge (simple gravity, no bounce, or a fixed restitution). Resolve by moving the lighter/free body, never by iterative solvers.
- **Tier 3, stack.** A body can rest on another body (pallet loads, box on box). Stability by a centre-of-mass-over-support check, so a bad stack topples or is flagged `unstable` instead of being silently accepted.

A general rigid-body engine (including WASM ones such as Rapier) is **out of scope for v1**. If you think one is needed, write a one-page proposal with determinism evidence and gzip cost (lazy-loaded, budget 150 KB) and wait for approval.

## 3. The contract each equipment type must fulfil

```ts
// src/plant/world/equipment.ts
import type { ParamSpec } from '../../components/params';

export type Channel = {
  name: string;
  kind: 'bool' | 'number';
  unit?: string;                    // required on numeric channels: e.g. kg, mm, mm/s
  min?: number; max?: number;       // finite bounds required on numeric channels
};

/** The integrator supplies this for each placed instance; no device-specific globals. */
export type EquipmentContext = {
  id: string;                       // persistent component id
  originMm: Vec3;                   // floor x/y, vertical z; device anchor in millimetres
  yawDeg: 0 | 90 | 180 | 270;
  params: Readonly<Record<string, number>>; // validated, defaults already resolved
};

export type EquipmentDef<State> = {
  kind: string;                                   // registry key, e.g. stopper, lift, palletizer
  label: string;
  footprint: { x: number; y: number; z: number }; // local millimetres, relative to anchor
  commands: readonly Channel[];                   // bool and typed numeric control inputs
  signals: readonly Channel[];                    // bool and typed numeric sensor outputs
  params: readonly ParamSpec[];
  faults: readonly string[];
  fresh(ctx: EquipmentContext): State;
  /** ONE 10 ms substep; no nested stepping, no independent clock updates. */
  step(state: State, world: World, ctx: EquipmentContext, commands: Readonly<Record<string, boolean | number>>,
       dtMs: 10, fault: string | null): { state: State; world: World };
  read(state: State, world: World, ctx: EquipmentContext): Record<string, boolean | number>;
  /** 3D primitives expressed in world millimetres, no animations independent of state. */
  describe(state: State, ctx: EquipmentContext): Array<{
    part: string; shape: 'box' | 'cylinder'; pos: Vec3; size: Vec3; yawDeg: number; colour: string;
  }>
};
```

The integrator turns `commands` into terminals and loads (so a solenoid or motor on the 24 V circuit drives them), turns `signals` into limit switches and sensor terminals, registers the kind, and draws `describe()`. You never touch the electrical side: a command is just "is this input energised" by the time it reaches you.

Add one more export per equipment: `export const EQUIPMENT: EquipmentDef<...>` and register it in `src/plant/equipment/index.ts` (a plain array). That array is the only integration point.

## 4. Equipment catalogue, in delivery order

Deliver and merge in small phases; the integrator wires each phase before you start the next.

**Phase A — transport and handling (Tier 1 + 2)**
1. `belt-conveyor`: variable length (params), speed, run/reverse commands, accumulation, jam when the exit is blocked.
2. `roller-conveyor` (gravity/powered), `turntable`, `stopper` (extend/retract gate with limit signals), `pusher` (extend/retract with limit signals, force limit so heavy bodies stall → timeout).
3. `diverter-gate` (generalise the existing diverter), `box-feeder` (emitter: seeded sequence of box sizes/tags, rate param, cap).
4. Sensors as equipment: `photoeye` (beam across a gap, detects bodies by geometry, with a dead-zone and response time), `inductive-prox` (detects metal-tagged bodies at short range), `capacitive-prox` (any body), `light-curtain` (height classification), `weigh-cell` (number signal in kg with noise from the seeded RNG).

**Phase B — vertical and positioning**
5. `lift` (two-position and servo-positioned elevator, carries bodies on its platform), `scissor-lift`, `rotary-actuator`.
6. `pick-and-place` (2-axis gantry: x and z servo positions, gripper command, "part held" signal, drops the body if released).
7. `palletizer` (cartesian: picks from a conveyor end, places a configurable pattern on a pallet; layer count param; pattern completion signal).

**Phase C — storage and robots**
8. `shelf` and `asrs-crane` (a small automated warehouse: 3×5 bays, crane x/y/fork, bay-occupied signals).
9. `robot-arm` (2-link or 3-DOF with a simple analytic inverse kinematics, joint position commands, gripper, workspace limit and a collision stop). Keep it kinematic, not dynamic.

**Phase D — process** (after analog signals exist in the integrator)
10. `tank` (generalise the existing process: inflow/outflow valves, level number signal), `mixer`, `heater` (first-order thermal model), `proportional-valve`.

For every equipment list its own **fault set** and make each fault change the model's inputs or parameters (never set the symptom directly), as `src/sim/faults.ts` requires: for example stopper stuck, pusher weak, belt slipping, photoeye lens dirty (shorter range), prox drifting, lift end-switch dead, gripper loses part, valve stuck.

## 5. Scenes (ready-made starting plants)

A scene is data, not code: a list of `{ kind, x, y, yawDeg, params }`, plus the recommended wiring map, in `src/plant/scenes/<name>.ts`. Deliver after the equipment they need exists. Target ten, original layouts:

1. Sorting line (belt, two photoeyes, diverter, two chutes)
2. Gate and stopper accumulation line
3. Pusher-based reject station with weigh cell
4. Two-level lift transfer
5. Pick-and-place from feeder to belt
6. Palletizing cell (feeder → belt → palletizer → pallet exit)
7. Mini warehouse (inbound belt → AS/RS → outbound belt)
8. Robot sort-and-place
9. Mixing tank with heater and proportional valve
10. Bottling-style fill line (counter, stopper, filler, capper)

Each scene ships with a **reference controller** (an ST program using the tags from the scene's I/O list) and an automated test that runs it through the real `tick()` for N scans and asserts the outcome (for example "20 boxes palletised, none dropped"). The integrator adds a seeded fault set per scene for troubleshooting exercises.

## 6. Testing and acceptance, per equipment

- Behaviour tests for every command and signal; edge cases (empty, full, blocked, simultaneous commands, both limits, over-cap spawn).
- **Determinism replay:** build the scene twice, run an identical command script, `JSON.stringify` the world, expect equality.
- **Conservation checks:** bodies are never lost or duplicated; total count only changes through spawn/despawn events.
- **Bounds:** positions stay within the scene volume; no NaN or Infinity in any snapshot over a 10-minute scripted run.
- **Fault tests:** each fault produces its symptom through the model and is cleared by repair.
- **Performance test:** one scene step with the cap of bodies completes under 2 ms (measured median of 1000 steps; record the number in the PR).
- **Mutation check:** break one rule per behaviour, watch a test fail, restore byte-identical (use `cmp`). Note the mutants in the PR.
- Gate before every PR: `npx tsc --noEmit && npm test && npm run build && npm run verify:full`. Keep the existing 800+ tests green.

## 7. Process

- One branch and one PR per phase item, stacked small. PR description: what the equipment does, its simplifications and limits, its commands/signals/params/faults table, test evidence, and the exact integration the integrator must do (new registry entry, any new `Command`, 3D notes).
- Do not edit the integrator-owned files listed at the top. If a shared type must change, propose it in the PR and the integrator will apply it first.
- Do not add dependencies without approval. No per-task report files; put the limits in the equipment's header comment and one short section in `docs/product/P3_PLANT_PROGRESS.md`.
- Write the limits honestly: "educational simplification, not physical accuracy, not safety-rated."

## 8. What the integrator will do with each phase

Wire `EQUIPMENT` into the registry and palette; map commands/signals onto 24 V terminals and PLC I/O; add per-instance state, snapshot fields and project save/load; draw `describe()` in 3D; expose faults in the instructor panel; add placement validation and starter scenes; write browser E2E from an empty floor for each new piece; keep CI green and the entry bundle under budget (the plant library will be lazy-loaded with the 3D workbench).
