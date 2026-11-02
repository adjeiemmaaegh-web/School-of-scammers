# Competitor Benchmark and MIT Reuse Decision Record
Research date: 30 October 2026. Public product claims only; no hands-on competitor verification.

| Benchmark | Publicly documented capability | Design implication |
|---|---|---|
| Factory I/O | 20+ 3D scenes, parts library, digital/analog I/O, always-on/off faults, PLC drivers | High-quality scene editor, modular parts and controlled faults |
| Controls Trainer | Browser panel wiring, lockout workflow, ladder editor, simulated multimeter | Make electrical troubleshooting first-class |
| PLC Simulation Software | User-provided research describes ladder/ST, graded scenarios and debugging; independent detailed verification outstanding | Benchmark authoring and exercise depth before claiming parity |
| Open Industry Project | MIT TypeScript/Three.js/Jolt browser simulator, built-in LD/ST subset, parts, PLCopen exchange; early-release breaking changes | Candidate foundation subject to code audit and isolation |
| Visual PLC Studio | Browser LD/ST, scan engine, watch/force I/O, 3D binding, optional hardware gateway | Debugger/scan transparency and typed tags |
| EDWartens | Browser PLC and panel labs, LD/ST/SFC, 3D plants, graded exercises | Work-order-to-acceptance workflow and progressive labs |

## Open Industry Project preliminary decision
**Status: promising, conditional reuse; no source code has been copied or integrated.** Repository: https://github.com/Open-Industry-Project/Open-Industry-Project . Published license: MIT. It publicly warns that project format, part SDK and PLC engine semantics may change. This makes direct unpinned integration risky.

### Mandatory technical due diligence before adoption
1. Clone and pin exact upstream SHA; inventory packages, entrypoints, test coverage and dependencies.
2. Read LICENSE, THIRD_PARTY_NOTICES.md, asset licenses, package lock and transitive licenses.
3. Evaluate isolation of PLC runtime, device library, Jolt physics and 3D renderer; measure browser bundle footprint.
4. Compare PLC scan semantics and project interchange with our requirements and create reference trace tests.
5. Inspect maintenance, issue backlog, security posture, browser support and upgrade cost.
6. Choose one: isolated library integration, bounded fork, selective MIT module extraction or independent implementation.
7. Keep copyright and permission notices; document modifications and attribution; avoid assuming MIT covers separately licensed assets or brands.

## Sources
- https://www.openindustryproject.org/
- https://github.com/Open-Industry-Project/Open-Industry-Project
- https://factoryio.com/features
- https://controlstrainer.com/
- https://www.visualplcstudio.com/
- https://lab.edwartens.com/virtual-plc-lab
- https://plcsimulationsoftware.com/ (follow-up feature validation needed)
