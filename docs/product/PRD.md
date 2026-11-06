# EFO Skill Lab — Product Requirements Document (v3)

> **Brand:** EFO Skill Lab (chosen 6 November 2026).
> **Version:** 3.0 · **Date:** 6 November 2026 · **Status:** Active product direction. Supersedes the legacy "simulation-first" PRD v2, which is archived at `docs/product/archive/PRD_v2_simulation-first_LEGACY.md`.
> **Owners:** Product owner (you) + engineering (Claude, taking over from the previous developer).

---

## 0. Why this document exists (the reset)

The previous developer built a technically real but **mis-framed** product. They produced a deep, well-tested PLC *simulation engine* — but wrapped it in a dense "engineer's debug console" UI, scoped the product as PLC-only, and **explicitly excluded the employer/candidate hiring flow** that is central to the actual vision. The result looks and feels like a developer tool, not a learning-and-assessment platform.

This PRD resets the product around the real vision while **salvaging the one genuinely valuable asset — the simulation engine.**

**Decisions already made (with the product owner), which this PRD is built on:**

| # | Decision | Choice |
|---|----------|--------|
| 1 | Codebase strategy | **Keep the simulation engine, rebuild the shell/product around it.** |
| 2 | v1 trade scope | **PLC first (flagship), but architected for multiple trades from day one.** |
| 3 | Backend & accounts | **Design for the full employer→candidate flow now, but ship v1 local-only; real accounts/backend is a later phase.** |
| 4 | Visual fidelity | **Hybrid 2.5D (clean guided 2D/isometric canvas + targeted 3D where it earns its place), in the spirit of Cisco Packet Tracer.** |

---

## 1. Vision

**"Cisco Packet Tracer for the skilled trades."**

A browser-based platform where people **practice real, hands-on technical skills in simulation** — and where **employers can practically test candidates** on realistic, job-like tasks instead of relying on book knowledge and interviews.

It launches with **PLC / industrial automation**, and is designed to expand to other hands-on trades: **CCTV installation, BMS (Building Management Systems), phone & PC repair, and electronics.**

Two things make it different from a course or a quiz:

1. **You *do* the work, not read about it.** Every exercise is a simulated environment with real cause and effect — wire it wrong and it doesn't work; diagnose the fault and it does.
2. **It bridges learning and hiring.** The same realistic tasks that teach a student can be used by an employer to see whether a candidate can actually do the job.

---

## 2. The problem

- **Hands-on trades are expensive and risky to practice.** PLC hardware, licensed IDEs, wiring benches, CCTV kits, and lab machines cost money and space most learners don't have.
- **Hiring in these trades is broken.** Interviews and certificates don't reveal whether someone can actually wire a panel, find a fault, or commission a machine. Employers hire "book-knowledge" candidates and find out too late.
- **Existing tools are either too shallow (quizzes) or too intimidating (full engineering simulators with terrible onboarding).** Nothing sits in the sweet spot of *realistic, guided, and usable by a normal learner or an interviewer.*

---

## 3. Target users & jobs-to-be-done

The platform serves **two audiences through two distinct experiences** that share one simulation core.

### 3.1 Learner / Student (the "lab")
*Analogous to a student opening Cisco Packet Tracer / GNS3.*

- **Novice learner** — "I want to learn PLC/CCTV/etc. from zero, safely, without buying hardware."
- **Student / trainee** — "I'm in a course and need to practice the practical side."
- **Career switcher / self-taught** — "I want to build and prove real skills."

**JTBD:** open a guided simulation, follow clear objectives, make mistakes and see consequences, get feedback, progress through increasing difficulty, and build demonstrable competence.

### 3.2 Employer ↔ Candidate (the "assessment")
*The hiring pillar — the part the previous product omitted entirely.*

- **Employer / interviewer / hiring manager** — "I want to give a candidate a realistic practical task and see, objectively, whether they can do the job."
- **Job applicant / candidate** — "I want to prove I can actually do the work, not just pass a quiz."

**JTBD (employer):** pick (or configure) a situation-based exercise at an appropriate difficulty, send it to a candidate, and receive an objective, evidence-backed result (what they did, what they got right/wrong, how they diagnosed, whether they respected safety).

**JTBD (candidate):** receive a task, complete it in the simulator under realistic conditions, and have the work speak for itself.

### 3.3 Secondary users
- **Instructor / trainer / assessor** — authors or curates exercises, reviews learner evidence, runs cohorts.
- **Platform admin** — manages trades, exercises, and (later) organizations.

---

## 4. Product principles

