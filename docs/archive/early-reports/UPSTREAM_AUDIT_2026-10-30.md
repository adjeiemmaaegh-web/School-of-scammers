# Stage 0 upstream architecture decision — 2026-10-30

## Source access and confidence
GitHub repository landing pages and metadata were accessible; Git clone and nested GitHub tree pages were blocked by network DNS/restrictions. This is a repository-level architectural triage, **not** a source-level dependency, security, license or behavior audit. No upstream code was copied.

## Ranking and reuse boundary
1. **Open Industry Project**: Browser-first TypeScript, Three.js and Jolt stack; promising simulation/scene candidate. Investigate app module boundaries, licensing of assets, Jolt build and PLC runtime semantics before reuse.
2. **FactoryForge**: Godot 4.7, C#/Python and industrial interfaces. Valuable machine/assessment benchmark, but adopting wholesale conflicts with browser-first TypeScript architecture. Evaluate standalone data specifications, not its desktop runtime by default.
3. **PLC-Ladder-Simulator**: Small browser JavaScript ladder editor; suitable UX reference, but semantic fidelity, branch execution and test coverage require inspection before code reuse.
4. **teslasolar/plc**: Lightweight browser 3D reference; lower priority for an extensible engineering kernel.

## Legal gate
The GitHub pages show MIT licensing for Open Industry Project, FactoryForge and PLC-Ladder-Simulator. teslasolar/plc requires direct verification of a repository license file. MIT status of a root project does not automatically cover all dependencies, fonts, media, models or vendor files. Preserve copyright/license notices for any imported code. No upstream files imported in this increment.

## Current engineering contribution
Original, DOM-free ladder rung model and 24V discrete electrical graph model, independently authored as Stage 1/2 scaffolding. These are educational approximations: no certified safety control, no full IEC 61131-3 language implementation, no resistive/analog circuit solver. Future work: integrate ladder editor into UI, connect scan loop, add electrical fault topology, trace snapshots, typed device ports, motor and 3D binding.

## Next source-level audit when network access permits
Pin upstream SHAs; inventory source tree and lockfiles; map module dependencies and asset provenance; run typechecks/builds where feasible; compare PLC semantics using golden cases; benchmark browser frame budget; document reuse decisions per module and license attribution.
