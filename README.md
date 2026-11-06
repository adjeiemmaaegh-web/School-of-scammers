# EFO Skill Lab

**A browser-based virtual simulator and practical-assessment platform for the skilled trades — "Cisco Packet Tracer for the trades."** Learners build real hands-on skills in simulation; employers test candidates on realistic, job-like tasks instead of book knowledge. It launches with **PLC & industrial automation** and is architected to expand to CCTV, BMS, phone & PC repair, and electronics.

> **Status:** active rebuild. The product was reset from the previous developer's PLC-only "simulation-first" codebase to the two-audience vision in [`docs/product/PRD.md`](docs/product/PRD.md). The deterministic simulation **engine was kept**; the product shell around it was rebuilt.
>
> **This is an educational simulation.** It models the *categories* of trade work (programming, wiring, diagnosis, commissioning). It is **not** a safety-rated controller, not certified instruction, and not a substitute for live-work training. Limits are stated, not hidden.

## What's here

Two experiences over one simulation engine:

- **Learner lab** — pick a trade, climb a **1–10 ranked exercise ladder**, and learn by doing: guided briefs, live objectives, hints, instant feedback, reset & replay.
- **Employer ↔ candidate assessment** — an employer builds a ranked practical test and shares it (link/code); a candidate completes it under exam conditions; the employer gets back an evidence-backed rubric result. *(Local-only in this version — no accounts yet; a backend is a later phase.)*

The flagship **PLC** trade ships with a fully playable rank-1 exercise ("conveyor will not start") built on the salvaged engine, and ranks 2–10 designed on the ladder. The original engine lab tools remain reachable under `/labs/*`.

## Architecture (short version)

```
Experience layer (src/app, src/ui)  →  front door, trade picker, ladder, ExercisePlayer
Platform layer   (src/platform)     →  exercise runtime, types, persistence boundary
Trade modules    (src/trades)       →  registry + plc (pluggable; CCTV/BMS/… later)
Simulation engine(src/engine, core, engineering)  →  salvaged, deterministic, tested
```

Full design: [`docs/product/ARCHITECTURE.md`](docs/product/ARCHITECTURE.md). Adding a trade is adding a module in `src/trades/` and registering it — no shell or engine changes.

## Local development

Requires Node.js 22.

```bash
npm ci
npm run dev        # Vite dev server
npm test           # Vitest engine suite (536 tests)
npm run build      # tsc + Vite + offline precache
npm run verify:full
```

Deploys to Vercel.

## Project docs

- [Product requirements (PRD v3)](docs/product/PRD.md) — vision, audiences, exercise model, roadmap
- [Architecture](docs/product/ARCHITECTURE.md)
- [Handover & checklist](docs/product/HANDOVER_CHECKLIST.md) — current state and what's next
- [Competitor benchmark](docs/product/COMPETITOR_AND_MIT_REVIEW.md)
- [Archived legacy docs & reports](docs/archive/) — the previous developer's PRD, roadmap, and ~70 build reports (kept for history)

The repository contains **no** backend, authentication, database, or payment features yet; those are a later phase, designed for behind the persistence boundary.
