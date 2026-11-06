# EFO Skill Lab — Product Requirements Document (v4)

> **Product:** a comprehensive, browser-based **virtual industrial-automation laboratory** — the industrial-automation equivalent of Cisco Packet Tracer, with the programming depth of Siemens TIA Portal and the interactive 3D plant simulation of Factory I/O.
> **Version:** 4.1 · **Date:** 6 November 2026 · **Status:** Owner-approved direction; P0/P1 implementation in development branch. Supersedes PRD v3 (exercise/assessment), archived at `docs/product/archive/PRD_v3_exercise-assessment.md` and **retained** as the spec for the assessment layer.
> **Owner:** product owner. **Builders:** Claude + co-developers (read this, then `ARCHITECTURE.md`, then the `automation-platform` skill).

---

## 0. Why this document exists (the reset to a real simulator)

The product owner reviewed the v3 build against Cisco Packet Tracer and GNS3 and found the student experience fundamentally different: v3 is a **guided-exercise / assessment** tool (pick an exercise → fixed scene → scripted steps → graded result). That is genuinely useful for **employers assessing candidates**, and it is kept and will be developed further for that audience.

But it is **not a simulation environment** for students. Packet Tracer and GNS3 give a learner an *empty workspace* where they choose devices, wire them, configure/program them, press Run, and watch real behaviour emerge — including the consequences of their own mistakes. After working in **Siemens TIA Portal** and **Factory I/O**, the owner's target is clear:

> An open, build-it-yourself virtual automation lab: drag PLCs, sensors, motors, conveyors, pneumatics from a library into a workspace; wire them to PLC I/O; program the PLC in Ladder / FBD / Structured Text; press **Run**; and a genuine PLC scan engine drives a live 3D plant that the learner can observe, fault, and troubleshoot — all in one browser app, with no hardware, no licensed IDE, no accounts.

This PRD specifies that platform. The v3 exercise/assessment product becomes a **mode layered on top** of this sandbox (a saved scenario + objectives + rubric), not a separate app.

**Crucial engineering fact:** reusable bounded educational pieces — a deterministic PLC **scan engine**, Ladder and Structured Text interpreters, a simplified 24V electrical solver, fault models, and replay helpers — **already exist** in this repo's salvaged engine (`src/engine`, `src/core`, `src/engineering`). The problem was never the engine; it was the absence of the open, integrated, visual sandbox around it. This PRD builds that sandbox on the existing engine. See §11 for the salvage map.

---

## 1. Vision

**"Cisco Packet Tracer for industrial automation."** One browser application where students, technicians, engineers and automation professionals can **learn, design, program, simulate, test and troubleshoot** industrial control systems without physical PLCs, sensors, motors or factory equipment.

It unifies three proven experiences into one original product:
- **Packet Tracer / GNS3** → the practical, drag-wire-configure-run-troubleshoot learning loop on an open canvas.
- **Siemens TIA Portal** → the PLC programming depth (LD / FBD / ST, IEC 61131-3 elements, a real scan cycle, online monitoring).
- **Factory I/O** → the interactive 3D industrial plant that the program actually drives.

These are **functional references, not things to clone**: original interface, original component models, independent PLC-simulation architecture, legally clean implementations of supported standards/protocols. No proprietary assets, branding, or claimed compatibility without verification.

---

## 2. What "a simulation environment" means here (the bar)

The platform is a simulator, not an animation or a quiz, when **all** of these hold:

1. **Open authoring.** The learner starts from an empty (or template) workspace and *builds* the system from a component library — it is not a fixed, pre-wired scene.
2. **Real wiring.** Components are connected terminal-to-terminal (sensor → PLC input, PLC output → actuator; power, commons). Connections are validated; signals propagate through them.
3. **The learner's own program runs.** There is a PLC programming environment; the engine executes **the user's actual LD/FBD/ST logic** through a scan cycle — it does not play a canned animation.
4. **One integrated loop.** Sensor state in the plant → PLC input image → program scan → PLC output image → actuator in the plant → physics advances → sensors re-sample. Continuously. (See §7.)
5. **Mistakes have consequences.** Wrong logic or wrong wiring produces wrong behaviour, visibly — the sim never "auto-corrects."
6. **Observable & debuggable.** Live I/O, variable monitoring, scan tracing, virtual multimeter, alarms — the learner diagnoses as on real equipment.

