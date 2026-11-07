# EFO Skill Lab — Architecture (v4)

> Companion to PRD v4. Describes **how the open simulator is built** on the salvaged engine. Supersedes the v3 architecture (git history preserves it). Read the PRD first, then this, then the `automation-platform` skill.

## UX-first handoff (owner-approved, 6 November 2026)

Before P2/P3 feature expansion, implement and review the user-facing structure defined in [UX_WORKBENCH_V1.md](UX_WORKBENCH_V1.md). `src/app/SandboxPage.tsx` owns navigation, project toolbar, palette search and dock placement; `src/ui/sandbox/WorkbenchInspector.tsx` reads the worker snapshot for selection/status and routes every input to the existing `Command` interface; `src/render/Sandbox3D.tsx` remains a scene renderer and emits selection and user interactions, not simulated authority. UX work must not change PLC scan, electrical solver, persisted project schema or backend scope. Keep the v3 exercise/assessment paths unchanged. Treat UX approval and actual technical acceptance as separate gates.

## P4 forward/reverse contactors — physically wired, worker-authoritative

The next P4 slice uses **the same** single Web Worker, discrete 24V terminal graph, Ladder/ST interpreter and scan clock. The new forward/reverse contactors have A1/A2 loads, 13/14 NO power feeds and 21/22 NC cross-interlock auxiliary switches, driven from *previous scan's* physically energized contactor states. PLC I0.4 is a real wired `ReverseRequest` input; user Ladder/ST BOOL `Forward` (Q0.4) and `Reverse` (Q0.5) drive separate high-side outputs. The idealized 24V reversing motor exposes F+/R+/M− terminals; the Worker sets motor direction only when exactly one of the two load paths is powered. Simultaneous energized coils invoke a **simplified mechanical interlock** that inhibits both contactors; simultaneous opposing motor terminals publish a wiring diagnostic and inhibit motion. A changing motor mesh simply projects `RenderSnapshot.motorDirection` and signed `reverseMotorAngleRad`. This is not a thermal/mains/three-phase simulation or safety certification. The original v1 project format remains unchanged.

The app router now lazy-loads the entire `/sandbox` route, preserving initial-page bundle budgets and on-demand offline asset delivery. See [P4_ELECTRICAL_PROGRESS.md](P4_ELECTRICAL_PROGRESS.md) and the full CI results before asserting acceptance.

## P4 electrical protection and virtual meter (source-development increment)

The P4 protected DOL and latching training E-stop slices extend the **existing** `solveDiscrete24V` ideal reachability engine, not a second electrical simulator. `breaker` (IN/OUT) and `overload` (95/96) and `estop` (A/B NC) are actual electrically closed/open `Device.kind:'switch'` elements in `src/sim/orchestrator.ts`; `lamp` is a genuine load. The PLC Q0.0 output still passes through user-wired overload 95/96 to contactor A1/A2, whose original 13/14 NO path drives the motor and 24V pilot. A direct supply short causes the Worker to compare the full circuit to a hypothetical circuit with only the breaker contact open; the breaker **latches trip only when opening it isolates the downstream short**, then the same scan uses the resulting circuit. An unfused upstream short remains a fault, never falsely attributed to the breaker. Manual protection commands operate through `WorkerRequest`; no renderer or React component invents electrical state.

`src/electrical/panel-meter.ts` computes differential volts from the actual 24V netlist solver and returns measured, floating, short or incomplete-probe status. `setMeterProbe` validates terminal identity, and a probe selection while paused recomputes the netlist **without advancing scan or plant physics**. `src/app/SandboxPage.tsx` exposes a 15-wire protected DOL starter and keyboard-accessible two-probe selects. `src/render/Sandbox3D.tsx` shows original breaker/overload toggles and live pilot, sourced only from immutable snapshots. Source details, exact wiring and open P4 gaps are in [P4_ELECTRICAL_PROGRESS.md](P4_ELECTRICAL_PROGRESS.md). This is **not** a thermal/current-rated breaker, E-stop or 3-phase motor circuit, and it is **not** production accepted.

## P3 tank and discrete fluid loop

