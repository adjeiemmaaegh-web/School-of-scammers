# Where R5 (electrical lab) and R7 (process physics) are already covered

The master roadmap's R5 and R7 describe behaviour that the P1–P25 factory work and the earlier slices largely implement. This page maps each roadmap bullet to the tests and browser scripts that show it, so the claim is checkable and the real gaps are visible. `tests/coverage-map.test.ts` fails if any file named here does not exist. It proves the evidence is present and passing, not that the models are physically accurate or independently reviewed.

## R5 Electrical panel, wiring and instruments

| Roadmap item | Evidence in the repo | Gap |
|---|---|---|
| R5.1 schematic-style wiring | Logical/Wiring canvas (`LogicalWiringCanvas`), accessible terminal list; `scripts/sandbox-p4-panel-browser.cjs` | Net labels, wire colours (done on the logical canvas, see STATUS) and routed wires are **not** built (needs a schema field for wire style) |
| R5.2 24 V devices, protection, reversing, E-stop | `tests/sandbox-p4-electrical.test.ts`, `tests/sandbox-p4-panel.test.ts`, `tests/sandbox-p4-reversing.test.ts`, `scripts/sandbox-p4-panel-browser.cjs`, `scripts/sandbox-p4-reversing-browser.cjs` | None known; idealised models |
| R5.3 panel templates, empty route kept | `tests/edit-plant.test.ts` (addPanel), Starters menu, `scripts/sandbox-p8-edit-plant-browser.cjs` | Hiding solutions in graded exercises is covered by `tests/lessons.test.ts` (starters hold parts only) |
| R5.4 digital vs analog channels, domain warnings | `tests/analog-plc.test.ts`, `tests/analog-p2-integration.test.ts`, `src/sim/analog.ts` (`analogWireError`), `scripts/sandbox-analog-browser.cjs` | Units/range shown only for plant analog channels |
| R5.5 instruments | Two-probe voltmeter; **continuity mode (R5.5, this work)** `tests/continuity-meter.test.ts`; scan trace CSV in `LiveMonitor` | No current clamp, oscilloscope or trend graph |
| R5.6 fault semantics, no hidden-fault leak | `tests/sandbox-p5-faults.test.ts`-family (`tests/sandbox-p5-sensor-faults.test.ts`), `tests/r8-hidden-fault-leaks.test.ts`, `scripts/sandbox-p5-faults-browser.cjs` | Reversed/shorted path fault kinds are not injectable (short is detected, not injected) |
| R5.7 three-phase labelled as a teaching model | `scripts/sandbox-p4-star-delta-browser.cjs`, `src/components/model-limits.ts` (`three-phase-supply`, `star-delta-drive`), `tests/model-limits.test.ts` | None |

## R7 Process physics and industrial behaviour

| Roadmap item | Evidence in the repo | Gap |
|---|---|---|
| R7.1 body conservation, collision, accumulation, jam, handoff, queue, reject, recovery | `tests/p3-world-physics.test.ts`, `tests/p8-fixed-solid-collisions.test.ts`, `tests/p8-swept-3d-contact.test.ts`, `tests/p21-accumulation-trip.test.ts`, `tests/p21-plc-queue-campaign.test.ts`, `tests/p22-real-zone-capacity.test.ts`, `tests/p23-real-belt-handoff.test.ts`, `tests/p18-conveyor-recovery.test.ts`, `tests/p20-obstruction-latch.test.ts` | Sorting by weight/height classification beyond the reference scenes is not generalised |
| R7.2 actuators: strokes, motors, pneumatics, turntable, gantry, robot | `tests/pneumatic-cylinder.test.ts`, `tests/relay-cylinder.test.ts`, `tests/cylinder-faults-stacklight.test.ts`, `tests/p8-continuous-turntable.test.ts`, `tests/p3-turntable-three-conveyor-integrated.test.ts`, `tests/p14-physical-material-process.test.ts`, `tests/p15-autonomous-robot-sort.test.ts` | No pressure/air-supply model; lifts/scissor lifts have only the P3 two-position model; robot is kinematic |
| R7.3 process models with units: tank, heater, mixer, valve | `tests/analog-tank.test.ts`, `tests/analog-plc.test.ts`, `tests/p9-plant-numeric-defaults.test.ts`, process equipment in `src/plant/equipment/process.ts` | PID is not a language instruction (only expressible in ST arithmetic); first-order approximations only |
| R7.4 timed events, seeded failure campaigns, scan-sampling rule | `tests/p16-fault-resilience.test.ts`, `tests/p17-seeded-material-campaign.test.ts`, `tests/p19-power-restart.test.ts`, `tests/p24-real-outfeed-hold.test.ts`, `tests/p25-real-outfeed-fault-retry.test.ts`, `tests/r3-golden-tick.test.ts` | None known |
| R7.5 benchmarks and soak | `tests/r7-soak-benchmark.test.ts` | Measured on CI-class hardware only; the physical 8 GB/no-GPU measurement is an owner gate |
| R7.6 model limits in the inspector | `src/components/model-limits.ts`, `tests/model-limits.test.ts` | Per-scene limit pages are not written |

## Honest summary

R5 and R7 are not "not started": most bullets are covered by earlier slices. The real, still-open gaps are: wire colours/net labels (schema change), current/trend instruments, a PID instruction, pressure/air supply, and generalised classification sorting. They are listed in `STATUS.md`.