v3 satisfies none of 1–3 for the student (each exercise is a bespoke state machine). v4 must satisfy all six.

---

## 3. Users & jobs-to-be-done

- **Student / trainee** — "Build and operate a complete virtual control system from scratch, and learn by experimenting and failing safely."
- **Technician** — "Wire control circuits, trace signals, measure, inject and find faults, verify operation."
- **PLC programmer / engineer** — "Write, run, debug and monitor LD/FBD/ST against a realistic scan cycle and I/O, driving a plant."
- **Instructor / vocational trainer** — "Author scenarios and faults, set exercises with measurable outcomes (allowing multiple valid solutions), observe and assess."
- **Employer / interviewer** — "Assess a candidate on a realistic task." *(Served by the assessment mode layered on the sandbox — the retained v3 experience, upgraded to run on the real simulator.)*

---

## 4. Product pillars

1. **The Workspace** — an open visual canvas: a component library, drag-and-drop placement, terminal-level wiring, properties, and Run/Pause/Step controls. The Packet-Tracer-style home base.
2. **The PLC Programming Environment** — LD, FBD and ST editors with IEC 61131-3 elements, a tag/variable table, compile/validate, and online monitoring. The TIA-Portal-style depth.
3. **The PLC Engine** — a deterministic scan-cycle runtime that executes the user's compiled program (read inputs → solve logic → timers/counters/memory → write outputs), with run/pause/single-scan/breakpoints.
4. **The Plant** — a 2.5D/3D industrial environment of original device models (conveyors, sensors, motors, contactors, cylinders, valves, tanks, pumps, diverters, robotic mechanisms) whose state is driven by the engine, never scripted.
5. **The Integration Loop** — the single simulation clock and signal/event bus that ties plant ⇄ wiring ⇄ PLC together every tick. **This is the core of the product.**
6. **Electrical & Wiring** — a control-panel/wiring layer (supplies, contactors, overloads, relays, push buttons, PLC terminals) with validated connections and propagated signals; DOL, forward/reverse, star-delta, interlocks, E-stop logic.
7. **Faults & Diagnostics** — injectable faults (disconnected sensor, miswire, failed motor, stuck contactor, broken mechanism, stuck input, logic error) plus diagnostic tools (live variable monitor, I/O indicators, execution trace, virtual multimeter, signal inspection, alarm history).
8. **Learning & Assessment** — structured, progressive exercises with clear problem/components/conditions/expected-results, measurable outcomes, and support for multiple valid solutions; plus the employer assessment mode. Built *on* the sandbox, not instead of it.
9. **Projects** — create/save/reopen projects locally; open versioned project files; no account or server required for the core.

---

## 5. Core concepts (the vocabulary the whole team shares)

- **Project / Workspace** — the document: a set of placed **Components**, their **Wiring**, one or more **PLC Programs**, the **Tag table**, plant layout, and (optional) exercise metadata. Serializable to a versioned JSON **project file**.
- **Component** — a library item instance (PLC, sensor, motor, contactor, button, conveyor, cylinder, valve, tank, …). Declares **terminals** (electrical) and a **device behaviour** (how it reacts to signals / advances physics) and a **visual** (2.5D/3D model).
- **Terminal / Wire** — components expose typed terminals (24V, 0V, DI, DO, signal). A **Wire** connects two terminals. The **netlist** resolves wires into propagated signal values each tick.
- **PLC Program** — user logic in LD/FBD/ST, compiled to a common **program IR** the engine executes. Bound to **Tags** mapped to PLC I/O addresses, which are in turn wired to component terminals.
- **Scan** — one PLC cycle: sample inputs → execute IR → update timers/counters/memory → commit outputs.
- **Tick** — one step of the global simulation clock, which orchestrates electrical solve, PLC scan, actuator application, plant physics, sensor sampling, event logging, and render snapshot (see §7).
- **Fault** — a modifier injected into a component/wire/program that changes behaviour deterministically (seeded).
- **Exercise / Assessment** — a saved project + objectives + rubric + (optional) seeded faults; "learning mode" shows hints and allows free edits, "assessment mode" freezes the scenario and records evidence.

---

## 6. In-scope feature areas (what v4 delivers, by depth)

