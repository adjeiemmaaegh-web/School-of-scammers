# Device contract — how a piece of equipment exists in the simulator

Roadmap R3.2. This page documents what is true on `main` today (verified against the code on 2026-11-17) and the rule for adding a device. It is not a redesign: the two device systems below coexist and are joined at one point; unifying them is deliberately deferred behind the golden tests in `tests/r3-golden-tick.test.ts`.

## One device, five facets

Every placeable thing is a **component kind** in `src/components/registry.ts` (`COMPONENTS[kind]`: label, help, terminals). A kind then has behaviour in up to two systems:

| Facet | Where | Used by |
|---|---|---|
| Identity and terminals | `components/registry.ts` (`Definition`, 54 kinds) | placement, wiring validation, inspector, palette |
| Electrical behaviour (24 V) | `components/electrical-defs.ts` (`DEFS[kind](component, ctx) -> Device[]`: loads and switches) **or** a hand-coded block in `sim/orchestrator.ts buildCircuit` for the original devices | `engineering/electrical.ts` solver |
| Plant behaviour (bodies, motion, sensing) | `plant/equipment/*.ts` (`EquipmentDef`: `commands`, `signals`, `params`, `faults`, `fresh`, `step`, `read`, `describe`), registered in `plant/equipment/index.ts` (26 defs) | `sim/p3-plant-bridge.ts`, stepped by `plant/world/runner.ts` in 10 ms substeps |
| Settings | `components/params.ts` (`ParamSpec`), stored sparsely in `ProjectFile.params`, validated by `setParam` and `validateProject` | inspector, `paramValue()` in electrical and plant code |
| Faults | `sim/faults.ts` (`COMPONENT_TARGETS`, `FAULT_KINDS`: append-only) and `plantFaults` for plant defs | solver/plant inputs only, never UI state |

Of the 54 kinds, 26 have a plant definition and 28 are electrical/legacy only (supplies, PLCs, buttons, contactors, motors, relay, timer relay, cylinder, stack light, breakers, three-phase, star-delta, lamp, and so on). The cylinder and timer relay are the bridge cases: electrical definitions plus per-id state in `WorldState` (`cylinders`, `timers`).

## The join point

Plant equipment is driven by 24 V loads solved by the circuit (`stepProjectPlant(..., circuit.energizedLoads, ...)`) and reports back as sensor signals (`sensorImage(world.plantWorld, id)` passed into the electrical context as `plantSignals`). A PLC therefore never sees plant state directly: it sees terminals, one scan later, exactly like hardware.

## Per-instance state rules (do not break)

1. State is keyed by component id (`deviceOn`, `motorAngles`, `lanes`, `vessels`, `tripped`, `cylinders`, `timers`, `plcs`, `plantWorld`). Never add a new singleton boolean for a device. Legacy single-device fields are mirrors of the first instance (`syncLegacy`) and exist only for old projects and tests.
2. Everything is deterministic: seeded RNG, fixed 50 ms scan, 10 ms plant substeps, no wall clock. A scan reads the previous settled state.
3. A device's visible status is derived from the snapshot (`sim/device-state.ts perDeviceLive`, card/inspector/3D text), never stored separately by the UI.
4. Removing a device removes its wires, faults, settings and PLC data (`sim/panels.ts removeComponent`).

## Adding a device (checklist)

- Registry entry with terminals (`registry.ts`); palette glyph and 3D sculpture (`SandboxPage.tsx`, `render/Sandbox3D.tsx`); card/inspector status text.
- Electrical-only: a `DEFS` entry. Moving/sensing: an `EquipmentDef` in `plant/equipment` plus the registry entry, with its commands mapped to terminals.
- Settings via `ParamSpec`; faults appended to `FAULT_KINDS` (never reordered: seeded picks depend on order).
- Tests: every behaviour, determinism replay, save/reload, removal, a deliberate-break check; extend the golden digests only if a scenario is added. A real-browser test built from an empty floor.

## Known debt (tracked in STATUS.md)

- Two systems for device behaviour (`electrical-defs` hand-coded blocks vs `plant/equipment`); adapters, not a rewrite, are the plan.
- `tick()` is now a ~190-line sequencer over four extracted phases in `src/sim/phases/` (`controller-scan`, `actuators`, `equipment-state`, `fail-closed`), pinned by the golden digests; `orchestrator.ts` fell from 1,289 to 1,071 lines. `buildCircuit` still special-cases the original devices and the first classic PLC, and the legacy single-device mirrors remain (R3.4 not done).
