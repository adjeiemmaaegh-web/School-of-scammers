# EFO Skill Lab

**Open, browser-based industrial automation sandbox** — build a system from components, wire it, edit real Ladder logic, then Run, Step and troubleshoot. Inspired by the workflow of Cisco Packet Tracer/GNS3, PLC programming engineering tools, and Factory I/O; this is an original educational simulator, not a vendor clone.

**Current state:** PRD v4.1 direction approved; P0/P1 first vertical slice is being implemented on a development branch. The previously shipped guided exercises (PLC + CCTV) and local employer/candidate assessments remain intact. The new primary entry is `/sandbox`; existing exercises are under `/trades`.

## P0/P1 sandbox preview

- Open 2.5D workspace: click or drag a 24V source, virtual PLC, START/STOP pushbuttons, contactor and simplified DC motor.
- Click any two terminal buttons to connect a wire; remove wires to test failures. See electrical voltage probes and energized wire overlays.
- Edit an actual Ladder rung (series/parallel contacts and coil) or load an **editable** seal-in example. The salvaged `src/engineering/ladder.ts` interpreter executes this program; `src/engineering/electrical.ts` resolves its electrical connections.
- Run, Pause, Step, reset the simulated scan, operate pushbuttons, and monitor the contactor/motor with deterministic worker-driven state.
- Save locally in browser storage and import/export project JSON files. **No backend, login, SaaS, payment, cloud database, or server** is required for this version.

For a full start/stop demonstration, connect the supply and PLC power pins, route START and STOP through the PLC inputs, route output Q0.0 into contactor coil A1/A2, and place contactor NO 13/14 in series with the motor. The sandbox UI includes the wiring map.

This first slice intentionally supports **one PLC, one supply, one editable Ladder rung and a bounded idealized 24V DC circuit**. It is *not* a general circuit solver, vendor PLC runtime, real motor physics simulator, or safety-rated E-stop system. More programming instructions, devices, diagnostics, and targeted 3D are later roadmap phases. Never substitute this simulator for physical equipment acceptance or safety training.

## Existing app retained

The guided exercise ladders and local employer → candidate assignment/result-code workflow still work through the existing routes. These are **not** converted into the sandbox until P6; no separate backend account system is planned for this version.

## Engineering layout

- `src/components/registry.ts` — P1 device terminal definitions.
- `src/sim/signals.ts` — serializable commands, state, project and immutable render snapshot types.
- `src/sim/orchestrator.ts` — authoritative phase order: commands → electrical → PLC input sampling → actual Ladder scan → output image → contactor → ideal motor → sensors → events → snapshot.
- `src/sim/worker.ts` — fixed 50ms simulation timestep in a Web Worker, with commands queued at a clock boundary.
- `src/program/LadderEditor.tsx`, `src/app/SandboxPage.tsx` — programming and visual sandbox UI.
- `src/engineering`, `src/core`, `src/engine` — original salvaged engineering engine; **preserved**.
- `src/app`, `src/ui`, `src/trades`, `src/platform` — original guided exercise and local assessment app; **preserved**.

## Run locally

Requires Node.js 22.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run verify:full
```

The P1 regression tests are in `tests/sandbox-integration.test.ts`. The project must pass the full repository verification suite before merge or any production rollout. A real browser play-through of place → wire → edit → run → wrong wiring/logic must also be recorded. **Do not assume code presence equals acceptance.**

## Product documents

- [PRD v4.1](docs/product/PRD.md)
- [Architecture v4](docs/product/ARCHITECTURE.md)
- [Developer workflow skill](.claude/skills/automation-platform/SKILL.md)
- [Handover and outstanding gates](docs/product/HANDOVER_CHECKLIST.md)
- [Previous v3 product requirements](docs/product/archive/PRD_v3_exercise-assessment.md)