1. **Doing over reading.** Every control changes real simulated state; the visuals render the engine's truth. No fake buttons, no scripted "right answer" animations.
2. **Two audiences, one engine.** The Student lab and the Employer assessment are different *framings and flows* over the **same simulation and the same exercise definitions.** An exercise authored once can be used to teach and to test.
3. **Guided, not intimidating.** A learner should understand what to do within seconds. Packet-Tracer-level approachability is a hard requirement — this is the #1 fix versus the old product.
4. **Realistic, honestly bounded.** Simulations model the *category of work* faithfully (programming, wiring, diagnosis, commissioning) but never claim to be a safety-rated controller or hardware-equivalent. Limits are stated, not hidden.
5. **Difficulty is a first-class ladder (1–10).** Every trade has a clear progression of ten ranked exercises so both learners and interviewers have a shared, legible scale.
6. **Trades are pluggable.** Adding CCTV or BMS is adding a *trade module* (its devices, exercises, and assessment rubric), not forking the app.
7. **Evidence, not just a score.** Results explain *why* — the actions taken, faults found, safety respected — so they're meaningful to an employer and fair to a candidate.
8. **Works in a browser, offline-friendly, low-spec-tolerant.** No install. Degrades gracefully when 3D/WebGL isn't available.

---

## 5. The exercise model (the heart of the platform)

The exercise is the atomic unit shared by both audiences.

### 5.1 The 1–10 ranked ladder
Each trade exposes **10 ranked exercises**, difficulty **1 (entry) → 10 (expert)**. The rank is a real, defensible scale used by:
- **Learners** to progress.
- **Interviewers** to choose "give me a level-4 wiring task" or "a level-8 commissioning scenario" for a candidate.

A rank encodes expected competence, time, and complexity (number of subsystems, faults, ambiguity, safety stakes).

### 5.2 An exercise definition includes
- **Identity:** trade, rank (1–10), title, estimated time.
- **Scenario / situation:** a realistic, work-order-style brief ("The conveyor won't start — diagnose and restore it").
- **Environment:** the simulated scene/devices and their initial (possibly faulted) state, with a fixed seed for reproducibility.
- **Objectives / success conditions:** machine-checkable ("motor runs," "fault cleared," "wiring continuity correct," "E-stop dominates run").
- **Rubric:** weighted criteria (correct logic, correct wiring, correct diagnosis, verification, safety discipline, change discipline).
- **Hints / teaching layer:** shown in Student mode, withheld in Assessment mode.
- **Evidence capture:** the actions, edits, measurements, and safety-relevant events to record.

### 5.3 Two modes over the same definition
- **Student mode:** hints on, unlimited resets/replay, solution reveal allowed, no stakes.
- **Assessment mode:** frozen version + seed, hints/solution withheld, full audit trail, deterministic replay, exportable evidence + rubric result.

This is the key architectural idea the old product missed: **learning and hiring are two modes of one exercise, not two separate products.**

---

## 6. Scope

### 6.1 In scope for the product (across phases)
- **Student lab** experience: trade selection → exercise ladder (1–10) → guided simulation → feedback/progress.
- **Employer/assessment** experience: choose exercise + difficulty → assign to candidate → candidate completes → employer receives evidence-backed result.
- **PLC trade module** as the flagship, built on the salvaged engine.
- **Multi-trade architecture**: a trade-module contract so CCTV, BMS, phone/PC, electronics can be added.
- **Exercise + rubric + evidence formats** (versioned, open).
- **Hybrid 2.5D UI** with targeted 3D.
- **Offline-friendly, low-spec-tolerant** browser delivery.

### 6.2 In scope for v1 specifically
- Rebuilt **shell + navigation + two-audience entry** (Student / Employer).
- **PLC exercise ladder: a real 1–10 progression** mapped onto the existing engine's capabilities (ladder editing, wiring, fault diagnosis, commissioning, scan debugging).
- **Redesigned, approachable UI/UX** (the core fix).
- **Local-only assessment flow:** employer configures/selects an exercise and shares it via an exported link/file; candidate completes it and the result/evidence is exported back. (No accounts yet.)
- **Trade-module contract** defined and PLC implemented against it (even if PLC is the only trade in v1).

### 6.3 Deferred (later phases, designed-for-now)
- **Accounts, organizations, and a backend** (employer/candidate logins, assignment, stored results) — likely Supabase. The data model and flows are designed in this PRD so v1 doesn't paint us into a corner.
- Additional trade modules (CCTV, BMS, phone/PC, electronics).
- Cohort/classroom management, analytics dashboards.
- Payments/billing.
- Anti-cheat hardening for high-stakes remote assessment.

### 6.4 Explicitly out of scope
- Controlling real hardware; being a safety-rated controller; certification claims.
- Cloning a specific vendor's IDE.
- Photorealistic physics for every machine.
- Claiming full IEC 61131-3 / electrical-standards conformance without independent verification.

---

## 7. Experience requirements (fixing the "0/10" UI/UX)

