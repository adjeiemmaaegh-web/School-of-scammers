# EFO Skill Lab

**Open, browser-based industrial automation sandbox** — build a system from components, wire it, edit real Ladder logic, then Run, Step and troubleshoot. Inspired by the workflow of Cisco Packet Tracer/GNS3, PLC programming engineering tools, and Factory I/O; this is an original educational simulator, not a vendor clone.

**Current state:** PRD v4.2 direction approved; P0/P1 3D and UX review branches retain their own draft PRs; the subsequent P2 Ladder/ST programming continuation is in a separate draft branch, not merged or production-approved. The previously shipped guided exercises (PLC + CCTV) and local employer/candidate assessments remain intact. The new primary entry is `/sandbox`; existing exercises are under `/trades`.

## P3 3D tank and fluid-control preview (draft PR #17)

In the same `/sandbox` 3D workbench, choose **Place 3D tank layout** from an empty workspace. This adds an educational vessel, pump, high-level switch and drain valve; the devices are **not prewired**. Connect the 11 real terminals listed in [P3 plant progress](docs/product/P3_PLANT_PROGRESS.md), select **Load tank control example** in Ladder, then Run. With correct wiring, Q0.2 powers the fill pump, a real powered I0.3 level switch trips at 750 ml and clears below 600 ml, and Q0.3 energizes the drain. The worker advances the bounded liquid level and the original Three.js tank shows that actual state. Users can edit Ladder or bounded Structured Text, disconnect a wire, or move components to observe genuine faulty outcomes. This is a teaching model, not calibrated hydraulics, real analog sensing or certified machinery. No backend/cloud service has been introduced.

## P3 3D sorting development preview (draft PR #17)

The open 3D workbench now includes a **conveyor load, powered mark-sensitive optical sensor and wired reject diverter**. From an empty project, select **Place 3D sorting layout** (equipment only, not prewired), patch the 16 terminals using the keyboard-accessible panel or 3D pins, select **Load sorting program example** in the Ladder editor, Run, press START, and feed **marked** or **plain** parcels from the new station panel. With correct wiring and logic, marked parcels are rejected by Q0.1 and plain parcels pass; moving the sensor, editing Sort or disconnecting the conveyor or sensor changes the actual worker-computed outcome. All 3D moving cartons are driven by immutable Worker snapshots. The same simulator supports optional bounded Structured Text Sort output. Exact wiring and QA limits: [P3 plant progress](docs/product/P3_PLANT_PROGRESS.md).

This is a limited **single-parcel, idealized 24V educational model**, not a physically realistic Factory I/O equivalent. P2's unfinished requirements and P3 device breadth remain open. No backend, user accounts, cloud or production deployment is authorized.

## P0/P1 3D sandbox and P2 programming development preview

- **Real 3D workbench:** place a 24V source, virtual PLC, START/STOP pushbuttons, contactor and simplified DC motor onto an orbitable, zoomable Three.js scene. Drag from the palette or click to place. Connect terminals in 3D or through the accessible patch panel.
- Click any two terminal buttons to connect a wire; remove wires to test failures. See electrical voltage probes and energized wire overlays.
- Edit up to eight actual Ladder rungs with local BOOL tags and supported TON/TOF/RTO/TP timers, CTU/CTD counters with editable reset/load conditions and edge instructions; or use the new editable Structured Text (ST) tab. The salvaged `src/engineering/ladder.ts` and bounded `src/engineering/structured-text.ts` engines execute the active program while `src/engineering/electrical.ts` resolves circuit wiring.
- Run, Pause, Step, reset the simulated scan, inspect live tags/timer/counter memory, use future-scan or Boolean edge breakpoints, export the latest 300 simulated scan records as CSV, and operate buttons to see the contactor and motor follow the actual program.
- Save locally in browser storage and import/export project JSON files. **No backend, login, SaaS, payment, cloud database, or server** is required for this version.

For a full start/stop demonstration, connect the supply and PLC power pins, route START and STOP through the PLC inputs, route output Q0.0 into contactor coil A1/A2, and place contactor NO 13/14 in series with the motor. The sandbox UI includes the wiring map.

This development preview intentionally supports **one PLC, one supply, up to eight bounded Ladder rungs (local BOOL/INT/DINT/REAL tags, numeric compare/MOV/arithmetic) or bounded ST, and an idealized 24V DC circuit**. It is *not* a general circuit solver, vendor PLC runtime, real motor physics simulator, or safety-rated E-stop system. More PLC programming functions, physical analog I/O mapping, additional devices, and industrial-grade electrical realism are later roadmap phases; real 3D rendering now starts in P1. Never substitute this simulator for physical equipment acceptance or safety training.

## Existing app retained

The guided exercise ladders and local employer → candidate assignment/result-code workflow still work through the existing routes. These are **not** converted into the sandbox until P6; no separate backend account system is planned for this version.

## Engineering layout

- `src/components/registry.ts` — P1 device terminal definitions.
- `src/sim/signals.ts` — serializable commands, state, project and immutable render snapshot types.
- `src/sim/orchestrator.ts` — authoritative phase order: commands → electrical → PLC input sampling → selected Ladder/ST scan → output image → contactor → ideal motor → sensors → events → snapshot.
- `src/sim/worker.ts` — fixed 50ms simulation timestep in a Web Worker, with commands queued at a clock boundary.
- `src/program/LadderEditor.tsx`, `StructuredTextEditor.tsx`, `ProgrammingDock.tsx`, `LiveMonitor.tsx` — bounded multi-rung LD/ST programming and live instrumentation within the approved UX.
- `src/program/p2-contract.ts` — P2 validation/compilation limits; `src/program/scan-trace.ts` — bounded worker trace and safe CSV export; `src/app/SandboxPage.tsx` — frontend workbench.
- `src/render/Sandbox3D.tsx` — original low-poly 3D meshes, cables, orbit controls and interactive scene. Its UI reads snapshots; no electrical or PLC logic is executed inside the renderer.
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

The P1/P2 regressions are in `tests/sandbox-integration.test.ts` and `tests/sandbox-p2-programming.test.ts`. GitHub CI runs `scripts/sandbox-browser-acceptance.cjs`, `scripts/sandbox-ux-acceptance.cjs` and `scripts/sandbox-p2-browser-acceptance.cjs` to exercise the real browser paths. The project must pass the full repository verification suite before merge or any production rollout. A real browser play-through of place → wire → edit → run → wrong wiring/logic must also be recorded. **Do not assume code presence equals acceptance.**

## Product documents

- [PRD v4.2](docs/product/PRD.md)
- [Architecture v4](docs/product/ARCHITECTURE.md)
- [UX-first workspace blueprint](docs/product/UX_WORKBENCH_V1.md)
- [P2 programming scope, evidence and open gates](docs/product/P2_PROGRAMMING_PROGRESS.md)
- [Developer workflow skill](.claude/skills/automation-platform/SKILL.md)
- [Handover and outstanding gates](docs/product/HANDOVER_CHECKLIST.md)
- [Previous v3 product requirements](docs/product/archive/PRD_v3_exercise-assessment.md)