The same 50 ms ten-phase worker also owns `src/plant/tank-process.ts`: a simplified 1000 ml reservoir, electrically energized 180 ml/s inlet pump, powered 750/600 ml hysteresis level probe, and electrically energized 260 ml/s outlet valve. `TankHigh` is a real wired PLC input at I0.3 and `Fill` / `Drain` control Q0.2/Q0.3 high-side outputs. The pump/probe/valve must be installed near the vessel as well as electrically connected; wrong placement or broken wires genuinely changes the process. Sensor state is updated after plant advancement and appears on the next scan through netlist sampling. `TankProcess` is worker-owned and `src/render/Sandbox3D.tsx` renders water height and actuators directly from immutable snapshot data. Both Ladder and bounded ST use existing execution engines. This educational model does not simulate real pipe resistance, hydraulic head, analog level sensors, industrial controls or safety certification. See [P3_PLANT_PROGRESS.md](P3_PLANT_PROGRESS.md).

## P3 plant and device integration

P3 extends the SAME ten-phase authoritative Web Worker, rather than introducing renderer physics. The registry adds a 24V conveyor load (L+/M-), a powered optical mark detector (L+/M/OUT) and a 24V diverter (A1/A2); PLC I0.2 maps to Photoeye and Q0.1 maps to Sort. `src/plant/sorting-conveyor.ts` advances one parcel deterministically only while the wired conveyor load is energized. Photoeye sensor geometry derives from saved component coordinates and is sampled into the PLC input image on the next scan; a diverter located downstream routes the package only when the actual wired actuator is energized. `src/render/Sandbox3D.tsx` uses worker snapshots for parcel and actuator meshes, never local animation physics. The program remains an editable bounded Ladder or ST document. The legacy project format and v3 assessment layer remain intact. See [P3_PLANT_PROGRESS.md](P3_PLANT_PROGRESS.md) for exact wiring, tests, limitations and open acceptance.

## P2 programming integration (engineering continuation)

The owner authorized proceeding from the UX prototype into P2 source development. The worker continues to be the only source of PLC/electrical truth. `src/program/p2-contract.ts` validates a bounded multi-rung Ladder document and compiles the salvage `structured-text.ts` subset; `src/sim/orchestrator.ts` executes exactly one active language per scan, with actual physical I/O sampled from the 24V netlist. `src/program/ProgrammingDock.tsx` switches between the editable multi-rung `LadderEditor` and `StructuredTextEditor`, while `LiveMonitor.tsx` displays published tags/memory, worker-owned scan and BOOL signal-edge breakpoints, and exports the last 300 deterministic scan summaries. `src/program/scan-trace.ts` owns the pure edge predicate, bounded history and CSV escaping; the UI never generates PLC measurements. The subsequent numeric increment extends the **same** `engineering/ladder.ts` scan with typed local INT/DINT/REAL registers, MOV, four arithmetic operators and six comparisons. `src/program/p2-contract.ts` verifies numeric operands/destinations cannot masquerade as Boolean contacts or coils; `src/program/NumericInstructionControls.tsx` edits only commands/documents, and the worker snapshots/scan trace publish bounded numeric results. Arithmetic faults pause the simulated worker and clear energized outputs. There is no physical analog device or extra simulation engine. The project remains `formatVersion:1` with optional `language`/`stSource` fields so pre-P2 files import unchanged. No GUI control is permitted to compute motor, timer or counter states outside the worker. See [P2_PROGRAMMING_PROGRESS.md](P2_PROGRAMMING_PROGRESS.md) for explicit omissions; do not present full P2 as accepted.

## Implementation scope and status (owner-approved, 6 November 2026)

P0/P1 is a **frontend-only** development increment. No backend, authentication, database server, cloud APIs, or hosted assessment state. The existing employer assessment routes remain functional and will be integrated into the open simulator in P6. Browser storage and local JSON import/export are permitted.

The first vertical slice intentionally runs the salvaged `engineering/ladder.ts` Ladder interpreter and `engineering/electrical.ts` bounded 24V solver rather than claiming full IEC 61131-3 or general electrical simulation. The actual bridge lives at `src/sim/orchestrator.ts`; `src/sim/worker.ts` owns tick scheduling and authoritative state; `src/components/registry.ts` holds the P1 device catalogue; `src/program/LadderEditor.tsx` edits the limited rung; `src/app/SandboxPage.tsx` hosts the UI, and `src/render/Sandbox3D.tsx` is the new Three.js/React Three Fiber renderer with 3D component geometry, cables, orbit camera, terminal selection and drop placement. Later modules should be extracted behind interfaces without reimplementing tick order.