The previous UI failed because it exposed the engine's internals (sidebars of 16 tools, I/O tables, forms) instead of guiding a human through a task. Requirements:

### 7.1 First-run & navigation
- **A clear front door that forks by audience:** "I'm learning" (Student) vs "I'm hiring / testing someone" (Employer). This split must be obvious within 5 seconds.
- **Trade picker** that visibly shows PLC available now and the other trades as "coming soon" (sets the multi-trade expectation).
- **The 1–10 ladder as the primary learner surface** — a visual progression, not a flat list of 16 menu items.

### 7.2 In-exercise experience
- **Guided task framing:** work-order brief, clear objectives checklist, and current-step guidance always visible.
- **A simulation canvas as the star**, not a side panel. Devices are visual and manipulable; the canvas uses the hybrid 2.5D approach with targeted 3D (e.g. a running conveyor, a filling tank).
- **Progressive disclosure:** advanced instrumentation (scan debugger, watch tables, raw I/O) is available but tucked behind clear affordances — never the first thing a learner sees.
- **Immediate, legible feedback:** when something is wired/programmed correctly or not, the user sees it in the simulation, not only in a table.
- **Safety and consequence are visible** (isolation before wiring, E-stop behavior) — modeled and explained.

### 7.3 Assessment experience
- **Candidate view:** calm, focused, "exam-like" — brief, canvas, submit. No hints, no clutter.
- **Employer result view:** a human-readable report — pass/fail, rubric breakdown, timeline of what the candidate did, safety flags, and replay.

### 7.4 Quality bar
- Approachable, modern, consistent visual design; fast; responsive down to a tablet; accessible (keyboard, reduced-motion, no-WebGL fallback). Mobile phone is "viewable," not the primary authoring surface.

---

## 8. Architecture direction

> Detailed technical design lives in `docs/product/ARCHITECTURE.md` (to be updated to match this PRD). This section sets direction.

### 8.1 Layers
1. **Simulation engine (keep & refactor):** the existing deterministic PLC/electrical/machine engine under `src/engineering/*`, `src/core/`, `src/engine/`. This is salvaged. It may be reorganized and have a cleaner public API, but its logic and tests are assets.
2. **Trade-module layer (new contract):** each trade implements a defined interface — its device catalog, its scene model, its exercise definitions, and its rubric evaluators. PLC is the first implementation and the reference.
3. **Exercise runtime (new):** loads an exercise definition, instantiates the environment + seed, runs it in Student or Assessment mode, captures evidence, evaluates the rubric.
4. **Experience layer / shell (rebuild):** the two-audience app — front door, trade picker, 1–10 ladder, in-exercise UI, assessment flows. This is where most of the rebuild effort goes.
5. **Persistence boundary (designed now, local in v1):** a clean interface for "store/retrieve exercises, assignments, results." v1 implements it with local storage + import/export; a later phase implements it with a real backend (Supabase candidate) **behind the same interface.**

### 8.2 Why this shape
- It makes the salvage decision real: the engine sits under a stable contract while we rebuild everything above it.
- It makes "PLC first, multi-trade later" true by construction: a new trade is a new module, not a new app.
- It makes "backend later" safe: the experience layer never talks to storage directly, so adding accounts/server later doesn't require rewriting flows.

### 8.3 Likely stack
- Keep: TypeScript, React, Vite, React Three Fiber/Three.js (for the targeted 3D), Vitest.
- Rebuild the shell with a clear design system.
- Later backend: Supabase (auth, Postgres, storage) is the leading candidate — confirmed when we reach that phase.

---

## 9. Phased roadmap

Each phase ends with something demonstrable and usable.

| Phase | Goal | Key deliverables | Done when |
|---|---|---|---|
| **0 — Reset & foundations** *(current)* | Shared direction + clean base | This PRD, handover/checklist, repo cleanup, engine audit, trade-module + exercise-definition contracts drafted | Owner signs off on PRD; engine's usable surface is documented |
| **1 — New shell & first great exercise** | Prove the new UX on one exercise end-to-end | Two-audience front door, trade picker, redesigned in-exercise UI, **one polished PLC exercise** (the "conveyor won't start" reference) in both Student and Assessment mode | A stranger can learn *and* be tested on one task with no instructions |
| **2 — The PLC 1–10 ladder** | A complete flagship trade | All 10 ranked PLC exercises authored on the engine, with rubrics, hints, and evidence | Learner can climb 1→10; interviewer can pick any rank |
| **3 — Local assessment flow** | Hiring pillar, local-only | Employer selects/configures an exercise, exports an assignment link/file; candidate completes; evidence/result exports back; employer report view | An employer can test a candidate without accounts |
| **4 — Second trade** | Prove multi-trade | A second trade module (CCTV *or* electronics — TBD) with a starter ladder, validating the contract | A non-PLC trade ships with no engine/shell forks |
| **5 — Backend & accounts** | Real hiring platform | Supabase auth, employer/candidate accounts, assignment + stored results behind the existing persistence interface | Employer assigns online and sees results in-app |
| **6+ — Scale** | More trades, cohorts, analytics, billing | BMS, phone/PC, remaining trades; instructor cohorts; dashboards | — |

