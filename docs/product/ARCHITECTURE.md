# PLC Skills Lab — Frontend Simulation Architecture v2.0

## Scope boundary
This codebase owns browser UI, PLC runtime, electrical solver, device models, machine simulation, 3D, diagnostics, scenarios, assessment and local files. Separate backend team owns identity, accounts, remote storage, organizations, permissions, employer management, authoritative submission and hosting.

## Architectural layers
```
React UI / 3D Renderer / Ladder Editor / Wiring Editor / Instruments
                  | commands / snapshots
              Simulation Host
       deterministic clock + event recorder
                  |
     +------------+------------+
     |            |            |
Electrical Netlist  PLC Runtime  Plant/Physics Engine
     |            |            |
     +---- typed I/O + device bindings ---+
                  |
       Scenario / Project / Assessment
                  |
      Local storage / export / adapters
                  |
      Backend integration contracts ONLY
```

## Contracts (illustrative TypeScript)
```ts
type Tick = number;
type TagValue = boolean | number;
interface SimulationCommand { id: string; atTick: Tick; kind: string; payload: unknown; }
interface PlcSnapshot { scan: number; inputs: Readonly<Record<string, TagValue>>; outputs: Readonly<Record<string, TagValue>>; memory: Readonly<Record<string, TagValue>>; }
interface ElectricalSnapshot { terminalVoltages: Readonly<Record<string, number>>; continuity: Readonly<Record<string, boolean>>; }
interface PlantSnapshot { componentStates: Readonly<Record<string, unknown>>; }
interface SimulationSnapshot { schemaVersion: number; tick: Tick; plc: PlcSnapshot; electrical: ElectricalSnapshot; plant: PlantSnapshot; }
interface AttemptEvent { id: string; tick: Tick; sequence: number; commandId?: string; kind: string; details: unknown; }
interface ScenarioManifest { id: string; version: string; seed: number; requiredEngineVersion: string; }
```
Use discriminated unions and schema validators in actual implementation rather than loose `kind`/`unknown` payloads. Serialize replay snapshots deterministically; validate every imported project and program.

## Reuse strategy
Investigate Open Industry Project TypeScript/Three.js/Jolt implementation as an **upstream candidate**, not an already approved dependency. Compare: PLC semantics, netlist/wiring support, device API stability, project file formats, engine-to-render separation, package modularity, build size, worker support, maintainability and license provenance. Prefer a bounded fork or extraction of audited modules over blindly embedding the entire application. Preserve upstream attribution and a recorded upstream commit SHA; isolate with adapters. Build electrical lab and assessments independently if upstream does not supply required contracts.

## Dependency policy
Use MIT-compatible code where possible; verify each dependency's and 3D asset's own license, attribution, distribution obligations and provenance. Third-party notices, lockfiles and license manifest are required. No vendor logos or proprietary PLC IDE assets without permission.

## Rendering
Three.js-based scene adapter with asset pipeline (glTF), instancing/LOD, PBR lighting, adjustable shadows, camera controls, diagnostic overlays and graphics quality presets. Physics may use Jolt/WASM if evaluated; simulation clock remains authoritative. Do not use 3D transforms as control logic inputs except through explicitly modeled sensor geometry observations.

## Validation layers
Static type and schema checks -> deterministic engine/unit tests -> scenario acceptance traces -> integration tests -> browser/performance profiling -> expert and hardware comparisons (deferred). Clearly track what was executed.
