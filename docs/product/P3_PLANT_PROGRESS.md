# P3 — 3D plant and devices: conveyor sorting engineering increment

**Status:** P3 source-development vertical slice on `engineering/p3-3d-conveyor-sorting`, draft PR #17. **NOT full P3 exit, real-device acceptance, production readiness, or merge approval.** Dependent on draft P2 PR #16, UX PR #15 and P0/P1 PR #14. Frontend-only; no backend, cloud, accounts, auth or payments.

## Scope delivered

An open, genuine Three.js workbench where learners place a conveyor, mark-sensitive powered optical sensor and 24V solenoid diverter; manually wire their terminals; load or write actual Ladder/ST logic; run the real 50 ms deterministic PLC scan; inject marked/plain parcels; and observe the worker-calculated conveyor motion, sensor, switch state and accept/reject routing in original 3D geometry. The user can alter logic, move the sensor, miswire I/O or disconnect the load and the plant behaves accordingly, not according to an animation script.

**New components:** `conveyor` (L+, M- load), `photoeye` (L+, M, OUT high-side mark detector), `diverter` (A1/A2 actuator). Existing PLC has an additional **I0.2** digital input for `Photoeye` and **Q0.1** digital output for `Sort`. Original P1 PLC Q0.0 `Run`, contactor, motor, START/STOP and legacy programs remain operational. Only one PLC/supply/conveyor/photoeye/diverter station is supported in the P3 learning example; other more complex architectures are future scope.

**First sorting layout:** supply (25,25); PLC (315,25); contactor (555,25); conveyor (610,280); START (60,245); STOP (325,245); photoeye (690,380); diverter (750,170). The sensor and diverter positions are measured relative to the conveyor's center in project coordinates, with a meaningful alignment tolerance. Misaligning or reversing their order prevents an automatic reject. The 3D renderer maps saved project x/y to genuine three-axis mesh coordinates; no new incompatible project schema is introduced.

**Wiring:** supply P24 → PLC L+, START A, STOP A, contactor 13, photoeye L+. Supply M0 → PLC M, contactor A2, conveyor M-, photoeye M, diverter A2. START B → PLC I0.0; STOP B → PLC I0.1; PLC Q0.0 → contactor A1; contactor 14 → conveyor L+; photoeye OUT → PLC I0.2; PLC Q0.1 → diverter A1.

**Editable Ladder program:** rung 1 seals `Run` through `StopOK` and a branch (`Start` or `Run`); rung 2 gates `Sort` on `Run AND Photoeye`. With correct wiring, a *marked* package is detected as it approaches the diverter, which then rejects it; plain packages pass. The ST interpreter also supports optional `Sort : BOOL` output. Incorrect logic causes incorrect sorting. **The mark-sensitive photoeye is a bounded educational material discriminator** based on declared parcel class and sensor geometry; it is not a real vision algorithm, real optical physics or industrial safety sensor.

## Architecture / tick evidence

- `src/plant/sorting-conveyor.ts`: pure step/placement/feed functions with no browser API, wall clock or random input. One parcel at a time, constant bounded motion only while a *wired* conveyor load is energized. Station geometry, previous-scan sensor state, output latency, route decision and counters are deterministic. Parcel class/lane/position and counts are in worker-owned `SortingPlant` state.
- `src/sim/orchestrator.ts`: retains one authoritative ten-phase pipeline: apply commands → solve 24V graph using previous output/sensor state → sample physically wired PLC inputs including photoeye → run user Ladder/ST → publish Q0.0/Q0.1 → evaluate loads/actuator states → advance parcel and station sensors → post events → publish an immutable snapshot. No independent UI physics.
- `src/render/Sandbox3D.tsx`: Three.js original belt/rollers, moving carton with mark, optical head and solenoid arm. The parcel and mechanism are a **read-only projection** of the worker snapshot. No mandatory GPU model download.
- `src/app/SandboxPage.tsx`: frontend-only 3D sorting layout, mark/plain parcel feed, real IO lamps, route counters and terminal patch panel for keyboard/no-WebGL operation. The retained employer assessment mode remains unchanged.

## Automated verification and limitations

`tests/sandbox-p3-sorting.test.ts` checks marked → reject, plain → accept, deliberately wrong Ladder → wrong route, missing photoeye L+/M/OUT wiring, missing Q0.1 actuator wiring, sensor relocation, broken conveyor supply, reset/snapshot isolation, invalid placement and replay determinism. It also covers typed ST sorting and parcel-feed events. The browser flow `scripts/sandbox-p3-sorting-browser.cjs` builds the layout, manually wires 16 nets, loads editable Ladder, runs marked/plain parcels and edits logic to demonstrate a real changed routing result. These gates run with all prior P1/P2 tests. **Record the final CI run and any failures in PR #17; do not claim verification from source code alone.**

**P3 roadmap remains open:** more device classes (cylinder, valve, tank, pump, pusher, photoeye variants, VFD), true accumulation/throughput, collisions, friction, material flow of multiple parcels, richer kinematics and realistic physics, advanced commissioning and real physical device performance. The simplified low-poly 3D plant is a functional learning slice, not Factory I/O parity. Hardware/low-resource Windows/WebGL, cross-browser full 3D interaction, owner review and production approvals remain separate gates. P2 remaining typed physical I/O and advanced programming/diagnostics must continue to be tracked.

## Acceptance suggestion

Use the preview to build the sorting circuit from blank equipment, connect the 16 real terminals, edit the Ladder example, press Run and START, feed a marked parcel and a plain parcel, then deliberately remove the photoeye OUT wire or set Sort false; confirm actual route counts change. Stop/Reset must suspend movement. Verify on physical target Windows devices independently before accepting graphics/performance. Do not merge PR #14–17, deploy or activate monetization without separate explicit authorization.