---

## 10. Success measures

**Learner (lab):**
- A first-time user completes a level-1 PLC exercise with no external help.
- Measurable progression through the 1–10 ladder.

**Employer (assessment):**
- An interviewer can assign and interpret a practical test in under 10 minutes without training.
- The result report is specific enough to inform a hiring decision (not just a number).

**Platform:**
- Adding a new trade requires only a new trade module (no shell rewrite).
- Backend can be introduced without rewriting experience-layer flows.

**Quality:**
- "Usability" is the headline metric this time — the old product's failure mode. Target: new users understand what to do without a manual.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Rebuilding the shell drifts into rebuilding the engine too | Freeze the engine behind a documented contract early (Phase 0); only refactor its public surface, not its logic. |
| "Multi-trade" ambition dilutes PLC quality | Phase gate: PLC ladder (Phase 2) must be excellent before Phase 4's second trade. |
| 2.5D/3D scope creep | Hybrid-fidelity principle: 3D only where it demonstrably helps; 2D/isometric is the default. |
| Backend deferral creates rework | Persistence interface defined in Phase 0; v1 local impl and later server impl both sit behind it. |
| Assessment integrity (cheating) for remote hiring | Deterministic seeds + full evidence/replay now; harder anti-cheat is an explicit later phase, not a v1 promise. |
| Over-claiming realism/safety | Keep the honest "educational simulation, not safety-rated/certified" framing from the start. |
| Repo churn returns (70+ report files) | New working style: fewer, meaningful docs; cleanup in Phase 0 (see handover/checklist). |

---

## 12. Assets / images needed (for you to source)

You offered to get images — here's what will be needed, described. (Nothing blocks the PRD; these are for the rebuild.)

1. **Trade icons** (set of 5, consistent style): PLC/industrial automation, CCTV camera, BMS/building controls, phone & PC repair, electronics/circuit board. Flat, modern line-or-solid icons on transparent background, ~512×512.
2. **PLC device sprites/models** (for the 2.5D canvas): conveyor belt, electric motor, contactor, push-buttons (start/stop/E-stop), sensor/photoeye, PLC rack, terminal block, lamp/indicator, multimeter. Clean isometric illustrations or simple 3D-ready glTF — top/front consistent angle.
3. **Front-door hero imagery:** one image/illustration conveying "hands-on practice + hiring" (e.g. a person at a virtual bench). Optional; can be abstract.
4. **Reference photos (not for shipping, for accuracy):** real photos of a PLC panel, a wired 24V control circuit, a conveyor sorter — so device visuals look credible to practitioners.
5. **Brand:** if you have a name/logo direction (see §13), any logo files.

> For each, tell me the real-world device and I can also specify exact dimensions/format when we build the canvas. Where licensing matters, we'll track provenance (the repo already has a license-provenance discipline worth keeping).

---

## 13. Open decisions (need your input, not blocking the PRD)

1. **Product/brand name.** ✅ Decided: **EFO Skill Lab** (6 November 2026). The GitHub repo is still named `School-of-scammers` (a jab at the prior dev) — rename it in GitHub settings when convenient; it doesn't affect the product.
2. **Second trade (Phase 4):** ✅ Decided — **CCTV install** (starter ladder ranks 1–5 shipped; ranks 6–10 planned). Electronics/BMS/phone-PC remain future trades.
3. **Backend choice confirmation (Phase 5):** Supabase assumed — confirm when we get there.
4. **Monetization model** (later): free lab + paid employer assessments? Per-seat? Not needed now, but it influences account design in Phase 5.

---

## 14. Relationship to existing repo docs

- **Superseded:** legacy PRD v2 and roadmap v2 → moved to `docs/product/archive/` (kept, not deleted).
- **Still useful:** `docs/product/COMPETITOR_AND_MIT_REVIEW.md` (competitor benchmarks — Factory I/O, Controls Trainer, etc.), `docs/product/ARCHITECTURE.md` (to be updated to match this PRD), the QA protocols in `qa/`, and the license-provenance docs.
- **To be archived/cleaned:** ~70 `*_INCREMENT_REPORT.md` files in the repo root — kept per your instruction, but moved into an archive folder so the repo root is legible. See the handover checklist.

---

*This PRD is a living document. It reflects the product owner's vision as of the reset and the four foundational decisions above. Changes go through the owner.*
