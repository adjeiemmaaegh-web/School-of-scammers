# PLC Skills Lab — Simulation-First Product Requirements Document
Version 2.0 · 30 October 2026 · Status: engineering specification, not implementation acceptance

## 1. Product objective
Deliver a browser-based, high-fidelity virtual industrial automation laboratory that gives learners without costly PLC hardware, licensed IDEs, wiring benches or industrial machines meaningful access to the same *categories of engineering activity*: programming, wiring, commissioning, measurement, diagnosis, debugging, operation and verification. This is not a claim of electrical, safety, vendor or hardware equivalence. A separate team owns backend, authentication, database, organizations, hiring accounts and deployment services.

## 2. Users and jobs to be done
- Novice learner: learn safe isolation concepts, digital logic, basic circuits, PLC I/O and motor starting through guided exercises.
- Technician: trace wiring, measure simulated voltages, identify faults, replace or reconnect virtual components and verify machine operation.
- PLC programmer: write, edit, run and debug ladder logic and Structured Text; inspect tags, memory, scan timing and I/O.
- Instructor/assessor: author or select scenarios, inject faults, inspect event traces, run repeatable acceptance tests and export results for integration.
- Experienced engineer: experiment with sequences, interlocks, timers, counters, analog signals, HMI and multi-device interactions, subject to documented simulation limits.

## 3. Product principles
1. Every control changes actual modeled state; 3D only renders the engine's state.
2. A single deterministic simulation clock orchestrates electrical, PLC and machine subsystems with explicit phase ordering.
3. Safety behavior is modeled and explained, but the platform is never represented as a safety-rated controller or a substitute for live-work certification.
4. The learner can make mistakes, diagnose their consequences, and repeat experiments without arbitrary scoring.
5. Open, versioned scenario, project, program, event and assessment formats; no dependence on an account to run the local lab.
6. Browser-first, desktop-optimized; lower-fidelity graphics fallback and offline-capable local project storage are desirable.
7. High visual quality must coexist with stable simulation timing and clear instrumentation.

## 4. In-scope product areas
### 4.1 PLC programming studio
- Ladder editor with contacts (NO/NC), coils, branches, latches, comparisons, TON/TOF/TP, CTU/CTD and documented supported instruction set.
- Structured Text editor with syntax diagnostics and controlled execution; support subset documented against IEC 61131-3 semantics.
- Tag database with typed BOOL, integer, real, timer/counter structures; input/output/memory images and address binding.
- Run, pause, single-scan, breakpoints, watch tables, force table with visible force flags, rung power-flow overlay, execution diagnostics.
- Deterministic task scheduling, program compilation/validation and error reporting. Do not execute arbitrary user JavaScript.
- Program import/export via supported open formats, e.g. PLCopen XML, only after compatibility mapping and round-trip checks.

### 4.2 Electrical control laboratory
- Virtual 24V DC supply, fuses, terminals, switches, relays, contactors, overloads, lamps, sensors, motors and safe isolation procedures.
- Pin/terminal-level wiring editor with connection validity, voltage propagation, shorts, open circuits and overcurrent approximations.
- Virtual multimeter for voltage, continuity and resistance under stated idealizations; probe placement and circuit-dependent readings.
- Faults: loose terminal, broken wire, open fuse, failed relay contact, miswired sensor, stuck input, faulty actuator, overloaded motor.
- Clearly differentiate simplified electrical models from physical transient behavior; no hazardous real-world wiring instructions without safeguards.

### 4.3 Machine and physics simulation
- Reusable typed component contracts for conveyor, roller, motor, VFD abstraction, photoeye, inductive sensor, proximity switch, cylinder, solenoid valve, pneumatic supply, tank, pump, diverter, pusher, lift and indicators.
- Machine state, kinematics, collisions, sensors and material flow are driven by simulation time; physics engine is optional per scene and never defines PLC state.
- 3D scene editor: snap, place, connect, inspect, camera orbit/fly, select, annotate, isolate/hide, cross-section where useful.
- High-quality materials, shadows, physically plausible animation, industrial proportions, readable labels, camera presets and graphics tiers.
- Asset budgets, LOD, instancing, WebGL capability checks and fallback modes; maintain usable diagnostic UI when 3D is unavailable.