### 6.1 Workspace & component library
- A searchable, categorized component palette (PLC & I/O, field devices/sensors, actuators/motors, electrical/control-gear, mechanical/conveyance, process, HMI/indicators).
- Drag-and-drop placement on a grid canvas; select/move/rotate/duplicate/delete; snap; pan/zoom; multi-select; undo/redo.
- Per-component **properties** panel (ratings, addresses, parameters, initial state).
- Clear separation of **simplified training models** vs **more realistic** behaviour, labelled.

### 6.2 Wiring editor
- Click-terminal-to-terminal wiring with type/compatibility validation (e.g. DI expects a switched 24V signal), visible errors (short, open, wrong polarity, unconnected common).
- Voltage/continuity propagation through the netlist; overcurrent/short approximations where modelled.
- Maps component terminals ↔ PLC I/O addresses ↔ program tags.

### 6.3 PLC programming environment (TIA-Portal-like, original UI)
- **Ladder Diagram (LD):** NO/NC contacts, coils (incl. set/reset/latch), branches, timers (TON/TOF/TP), counters (CTU/CTD), comparators, math, move, and documented supported instructions; rung power-flow overlay.
- **Function Block Diagram (FBD):** blocks and connections for the same semantic set; reusable function blocks.
- **Structured Text (ST):** a bounded IEC 61131-3 subset (BOOL/INT/DINT/REAL/LREAL, IF/CASE/FOR/WHILE, functions, persistent memory) with syntax diagnostics; unsupported constructs fail explicitly.
- **Tag table / variable editor:** typed tags, I/O addressing, memory, timers/counters structures; add tags without editing JSON.
- Compile/validate with clear errors; **online monitoring** (live values overlaid on the program); run/pause/single-scan/breakpoints/watch/force (with visible force flags); forcing respects safety rules.
- Open interchange where feasible (e.g. PLCopen XML for the LD/ST subset) with round-trip checks. Never execute arbitrary user JavaScript; sandbox program execution.

### 6.4 PLC execution engine
- A genuine deterministic scan cycle executing the compiled IR: read input image → execute instructions in defined order → update timers/counters/memory → write output image. Deterministic task scheduling, numeric precision, and replay contracts.
- Run / pause / single-scan / step; breakpoints on scan, rung/block, timer/counter, I/O change; execution trace export.
- Runs in a **Web Worker** so heavy execution never blocks the UI; message protocol carries tick, version, commands, and state deltas.

### 6.5 Plant simulation (Factory-I/O-like, original models)
- Reusable typed device models: conveyor, roller, motor/VFD abstraction, photoeye, inductive/proximity sensor, cylinder, solenoid valve, pneumatic supply, tank, pump, diverter, pusher, lift, robotic mechanism, indicators.
- Device state, kinematics, simple collisions, material flow, and sensor geometry driven by the simulation clock. Physics is per-scene and **never** defines PLC state except through explicitly modelled sensors.
- 2.5D first (clean isometric/plan canvas, performant, approachable), with targeted real 3D (Three.js/Babylon.js) where it adds value; graphics tiers, LOD, WebGL capability check and a usable no-WebGL fallback.

### 6.6 The integration loop — see §7. (The product's heart.)

### 6.7 Electrical control panel & wiring
- Supplies, fuses, terminals, switches, relays, contactors, overloads, lamps, sensors, motors; DOL, forward/reverse, star-delta, interlocking, E-stop. Teach safety behaviour and its limits; never present as certified safety engineering.

### 6.8 Faults & diagnostics
- Instructor/learner fault injection (seeded, reproducible): disconnected/stuck sensor, miswire, failed motor, stuck contactor, broken mechanism, open fuse, unexpected input, logic error.
- Diagnostic toolset: live variable monitor, I/O status, execution trace, virtual multimeter, signal inspection, alarm/event history. (The automation analogue of ping/traceroute/packet-inspect.)

### 6.9 Learning, exercises & assessment
- Progressive catalogue: start-stop motor → traffic lights → conveyor automation → tank level → sequential machines → full production line. Each: clear problem, required components, operating conditions, expected results; measurable outcome checks; **multiple valid solutions** allowed for advanced tasks.
- Two modes over one scenario: **learning** (hints, free edits, replay) and **assessment** (frozen scenario + seed, evidence trail, rubric) — the retained v3 experience, re-hosted on the real simulator.