The motor in P1 is an idealised **24V DC load**, not an industrial three-phase motor; the ordinary STOP switch is not a safety-rated E-stop. One PLC, one supply, an editable one-rung Ladder subset, and a fixed 50ms scan are intentional P1 constraints. Documentation/test results must distinguish built features from planned features.

## 1. The one picture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  UI SHELL (React + TS)                                                      │
│  Workspace canvas · component palette · properties · program editors       │
│  (LD / FBD / ST) · diagnostics panels · run controls · exercise/assessment │
└───────────────┬───────────────────────────────────────────┬──────────────┘
                │ commands (place, wire, edit, run, force,    │ render snapshot
                │ inject-fault, set-property)                 │ (read-only)
┌───────────────▼───────────────────────────────────────────▼──────────────┐
│  ORCHESTRATOR  (simulation clock — the §7 tick pipeline)                    │
│  owns the authoritative WorldState; runs in a Web Worker                    │
│  per tick: commands → electrical → PLC inputs → scan → outputs →           │
│            actuators → plant physics → sensors → events → snapshot         │
└───┬───────────────┬───────────────┬───────────────┬───────────────┬───────┘
    │               │               │               │               │
┌───▼────┐   ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
│electrical│  │  plc-engine │  │ plant-sim  │  │  faults    │  │ event-log  │
│ /netlist │  │ (scan IR)   │  │ (devices)  │  │ (modifiers)│  │ /diag      │
└───┬────┘   └──────┬──────┘  └─────┬──────┘  └────────────┘  └────────────┘
    │               │               │
    └── all built on the SALVAGED ENGINE (src/core, src/engineering) ──┘

   project-model (document) · component-library (definitions) · plc-program
   (editors + IR + compiler) · persistence (project files, IndexedDB)