### 4.4 Commissioning and diagnostics
- Work order, drawings, I/O list, wiring schematic, operating sequence, cause/effect matrix and commissioning checklist.
- State-linked HMI, alarm list, trend chart, virtual meters, PLC diagnostics and event timeline.
- Cold start, power cycle, safe stop, fault reset, simulated isolation and recovery; tests for expected and unexpected transitions.
- Reproducible seeded fault variants, intermittent faults and fault injection; never silently alter assessment conditions.

### 4.5 Learning and assessment
- Learning mode: hints, guided explanations, reset and replay; assessment mode: frozen scenario version, controlled seed, withheld solution, audit trail.
- Event recorder captures program edits, wire edits, forces, probe readings, faults, safety-relevant actions, commissioning steps and acceptance checks.
- Assessment engine runs deterministic behavioral tests and rubric dimensions: correct logic, wiring, diagnosis, verification, safety and change discipline.
- Separate critical safety flags from score; explain evidence and limits; no claim of formal certification or guaranteed job readiness.
- Export versioned results via typed interfaces and signed/server-verified assessment integration later by separate backend team.

## 5. First vertical slice: conveyor will not start
User reads work order, inspects schematic and I/O, measures 24V control circuit, finds an open photoeye connection, reconnects it under simulated isolation, edits or verifies motor-control ladder logic, restores simulated power, runs conveyor and passes a sequence of acceptance checks. Scene includes conveyor, motor, guard/E-stop inputs, contactor, sensor, terminals, multimeter, PLC rack, I/O watch, fault log and animated parcels. Seeded variants may substitute stuck sensor, faulty contactor, logic error or open fuse; variants must have independent acceptance tests.

Acceptance evidence: wiring edits change measured signals; PLC scan maps inputs to outputs; outputs affect machine; sensor state follows object movement; safe stop dominates run; events record every material action; replay is deterministic for a fixed scenario/program/seed; 3D matches engine state.

## 6. Engineering architecture
Packages: `core-clock`, `plc-runtime`, `plc-language-ld`, `plc-language-st`, `electrical-netlist`, `device-models`, `plant-simulation`, `scene-renderer`, `project-format`, `fault-engine`, `assessment-engine`, `event-log`, `ui-studio`, `ui-lab`, `integration-contracts`.

Per deterministic tick: apply user commands -> solve electrical inputs -> sample PLC input image -> execute program scan -> publish output image -> apply outputs to actuators -> advance plant physics -> sample sensor geometry for next scan -> append ordered events -> publish immutable render snapshot. Define explicit initialization, safety override, timer behavior, numeric precision and replay contracts. Worker isolation for heavy engine tasks; message protocol carries tick, version, commands and state deltas.

Backend boundary: separate team consumes documented APIs/events, but this repository implements **no** authentication, database, server persistence, billing, employer account management or recruitment administration. Local import/export and IndexedDB for personal projects are frontend conveniences, not backend services.

## 7. Nonfunctional requirements
Strict TypeScript, clear errors, accessible keyboard navigation, configurable quality presets, no secrets, CSP-compatible execution, sandboxed program compilation, deterministic seed/replay, schema validation, versioned migrations, stable performance budgets measured on target browsers, and explicit license provenance for code and assets.

## 8. Out of scope
Backend/auth/RLS/organizations/employer dashboards and invitations; billing; actual hardware control; vendor IDE cloning; certification; photorealistic physics for every machine; claims of complete IEC 61131-3 or electrical standards conformance without verification.

## 9. Development and acceptance policy
Source-development stages proceed without waiting for physical hardware or pilot users. At each stage perform feasible static checks, type checking and unit tests if environment permits; record unexecuted checks. Formal cross-browser, hardware comparison, expert validation, usability and acceptance occur after the source-development program. Never label unverified features production-ready.

## 10. Success measures (to validate, not asserted)
A learner can build and debug a PLC program, wire a virtual circuit, measure a fault, commission a machine, and produce a replayable evidence report. Technical fidelity is measured against documented reference traces and expert-reviewed scenarios. Visual quality is measured on defined device classes; scores are assessed for repeatability and criterion-level explainability.
