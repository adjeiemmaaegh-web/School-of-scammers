# Stage 2 / R3.2 — Canonical device lifecycle and simulation integration

**Authority:** Existing production source on the Stage 2 development branch. This document describes supported interfaces; it does not assert industrial equivalence, physical safety or completed Stage 2 development.

## One identity and one authoritative scan

A placed device has a unique project component `id` and a `kind` from `src/components/registry.ts`. Its terminals are addressed `<id>.<terminal>`. Validated project files preserve `formatVersion: 1`. The only PLC/plant state transition is `src/sim/orchestrator.ts:tick()`, which runs in the Web Worker using 50 ms PLC scans and five 10 ms plant substeps. Scene renderers and the inspector consume snapshots; they never generate a replacement sensor/actuator outcome.

The read-only `src/sim/device-contract.ts:deviceIntegrationContract(kind)` joins definitions **without** becoming a second component registry. A device model must retain the following sources of truth:

| Concern | Canonical source | Contract |
| --- | --- | --- |
| Identity, label and terminal roles | `src/components/registry.ts` | Unique per-instance ID; supported supply/return, 24 V input/output/load, numeric input/output and three-phase domains |
| Electrical model | `src/components/electrical-defs.ts` and existing `orchestrator.ts:buildCircuit()` legacy adapters | Terminal-level solved 24 V behavior, explicit faults; **never** derive output power from animation |
| PLC program and I/O ownership | `src/sim/plcs.ts`, `plc-io.ts`, `analog.ts` | Classic first-PLC project fields remain v1-compatible; additional PLC programs are keyed by ID |
| Plant simulation and measurements | `src/plant/equipment` and `src/plant/world` | Pure per-instance `fresh / step / read` methods and registered `signals`, `commands`, `faults` |
| Parameters | `src/components/params.ts` | Numeric constraints/defaults, per-ID project overrides; reject unsupported settings |
| Faults | `src/sim/faults.ts` and `plantFaults` for plant models | Per-instance failure semantics; hidden assessment causes are not exposed by diagnostic adapters |
| Observable signal image | `src/sim/device-channels.ts` | Read only from real worker snapshots; report numeric disconnection as null, preserve registered units and source/timing provenance |
| Visualization | `src/render` and `WorkbenchInspector.tsx` | Draw immutable worker state and expose actual sampled channels |

## Integration sequence for a new device

1. Register the kind, help text, terminal names and compatible electrical roles once in `registry.ts`. Avoid ghost palette items with no worker-owned behavior.
2. Define bounded parameters in `params.ts` (or the plant equipment definition). Default project values need not be persisted.
3. Implement terminal-level electrical behavior in the supported data-driven definition interface; use legacy `buildCircuit()` only when a compatible adapter does not yet exist.
4. For physical factory devices, add one `EquipmentDef` to `plant/equipment`, including deterministic per-instance state, command channels, sensor channels, fault hooks and real engineering units **only if defined by that model**.
5. Keep analog channels out of the 24 V graph. A numeric source must have an actual physical channel and compatible wiring; use an explicit disconnected state instead of guessed voltage.
6. Publish outputs and sensor measurements through the same Worker-owned snapshot. Any UI properties or telemetry must read the shared device contract and the real signal image.
7. When a component is removed, clear its wires, device faults, parameter overrides, PLC mappings/programs (when relevant) and plant faults without affecting unrelated instances.

## Compatibility and open boundaries

- The classic first-PLC runtime path and its legacy singleton presentation fields are maintained for existing projects. Generic PLC16 and secondary controllers use independent per-ID runtime state. **Full first-controller execution-path consolidation remains open.**
- `controllerPowered` on the P3 belt teaching model is a **project-wide observed presence of at least one energized PLC**, not evidence of which controller owns a particular belt. Per-belt controller attribution requires a model-backed circuit-to-device association; it must not be inferred from proximity or naming.
- Numeric ranges, electrical current, physical safety ratings, device-specific supply references and fault identities are not invented where underlying definitions supply none.
- Priority Pause, bounded commands/events, deterministic replay and independent device observability are educational simulator features, not real equipment control guarantees.
- Stage 3 handles PLC IDE development, Stage 4 electrical/3D authoring, Stage 5 equipment breadth, and later stages diagnostics and learning flows. Do not enlarge Stage 2 into those projects.

**Status:** Stage 2 development contract documented; further kernel consolidation remains. No merge or deployment implied.
