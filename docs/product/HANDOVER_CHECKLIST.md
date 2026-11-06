# Handover & Checklist — Developer Takeover

> **Purpose:** Capture the state of the project at takeover from the previous developer, and track the work to realign it with the product vision in `docs/product/PRD.md` (v3).
> **Date started:** 6 November 2026 · **Status:** Phase 0 (Reset & foundations) in progress.

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
- [ ] **Owner review & sign-off on the PRD** ← next gate
- [ ] Clean repo root: move `*_INCREMENT_REPORT.md`, manifests, and stray logs into `docs/archive/` (keep, don't delete)
- [ ] Engine audit: document the engine's **usable public surface** (what functions/exports the new shell will call) — the "contract"
- [ ] Draft the **trade-module interface** and **exercise-definition schema** (device catalog, scene, objectives, rubric, evidence)
- [ ] Draft the **persistence interface** (so local v1 and backend later share one boundary)
- [ ] Update `docs/product/ARCHITECTURE.md` to match PRD v3
- [x] Confirm tests pass on this machine (`npm ci && npm test` → **536 tests / 73 files passing**, 6 Nov 2026)

### Phase 1 — New shell & first great exercise
- [ ] Design system / visual language (tokens, components) — approachable, modern
- [ ] Two-audience front door (Student vs Employer)
- [ ] Trade picker (PLC active; others "coming soon")
- [ ] Redesigned in-exercise UI: work-order brief + objectives + **simulation canvas as the star** + progressive-disclosure instrumentation
- [ ] Hybrid 2.5D canvas foundation with one targeted 3D element (e.g. conveyor)
- [ ] One polished PLC exercise ("conveyor won't start") end-to-end in **Student** mode
- [ ] Same exercise in **Assessment** mode (hints off, evidence + rubric result)
- [ ] Usability check: a first-timer completes it with no instructions

### Phase 2 — PLC 1–10 ladder
- [ ] Define the 10 ranked PLC exercises (rank, scenario, objectives, rubric) — map onto engine capabilities
- [ ] Author exercises 1–10 with hints + evidence capture
- [ ] Progression UI (the ladder as the main learner surface)

### Phase 3 — Local assessment flow
- [ ] Employer: select/configure exercise + difficulty
- [ ] Export an assignment (link/file) for a candidate
- [ ] Candidate completes; export evidence/result
- [ ] Employer report view (pass/fail, rubric, timeline, replay)

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
- [ ] **Product/brand name** (repo is `School-of-scammers`; app is "PLC Skills Lab" — needs a trade-agnostic name before Phase 1 UI ships)
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