```

## 2. Layers & modules (target source layout)

New code is organized by responsibility. Proposed tree (built incrementally; not all at once):

```
src/
  sim/                         ← the simulator core (new)
    world.ts                   WorldState type: components, wires, programs, tags, plant, faults, clock
    orchestrator.ts            the tick pipeline (§7 of PRD); authoritative; drives everything
    signals.ts                 the typed signal/event interface (the contract — §4 below)
    worker.ts                  runs the orchestrator off the main thread; message protocol
  components/                  ← component library (new)
    registry.ts                ComponentDefinition registry (like trades/registry for devices)
    defs/*.ts                  one file per device: terminals + behaviour + visual ref
  wiring/                      ← wiring/netlist (new, wraps salvaged electrical)
    netlist.ts                 resolve wires → propagated signals; validation
  program/                     ← PLC programming (new UI + IR, wraps salvaged execution)
    ir.ts                      the common Program IR the engine executes
    compile-ld.ts / compile-st.ts / compile-fbd.ts   editor model → IR (+ round-trip)
    editors/                   LD / FBD / ST React editors
  plant/                       ← device simulation (new, wraps salvaged workcell/process)
    devices/*.ts               kinematics + sensor geometry per device kind
  render/                      ← renderer (new): draws the published snapshot only
    Sandbox3D.tsx              primary P1 3D workbench (original low-poly, ports, cable meshes)
    future/                    P3 advanced factory machines and physics-informed 3D
  diagnostics/                 ← multimeter, watch, trace, alarms (new, wraps scan-debugger)
  project/                     ← persistence: project file schema, IndexedDB, import/export
  exercises/                   ← exercise & assessment framework (re-hosts v3 in P6)

  core/        (KEEP)          deterministic scan kernel
  engine/      (KEEP)          simulation/assessment primitives
  engineering/ (KEEP)          ladder, ST, electrical, workcell, faults, reference traces
  app/ ui/ trades/ platform/   (KEEP as the assessment layer; folded into exercises/ in P6)
```

## 3. The tick pipeline (authoritative, deterministic)

Implemented in `sim/orchestrator.ts`, run inside `sim/worker.ts`. Exactly the PRD §7 order:

```ts
function tick(world: WorldState, commands: Command[], dtMs: number): { next: WorldState; snapshot: RenderSnapshot; events: SimEvent[] } {
  let w = applyCommands(world, commands);        // 1
  w = solveElectrical(w);                         // 2  (wiring/netlist, on salvaged electrical)
  const inputs = samplePlcInputs(w);              // 3
  w = scanPrograms(w, inputs, dtMs);              // 4  (plc-engine, on salvaged core/plc.ts)
  const outputs = readPlcOutputs(w);              // 5
  w = applyOutputsToActuators(w, outputs);        // 6
  w = advancePlant(w, dtMs);                       // 7  (plant/devices, on salvaged workcell)
  w = sampleSensors(w);                            // 8  (geometry → sensor terminal states)
  const events = collectEvents(w);                // 9
  const snapshot = publishSnapshot(w);            // 10 (immutable; the ONLY thing render sees)
  return { next: w, snapshot, events };
}
```

Contracts:
- **Pure-ish & deterministic:** given the same `world`, `commands`, `dtMs` (and seed in `world`), output is identical. No wall-clock, no `Math.random` outside a seeded RNG, no DOM.
- **Fixed scan/clock timing:** the PLC scan interval and the sim `dtMs` are explicit; replay uses the recorded command log + seed.
- **Authoritative WorldState:** lives only in the worker; the UI holds the latest `RenderSnapshot` and sends `Command`s. Never two sources of truth.

## 4. The signal/event interface (`sim/signals.ts`) — the contract

The one vocabulary every module speaks. Illustrative (finalize in code):

```ts
export type SignalValue = boolean | number;          // DI/DO are bool; analog is number
export type TerminalId = string;                     // `${componentId}.${terminalName}`
export type Address = string;                        // PLC I/O/memory, e.g. "I0.0", "Q0.1", "M10.2"

export interface Command                              // UI → orchestrator
  = { k: 'place'; def: string; at: XY; id: string }
  | { k: 'move'; id: string; to: XY }
  | { k: 'wire'; from: TerminalId; to: TerminalId }
  | { k: 'unwire'; wireId: string }
  | { k: 'setProp'; id: string; key: string; value: unknown }
  | { k: 'loadProgram'; plcId: string; program: ProgramIR }
  | { k: 'run' | 'pause' | 'step' }
  | { k: 'force'; address: Address; value: SignalValue | null }
  | { k: 'injectFault'; fault: FaultSpec | null }
  | { k: 'operate'; id: string; action: string };    // e.g. press a button

export interface RenderSnapshot {                     // orchestrator → UI (read-only)
  tick: number; running: boolean;
  components: { id: string; kind: string; at: XY; rot: number; visual: VisualState }[];
  wires: { id: string; from: TerminalId; to: TerminalId; energized: boolean }[];
  io: Record<Address, SignalValue>;                   // for monitoring overlays
  measurements: Record<TerminalId, number>;           // for the multimeter
  alarms: Alarm[];
}

export interface SimEvent { tick: number; seq: number; kind: string; detail: string; data?: unknown; }
```

A **ComponentDefinition** ties it together:

```ts
export interface ComponentDefinition<P = Record<string, unknown>> {
  kind: string;                                   // 'motor', 'photoeye', 'plc', 'contactor', …
  category: 'plc' | 'sensor' | 'actuator' | 'control-gear' | 'conveyance' | 'process' | 'hmi';
  label: string;
  terminals: TerminalSpec[];                       // typed electrical terminals
  defaults: P;                                     // default properties
  /** advance this device's own state within a tick phase (pure). */
  behavior(ctx: DeviceContext<P>): void;           // reads wired signals, writes outputs/kinematics
  /** map internal state → what the renderer draws. */
  visual(ctx: DeviceContext<P>): VisualState;
}
```

Devices register in `components/registry.ts` exactly as trades register in `trades/registry.ts` today. **Adding a device = adding one definition file + registering it.** No orchestrator changes.

## 5. Program IR & the PLC engine

- Editors (LD/FBD/ST) are **authoring models**; each compiles to a shared **`ProgramIR`** (`program/ir.ts`) that the engine executes. The existing `src/core/plc.ts` `Program`/`scan()` and `src/engineering/ladder*.ts` / `structured-text.ts` are the starting point for the IR and its interpreter — extend them (more instructions, FBD mapping) rather than replacing.
- The engine is invoked only in tick phase 4. It is deterministic and DOM-free, so it runs unchanged in the worker.
- Compilation does round-trip and validation; unsupported constructs produce explicit errors. Never `eval` user input.

## 6. Data model & project file

- `WorldState` (runtime, in worker) vs **Project file** (persisted, portable). The project file is versioned JSON: `{ formatVersion, meta, components[], wires[], programs[], tags[], plantLayout, exercise? }`.
- Persisted via IndexedDB for local projects + import/export of the JSON (and the existing base64 share-code path for assignments). Schema-validated on load; versioned migrations.

## 7. Rendering

- **Renderer draws the `RenderSnapshot` and nothing else.** From P1, `render/Sandbox3D.tsx` is the primary Three.js/React Three Fiber scene, with lightweight original meshes, three-dimensional cables and terminals, OrbitControls, 3D palette drop projection and a selectable 3D floor for repositioning. The renderer emits only user commands; it never executes PLC logic or solves circuits. It has an accessible patch panel and a WebGL capability fallback; P3 adds real machine geometry and physical plant behaviours. Limit device count and pixel ratio on low-spec machines.

## 8. Concurrency, performance, determinism

- Orchestrator in a **Web Worker**; UI ↔ worker exchange `Command[]` and `RenderSnapshot`/`SimEvent[]` via structured-clone messages (tick-stamped, versioned).
- Target a steady tick (e.g. 30–60 Hz render, fixed PLC scan interval); decouple render rate from scan rate.
- Determinism is a test gate: a scenario + command log + seed must replay byte-identically (extend the existing replay tests).

## 9. Testing & verification

- Keep the **536 engine tests** green throughout. Add: orchestrator tick-ordering tests, netlist resolution tests, per-device behaviour tests, compile round-trip tests, and replay/determinism tests.
- `npm run verify:full` stays the deploy gate (typecheck + Vitest + build + the offline/integration checks). The integration-contracts checker already validates routing; extend its spirit to the new module boundaries where useful.
- Headless Playwright play-throughs for the vertical slice (build → wire → program → run → observe), as we already do per exercise.

## 10. Extension points (the common tasks, summarized; full steps in the skill)

- **Add a component** → new `components/defs/<kind>.ts` (terminals + behavior + visual) + register.
- **Add a PLC instruction/block** → extend `program/ir.ts` + the interpreter (lean on `src/core/plc.ts`) + the editor(s) + tests.
- **Add a plant behaviour** → `plant/devices/<kind>.ts` kinematics + sensor geometry.
- **Add a diagnostic** → `diagnostics/` reading the snapshot/events (no engine change).
- **Add an exercise/assessment** → a saved project + objectives + rubric in `exercises/` (P6; re-uses the v3 rubric/evidence/assignment code in `src/platform`).

## 11. Toward realism (GNS3-style, architected now, built later)

The orchestrator calls the PLC engine behind an interface (`scanPrograms`). A later **adapter** can route a program to an external **software-PLC runtime** or bridge I/O over **Modbus TCP** instead of the internal engine, without changing plant/wiring/UI. Hardware-in-the-loop is the far end of the same seam. The core never depends on these.

## 12. Standards, originality & safety

- Original UI, original component models, independent simulation architecture. TIA Portal / Factory I/O / Packet Tracer are references, not sources; no proprietary assets or branding; no claimed compatibility without verification.
- Supported standards (IEC 61131-3 subset, PLCopen XML, Modbus) are implemented to published specs and documented as a **subset**; unsupported parts fail explicitly.
- Safety behaviour is modelled and explained but never presented as certified. Record licence/provenance for any third-party code or asset.

## 13. Conventions

- Readable TypeScript (not the minified single-line style of the salvaged engine). Strict types. Pure, DOM-free simulation code. Deterministic (seeded RNG only).
- One responsibility per module; the orchestrator is the only place that knows the tick order; the renderer never holds truth.
- Keep docs few and high-signal (no per-task "increment report" churn). Honest framing everywhere.
