# EFO Skill Lab — repo guide for developers & agents

**What this is:** a browser-based **virtual industrial-automation simulator** — the industrial-automation equivalent of Cisco Packet Tracer, with the PLC-programming depth of Siemens TIA Portal and the interactive 3D plant of Factory I/O. Users build a control system from a component library, wire it, program the PLC (Ladder/FBD/ST), press Run, and a deterministic scan engine drives a live plant they can observe and troubleshoot.

**Read these first (in order):**
1. `docs/product/PRD.md` — the product vision and scope (v4).
2. `docs/product/ARCHITECTURE.md` — how it's built: modules, the tick pipeline, the signal/event contract, the salvage map.
   **UX/UI-first workbench:** `docs/product/UX_WORKBENCH_V1.md` — review the 3D workspace design and user flows before expanding P2/P3 engineering.
3. `.claude/skills/automation-platform/SKILL.md` — the day-to-day developer guide and recipes. **Follow it when writing simulator code.**
4. `docs/product/HANDOVER_CHECKLIST.md` — current status and what's next.

**Golden rules (full list in the skill):** the engine is authoritative and the renderer only draws the published snapshot; the tick order lives only in the orchestrator; simulation code is pure, DOM-free and deterministic (seeded RNG); run the user's real PLC logic (never a canned animation); build on the salvaged engine (`src/core`, `src/engine`, `src/engineering`) rather than rewriting it; original assets only; everything is an educational simulation, never safety-rated.

**Current owner decision:** frontend-only for these versions. Do **not** introduce backend services, Supabase, authentication, account databases, cloud sync, server APIs, SaaS or payments. Keep browser-local projects and the local assignment/result-code workflow. The revised P0/P1 slice uses **real interactive 3D from day one**, Ladder first, and a start/stop motor; P3 expands 3D equipment and physical behavior. Use the existing Three.js/React Three Fiber modules and preserve low-spec WebGL fallback. This is educational 24V simplification, not general electrical/PLC fidelity.

**Two products, one repo:** the open **sandbox simulator** (the current direction, being built per PRD v4) and the **guided-exercise / employer-assessment** app (shipped, in `src/app`/`src/platform`/`src/trades`; becomes a *mode* on the sandbox in roadmap phase P6). Don't delete the latter — it's retained.

**Verify before committing:**
```bash
npx tsc --noEmit && npm test && npm run build && npm run verify:full
```
`npm run verify:full` is the core automated build gate. GitHub CI additionally runs `scripts/sandbox-browser-acceptance.cjs` to prove the new visual workflow; don't mark P0/P1 accepted without this and existing browser-suite evidence. Keep `main` deployable; keep the 536 engine tests green. Node 22.

**Working style:** small, working commits; few, high-signal docs (no per-task "report" files); honest claims.
