# PLC Skills Lab — Consolidated machine catalogue completion
**Date:** 5 November 2026
**Scope:** simulation-first frontend; no backend or physical PLC access

## Delivered capabilities
- Factory composer now supports **13** distinct educational equipment kinds: conveyor, tank, cylinder, pump, photoeye, control-panel, fence, **variable-frequency drive, vertical lift, linear pusher, process valve, inductive proximity sensor and signal beacon**.
- New equipment is represented by actual independent 3D geometry and bounded deterministic device state. Speed, position, travel and end stops come from the simulated scan clock, never frame rate or wall clock.
- New typed feedback tags include `*_SPEED_PERCENT`, `*_AT_SPEED`, `*_POSITION_PERCENT`, `*_EXTENDED`, `*_RETRACTED` and `*_OPEN_PERCENT`.
- PLC adapter samples both photoeyes and proximity sensors as field inputs, executes authored ladder logic, and **separately gates all actuator commands** on simulated E-stop, guard and automatic enable.
- Four authorable layouts with matching actual ladder programs: conveyor sorter, packaging pusher/conveyor, lift with variable-speed drive, process tank/valve/pump skid.
- A `Run current scene acceptance` command evaluates the actual edited workcell layout and currently loaded ladder program. Checks include output-to-actuator mapping, idle state, detection-to-actuation, guard, reset, E-stop, recovered idle, simulated clock and deterministic replay. Failures are visible; it does not silently use the default program.
- Newly added source tests and Chrome browser checks exercise scene loading and commissioning, safety gating, replay, numerical feedback and negative cases.

## Model limitations
These machines use illustrative normalized motion curves (not calibrated pressure, mechanical force, mass, friction, acceleration, energy or collisions). A variable-speed drive here is an educational speed ramp and is **not** an electrical VFD model; the lift is a bounded travel indicator, not a hoist load analysis. The scene editor remains a bounded 13×13 grid with up to 32 anchored devices, not a fully free-form industrial CAD/physics environment.

## Release decision
This development pass closes a substantial **source-development breadth** gap but not the entire simulation-first PRD. Industrial acceptance remains **NO-GO** until reference PLC trace comparison, qualified safety/controls review, 8 GB Windows low-spec tests, actual Edge/Safari/mobile tests, legal asset/dependency provenance, and independent instructor/pilot results. Full IEC 61131-3 language support, full PLCopen XML round-trip and sophisticated physical simulations are not implemented here. Do not claim vendor-tool parity or safety certification.

The repository remains frontend-only; backend/auth/database/employer infrastructure remains separately owned. CI must pass before merge and the exact merged commit/deployment must be verified.
