# PLC Skills Lab — Simulation-First Development Roadmap v2.0
30 October 2026 · Development-first; formal acceptance deferred

**Stages 0–11 are source development. Stage 12 is formal validation and pilot acceptance.** No stage is a backend implementation stage. Each stage produces source code, documentation, defined module interfaces and a checkpoint report. Feasible static checks are encouraged; missing hardware or live services do not block subsequent engineering.

| Stage | Theme | Source deliverables | Exit evidence (development, not production acceptance) |
|---|---|---|---|
| 0 | Research, architecture and upstream audit | PRD, competitor benchmark, engine ADR, license audit, contracts, repository structure | Written upstream decision, dependency inventory, baseline source tree |
| 1 | Deterministic PLC core | Clock, scan scheduler, typed I/O, memory, timers/counters, snapshots, replay | Reference scan traces, explicit supported semantics |
| 2 | PLC programming studio | Ladder editor, ST subset, compiler/validator, watches, forces, step/debug | Editable program executes and changes I/O predictably |
| 3 | Electrical lab | Netlist solver, terminals, wire editor, 24V control parts, multimeter | Open/short/voltage faults propagate to readings and PLC inputs |
| 4 | Device and plant framework | Sensors, motors, actuators, conveyors, material flow, device binding API | Reusable components with deterministic behavior |
| 5 | 3D industrial experience | Scene editor, glTF pipeline, industrial equipment, cameras, PBR, LOD | Multiple visual quality tiers and state-bound 3D |
| 6 | Commissioning workflow | I/O mapping, schematics, alarms, HMI, startup/stop, FAT checklists | End-to-end conveyor commissioning scenario |
| 7 | Troubleshooting and faults | Fault library, seeded variants, intermittent failures, diagnostic tools | Faults have reproducible causes and observable evidence |
| 8 | Scenario catalogue | Motor starter, conveyor sorting, tank filling, packaging, material handling | Versioned projects, objectives and acceptance tests |
| 9 | Assessment engine | Event evidence, rubric engine, replay, reports, learning vs assessment mode | Criterion-level explainable results; critical safety flags separate |
| 10 | Advanced industrial tools | Analog I/O, PID introduction, trends, HMI enhancements, supported interchange | Explicitly scoped advanced workflows, documented limitations |
| 11 | Integration and code hardening | Local projects, migration, frontend integration contracts, performance and accessibility work | Documented build and module APIs, known issues register |
| 12 | Formal validation and pilot | Browser, hardware comparison, expert review, user trials, security and accessibility audits | Evidence-based acceptance decision; no automatic release claim |

## Sequence and parallelism
Start with Stage 0 upstream decision, then build the simulation kernel before sophisticated 3D. Visual artists can develop equipment assets and design language in parallel with engine work. Electrical and PLC modules must agree on typed I/O contracts before integration. Backend team can build against Stage 0 integration contracts independently. Do not build a catalogue before a complete reference scenario works.

## Priority reference scenario
Conveyor motor will not start: learner reads work order, isolates simulated circuit, measures supply, diagnoses broken photoeye wire, repairs netlist, inspects ladder, resets fault, runs line and verifies stop/interlock behavior. All actions affect engine state and recorded evidence.

## Change control
Maintain ADRs, feature-to-acceptance traceability, versioned scenario files, upstream commit pinning, license notices and a status register: `planned`, `implemented-unverified`, `verified`, `blocked`. Development can progress with implemented-unverified items, but cannot assert hardware parity or production readiness.
