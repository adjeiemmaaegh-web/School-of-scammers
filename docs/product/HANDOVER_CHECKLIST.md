# Handover & Checklist — Developer Takeover

> **Purpose:** Capture the state of the project at takeover from the previous developer, and track the work to realign it with the product vision in `docs/product/PRD.md` (v3).
> **Date started:** 6 November 2026 · **Status:** Phases 0, 1 and 3 delivered; Phase 2 (full 1–10 ladder) in progress.

## Progress snapshot (6 Nov 2026)
- ✅ **Phase 0** — repo cleaned, engine audited, contracts defined (`src/platform/types.ts`), ARCHITECTURE + README updated to v3.
- ✅ **Phase 1** — new two-audience shell, design system, and the rank-1 PLC exercise playable end-to-end in learning **and** assessment mode.
- ✅ **Phase 3** — local employer→candidate assessment flow (build assignment → share code/link → candidate takes under exam conditions → result code → employer review).
- 🚧 **Phase 2** — ladder UI done + rank 1 built; ranks 2–10 designed as planned rungs, authored incrementally.
- ⏳ **Phase 4+** — second trade, then backend/accounts.

Everything builds, typechecks, and the 536 engine tests pass; a headless run plays the conveyor exercise to a 100% pass with no console errors.

---

## 1. Context in one paragraph

The previous developer was let go. They delivered a real, well-tested **PLC simulation engine** but wrapped it in a dense "engineer's console" UI, scoped it PLC-only, and left out the employer→candidate hiring flow entirely. The decision (with the product owner) is to **keep the engine and rebuild the product around the real vision**: a two-audience, multi-trade, "Cisco Packet Tracer for the trades" platform with a 1–10 ranked exercise ladder. See the PRD for the full direction and the four foundational decisions.

---

## 2. What exists at takeover (inventory)

### 2.1 Keep (assets)
- **Simulation engine** — `src/engineering/*` (~70 modules: ladder, structured text, scan debugger, electrical netlist, fault matrix, PID, pneumatics, workcell, etc.), `src/core/plc.ts`, `src/engine/`. ~6,300 LOC source.
- **Test suite** — `tests/*` (~2,500 LOC, ~70 test files). Real coverage of the engine. Keep and keep green.
- **Build/verify tooling** — `scripts/*`, `qa/*` protocols, offline service-worker build, CI workflow in `.github/`.
- **Useful docs** — `docs/product/COMPETITOR_AND_MIT_REVIEW.md`, `docs/product/ARCHITECTURE.md`, license-provenance docs, ADRs in `docs/adr/`.

### 2.2 Rebuild (shell / product)
- `src/main.tsx` — the 16-item sidebar shell and routing. **Replace** with the two-audience shell.
- `src/components/LabPortal.tsx` and most portal/page components — **replace** with the new experience layer.
- `src/lab-catalog.ts` — flat catalogue. **Replace** with the 1–10 ranked exercise model.
- `src/style.css` — ~20KB of ad-hoc CSS. **Replace** with a proper design system.

### 2.3 Archive / clean
- **~70 `*_INCREMENT_REPORT.md` files + `*_SOURCE_MANIFEST.json` + `*.txt` logs in the repo root** — churn noise. Keep (per owner instruction) but move to `docs/archive/`.
- Legacy PRD v2 and ROADMAP v2 — already moved to `docs/product/archive/`.

### 2.4 Stack
- TypeScript + React 18 + Vite 6 + React Router 7 + React Three Fiber/Three.js + Vitest. Node 22.
- Frontend-only, deployed on Vercel (`plc-skills-lab.vercel.app`). No backend yet.

---

## 3. Known gaps vs. the vision

| Gap | Where it shows | Fixed in |
|---|---|---|
| No two-audience (Student / Employer) split | whole app | Phase 1 |
| Employer→candidate flow missing entirely | whole app | Phase 3 (local), Phase 5 (accounts) |
| No 1–10 ranked exercise ladder | `lab-catalog.ts` | Phase 2 |
| PLC-only; no trade-module contract | architecture | Phase 0 (contract) + Phase 4 (2nd trade) |
| "0/10" UI/UX — dense, form/table heavy, no guided canvas | `main.tsx`, `LabPortal.tsx`, `style.css` | Phase 1 |
| Minimal real simulation canvas; mostly panels | components | Phase 1 (hybrid 2.5D) |
| Repo root cluttered with report files | repo root | Phase 0 |
| Docs over-claim / churn style | docs | ongoing (new working style) |

---

## 4. Checklist

### Phase 0 — Reset & foundations (current)
- [x] Clone repo, audit existing code & docs
- [x] Agree the four foundational decisions with owner (strategy, scope, backend, fidelity)
- [x] Write new PRD (v3) — `docs/product/PRD.md`
- [x] Archive legacy PRD & roadmap to `docs/product/archive/`
- [x] Write this handover/checklist
- [x] **Owner review & sign-off on the PRD** (approved 6 Nov 2026)
- [x] Clean repo root: moved 72 `*_INCREMENT_REPORT.md`, manifests, and logs into `docs/archive/legacy-reports/` (kept, not deleted)
- [x] Engine audit: engine's usable surface documented in `docs/product/ARCHITECTURE.md`; trade modules call `engine/simulation.ts`, `engine/assessment.ts`, `core/plc.ts`
- [x] Define the **trade-module interface** and **exercise-definition schema** → `src/platform/types.ts`
- [x] Define the **persistence interface** → `src/platform/persistence.ts` (local v1; backend slots behind same functions)
- [x] Update `docs/product/ARCHITECTURE.md` to match PRD v3
- [x] Confirm tests pass on this machine (`npm ci && npm test` → **536 tests / 73 files passing**, 6 Nov 2026)