### 6.10 Projects & persistence
- Create/save/reopen projects locally (IndexedDB + import/export of versioned project files). No account/server for the core. Schema validation and versioned migrations.

### 6.11 Extensibility toward realism (GNS3-inspired, later)
- Architect so the internal PLC simulator can later interoperate with external **software PLC runtimes** and industrial protocols (e.g. **Modbus TCP**), and eventually compatible hardware-in-the-loop — without the core ever depending on them.

---

## 7. The integration contract (the heart — read twice)

A single **simulation clock** advances the system in deterministic, explicitly ordered phases each tick:

```
1. apply user commands            (button press, force, fault toggle, edit)
2. solve electrical / netlist     (propagate supplies & switched signals through wiring)
3. sample PLC input image         (from wired input terminals)
4. execute PLC program scan       (user's compiled IR → outputs, timers, counters, memory)
5. publish PLC output image
6. apply outputs to actuators     (motors, valves, diverters, …)
7. advance plant physics          (kinematics, material flow, collisions)
8. sample sensor geometry         (positions → sensor terminal states for next tick)
9. append ordered events          (for trace, alarms, evidence, replay)
10. publish immutable render snapshot   (3D/2.5D renders THIS, never its own truth)
```

Rules that are non-negotiable:
- **The engine is authoritative; the renderer only draws the published snapshot.** No visual element may be a source of truth.
- **Deterministic & replayable:** a fixed scenario + program + seed + command log reproduces identically.
- **One typed signal/event interface** connects plant ⇄ wiring ⇄ PLC so a change in one module is reflected everywhere. (Defined concretely in `ARCHITECTURE.md`.)
- **Safety dominates:** modelled E-stop/guard logic overrides run; forcing cannot override safety inputs.

---

## 8. Non-goals / honest limits (initial release)

- Not a safety-rated controller; not certified instruction; not a substitute for live-work training. Always stated.
- **No backend for this version.** No authentication, cloud database, server, SaaS infrastructure, employer accounts, or remote assessment storage. Sandbox projects are stored in the browser and import/export as local files; the existing employer assignment code flow remains local-only. Backend additions require a separate explicit scope decision.
- Not a clone of TIA Portal / Factory I/O / Packet Tracer UI or assets; no claimed vendor compatibility without verification.
- No full IEC 61131-3 coverage at first — a **documented supported subset**; unsupported constructs fail explicitly, never silently.
- No photoreal physics for every machine; fidelity is "faithful category of behaviour," tiered and labelled.
- External PLC runtimes / Modbus / hardware-in-the-loop are **architected-for, not in, v1**.

---

## 9. Phased roadmap (this is a large, multi-phase build)

Each phase ends with something runnable end-to-end. The **vertical slice first** principle (one complete sandbox scenario working through the whole loop) beats building modules in isolation.

| Phase | Theme | Exit (runnable) |
|---|---|---|
| **P0 — Foundations & contracts** | Project model, signal/event interface, tick orchestrator skeleton, component & program IR contracts, engine-salvage audit, worker harness | Contracts documented; an empty workspace loads; the orchestrator ticks a trivial component wired to the salvaged scan engine |
| **P1 — First vertical slice** | Workspace canvas + a handful of components (PLC, start/stop, contactor, motor) + terminal wiring + LD editor + scan engine + 2.5D render, all through the §7 loop | A user places a start/stop motor circuit, wires it, writes the latch rung, presses Run, and the motor responds to their logic; wrong logic → wrong behaviour |
| **P2 — Programming depth** | Full LD instruction set, ST editor + engine, tag table, online monitoring, run/pause/step/breakpoints/watch/force | A learner programs timers/counters/comparators and monitors live values |
| **P3 — Plant & devices** | Device library breadth (conveyor, photoeye, cylinder, valve, tank, pump, diverter…), kinematics, sensor geometry, material flow; targeted 3D | The classic conveyor-sorting scene runs from the user's program |
| **P4 — Electrical & panel** | Control-panel wiring depth, multimeter, DOL/forward-reverse/star-delta/interlock/E-stop, overcurrent/short approximations | Wiring faults propagate to measurements and PLC inputs |
| **P5 — Faults & diagnostics** | Seeded fault injection + full diagnostic toolset + alarm/event history + execution trace export | Instructor injects a fault; learner diagnoses with the tools and restores operation |
| **P6 — Learning & assessment on the sandbox** | Exercise framework (problem/components/conditions/expected-results, multi-solution outcome checks) + re-host the v3 assessment mode on the real simulator | Progressive catalogue; employer assessment runs on real scenarios |
| **P7+ — Realism & scale** | FBD editor, PLCopen interchange, external runtime / Modbus TCP groundwork, collaboration, HIL | Advanced/opt-in capabilities |

---

## 10. Success measures

Measured by **how accurately and consistently the integrated system behaves**, not by graphics alone:
- A learner can build, wire, program, run and troubleshoot a complete control scenario from an empty workspace, unaided.
- The simulated plant demonstrably follows the user's own program (including their mistakes), reproducibly.
- Fidelity holds against documented reference traces for the supported subset; determinism/replay verified.
- A migrating Packet Tracer / GNS3 user recognizes the *workflow* (build → wire → configure → run → troubleshoot) immediately.

---

## 11. Relationship to the existing codebase (salvage map)

**Keep & build on (the engine layer):**
- `src/core/plc.ts` — deterministic scan kernel (contacts, coils, TON, CTU) → the seed of the **PLC engine**.
- `src/engineering/ladder*.ts`, `structured-text.ts`, `scan-debugger.ts`, `ladder-truth-table.ts`, `mcdc-*` → **program compilation/validation, execution, debugging**.
- `src/engineering/electrical.ts`, `dc-network.ts`, `terminal-wiring.ts`, `wiring-board.ts`, `io-mapping.ts`, `contact-coverage.ts` → **electrical/netlist** layer.
- `src/engineering/workcell*.ts`, `conveyor-process.ts`, `pneumatic-cylinder.ts`, `analog-tank.ts`, `fault-matrix.ts`, `safety-invariants.ts`, `plc-reference-trace.ts` → **plant devices, faults, reference traces**.
- The full `tests/` suite (536 tests) — keep green; it protects the engine during the rebuild.

**Keep as a layer, re-host later (the assessment product):**
- The v3 shell (`src/app`, `src/ui`, `src/trades`, `src/platform`) and its PLC/CCTV exercise ladders — the **guided-exercise / employer-assessment mode**. It stays live and is upgraded in **P6** to run on the real sandbox instead of bespoke per-exercise state machines.

**Rebuild (the new core):** the Workspace canvas, component library, wiring editor, PLC programming UIs, the tick orchestrator + signal/event bus, and the plant renderer — i.e. everything in §4 pillars 1–7 that turns the engine into an open simulator.

> Net: we are not starting over. We are building the open sandbox the engine always deserved, and folding the current app into it as the assessment mode.

---

## 12. Owner-approved decisions for P0/P1

1. **Approved: 2.5D first.** Build the open wiring/plant workspace in 2.5D for P0/P1; add targeted 3D in P3, not at the expense of control fidelity.
2. **3D engine in P3:** keep the existing Three.js dependency as the default unless an explicit requirement justifies changing it.
3. **Approved: Ladder first.** P1 starts with an editable single-rung LD subset; expand LD/ST in P2 and introduce FBD in P7+.
4. **Approved: start/stop latch.** First real circuit: user-placed 24V source, PLC, START/STOP, contactor, motor; user-wired terminals; editable seal-in rung; correctly and incorrectly behaving outputs, tested across the full scan loop.
5. **UI implementation decision:** one browser application with an open Sandbox entry and retained Exercises/Assessment routes. The v3 assessment capability is not removed; deeper integration occurs at P6.

---

## 13. Assets

Original component artwork is code-drawn SVG for 2.5D (a device-art library already exists at `src/ui/device-art.tsx`) and original glTF/low-poly models for 3D (to be produced). No proprietary vendor models, icons, or branding. Reference *photos* (for accuracy only, not shipping) of a PLC rack, wired 24V panel, conveyor sorter, and a control cabinet are welcome from the owner. Where any third-party asset or standard is used, provenance and licence are recorded (continue the repo's provenance discipline).

---

*This PRD is the current product direction. It reframes the platform as an open simulator with the exercise/assessment product as a mode on top. Changes go through the owner. Companion docs: `ARCHITECTURE.md` (how it's built) and the `automation-platform` skill (how to work in the repo).*