### Phase 1 — New shell & first great exercise ✅
- [x] Design system / visual language (`src/ui/theme.css` + `app.css`) — light/dark, responsive
- [x] Two-audience front door (`src/app/FrontDoor.tsx`)
- [x] Trade picker (PLC active; others "coming soon") (`src/app/TradePicker.tsx`)
- [x] Redesigned in-exercise UI: brief + live objectives + **simulation canvas as the star** + progressive-disclosure instrumentation (`src/ui/ExercisePlayer.tsx`)
- [x] Hybrid 2.5D canvas (SVG conveyor scene bound to engine state)
- [x] Rank-1 PLC exercise end-to-end in **learning** mode
- [x] Same exercise in **assessment** mode (hints off, evidence + rubric)
- [x] Headless usability/interaction check passes (plays through to 100%)

### Phase 2 — PLC 1–10 ladder 🚧
- [x] Ladder progression UI as the main learner surface (`src/app/TradeLadder.tsx`)
- [x] Rank 1 authored and playable
- [x] Ranks 2–10 designed as planned rungs (titles/summaries in `src/trades/plc/index.ts`)
- [ ] Author ranks 2–10 as fully playable exercises (follow the `conveyor-start.tsx` pattern)

### Phase 3 — Local assessment flow ✅
- [x] Employer: select exercise + label, generate assignment (`src/app/EmployerPage.tsx`)
- [x] Shareable assignment link + code
- [x] Candidate completes under exam conditions; result code export (`src/app/CandidatePage.tsx`)
- [x] Employer review of returned result (rubric + evidence)
- [ ] Nice-to-have later: visual replay of the evidence timeline

### Phase 4 — Second trade
- [ ] Pick second trade (CCTV vs electronics — owner decision)
- [ ] Implement as a trade module against the contract (no shell/engine forks)
- [ ] Starter exercise ladder for it

### Phase 5 — Backend & accounts
- [ ] Confirm Supabase (or alternative)
- [ ] Auth + employer/candidate accounts
- [ ] Online assignment + stored results behind the existing persistence interface

### Phase 6+ — Scale
- [ ] Remaining trades (BMS, phone/PC, …)
- [ ] Instructor/cohort features, analytics, billing

---

## 5. Open decisions awaiting owner (also in PRD §13)
- [x] **Product/brand name** — **EFO Skill Lab** (decided 6 Nov 2026; threaded through the app via `src/platform/config.ts`)
- [ ] Second trade for Phase 4 (CCTV vs electronics)
- [ ] Backend choice confirmation (Supabase assumed)
- [ ] Monetization model (later; affects Phase 5 account design)

---

## 6. Assets the owner will source (described in PRD §12)
- [ ] Trade icons (PLC, CCTV, BMS, phone/PC, electronics)
- [ ] PLC device sprites/models for the 2.5D canvas
- [ ] Front-door hero imagery (optional)
- [ ] Reference photos (PLC panel, 24V circuit, conveyor) for visual accuracy
- [ ] Brand/logo files (once named)

---

## 6b. How to author a new exercise (the pattern)

The rank-1 exercise `src/trades/plc/exercises/conveyor-start.tsx` is the template. To add a rung:

1. **Write the simulation as pure logic.** Either reuse an engine state machine (as conveyor-start reuses `engine/simulation.ts`) or write a small reducer `reduce(state, action) → { next, event? }`. Keep it deterministic and seedable.
2. **Fill in the `ExerciseDefinition`** — id, trade, rank, title, scenario (work-order brief), `objectives`, `hints`, `init`, `reduce`, `objectiveStatus`, `evaluate` (return a `RubricResult`), and a `Play` component.
3. **Build the `Play` component** — the 2.5D canvas (inline SVG bound to state) plus the controls and any instruments (progressive disclosure). Use the shared `exercise-sim` / `sim-canvas` / `sim-controls` classes.
4. **Register it** — add the def to `exercises` in `src/trades/plc/index.ts` and remove its stub from `planned`. The ladder, routing, learner page, and assessment flow pick it up automatically.
5. **Verify** — `npx tsc --noEmit`, `npm test`, and a quick dev-server play-through.

No shell, runtime, or routing changes are needed per exercise — that's the point of the contract.

## 7. Working style going forward (lessons from the churn)
- **Fewer, meaningful docs.** No per-task "increment report" spam. This checklist + the PRD + ADRs for real architectural decisions are enough.
- **Keep tests green.** The engine's test suite is an asset; don't let it rot during the rebuild.
- **Honest claims.** "Educational simulation, not safety-rated/certified" stays.
- **Phase gates.** Don't start a phase before the previous one's gate is met (e.g. PLC ladder excellent before a second trade).
- **Owner signs off** on PRD changes and phase transitions.

---

## 8. How to run the project (verify at takeover)
```bash
npm ci
npm run dev          # local dev server (Vite)
npm test             # Vitest engine suite
npm run build        # tsc + Vite + offline precache
npm run verify:full  # full verification
```
Requires Node 22. Deploys to Vercel from the repo.
