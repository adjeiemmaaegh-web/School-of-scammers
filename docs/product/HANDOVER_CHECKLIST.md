# Handover & Checklist — Developer Takeover

> **Purpose:** Capture project state and track the work. **Current direction is PRD v4** — see the pivot note below.
> **Date started:** 6 November 2026.

---

## ⭐ DIRECTION CHANGE — 6 Nov 2026 (read this first)

After reviewing the shipped product against **Cisco Packet Tracer / GNS3** (the owner's inspiration) and working in **Siemens TIA Portal + Factory I/O**, the owner redefined the product. The build so far is a strong **guided-exercise / employer-assessment** app, but for *students* it behaves like a **quiz**, not a **simulation environment**.

**New direction (PRD v4 — `docs/product/PRD.md`):** a comprehensive, open, browser-based **virtual industrial-automation simulator** — build a control system from a component library, wire it, program the PLC (Ladder/FBD/ST), press Run, and a deterministic scan engine drives a live plant you can observe and troubleshoot. "Packet Tracer for industrial automation," with TIA-Portal programming depth and Factory-I/O plant interaction.

**Status of the two products:**
- **Shipped v3 (exercise ladders + employer assessment)** — *retained and live* at `plc-skills-lab.vercel.app`. Kept for the employer audience; becomes an **assessment *mode* on the sandbox** in roadmap phase **P6**. Its PRD is archived at `docs/product/archive/PRD_v3_exercise-assessment.md`. **Do not delete it.**
- **New sandbox simulator (PRD v4)** — the primary direction; **P0/P1 first 3D vertical slice implemented on feature branch, automated CI green; review and real hardware/browser-specific 3D acceptance remain open**. The salvaged engine (`src/core`, `src/engine`, `src/engineering`, 536 tests) is the foundation — see the PRD §11 salvage map.

**New docs for co-developers (this session):**
- `docs/product/PRD.md` (v4) · `docs/product/ARCHITECTURE.md` (v4) · `.claude/skills/automation-platform/SKILL.md` · root `CLAUDE.md`.

**v4 roadmap (runnable each phase):** P0 foundations & contracts → **P1 first vertical slice (start/stop motor: place→wire→program→Run through the full tick loop)** → **UX/UI-first workbench review (new owner-approved gate)** → P2 programming depth → P3 plant & devices → P4 electrical & panel → P5 faults & diagnostics → P6 learning/assessment on the sandbox (re-host v3) → P7+ realism (FBD, PLCopen, Modbus/external runtime, HIL).

**Revised owner decisions (6 Nov 2026):** real interactive 3D from P1 (replaces 2.5D-first), Ladder-first, and start/stop motor latch first. The owner explicitly excludes backend work for these versions. P0/P1 code lives on `feat/p0-p1-sandbox-foundation`; it is not merged, accepted, or deployed. Next: run `npm run verify:full` and a real browser play-through on the branch, inspect failures, then review before merging.

---

## Product direction correction (7 November 2026): simulator first

Owner correction: the **simulator is the primary product**; Learn & Practice and Assessments are separate, secondary sections; remove single-instance and fixed-workcell limits through a generalised component and signal model; build a complete user-authored multi-device scenario from an empty project. Evidence-based audit and ordered plan: [AUDIT_SIMULATOR_FIRST.md](AUDIT_SIMULATOR_FIRST.md). Done so far (branch `engineering/p9-simulator-first`): simulator-first home and primary navigation, `/learn` and `/assess` hubs, with a real-browser check. Next: generalised plant model, configurable PLC I/O and new equipment, FBD, unify the `/labs` engines, and the empty-project scenario test.

## Sandbox breadth slice 2 — editing a plant (7 November 2026, DRAFT)

Branch `engineering/p8-edit-plant`, stacked on `engineering/p7-multi-plc` (PR #20). Remove a device (full cleanup, first-PLC promotion), one-click pre-wired starter panels, Undo, Delete key; fixed the toolbar sliding behind the app header. 19 new mutation-checked unit tests and a real-browser E2E. Details and limits: [SANDBOX_BREADTH_PROGRESS.md](SANDBOX_BREADTH_PROGRESS.md).

## Sandbox breadth slice 1 — several PLCs and panels (7 November 2026, DRAFT)

Branch `engineering/p7-multi-plc` from `main` (which now contains P0–P6 via PR #19, deployed to production). Details, design rules and limits: [SANDBOX_BREADTH_PROGRESS.md](SANDBOX_BREADTH_PROGRESS.md). Up to 6 PLCs and 6 supplies; per-PLC Ladder/ST programs; per-device state; isolated supplies; PLC tabs, two-panel layout and per-device status in the UI. Evidence: 39 new unit tests (mutation-checked), a real-browser E2E, 749 unit tests total. **Limits:** plant devices and protection are still single-instance; a short de-powers every PLC; alarms/scan trace follow the first PLC; no inter-PLC network. Owner direction: the sandbox ("Packet Tracer for PLCs") is the priority; the interview side is on hold.

## P6 scenarios on the sandbox — first slice (7 November 2026, DRAFT)

Continues on `engineering/p5-faults-diagnostics` (unmerged, `main` still `6bf6fdd`). Delivered (details and limits in [P6_SCENARIOS_PROGRESS.md](P6_SCENARIOS_PROGRESS.md)): `src/exercises/` (scenario type, headless outcome grader built on the real `tick()`, evidence helpers, four-scenario catalogue), the **Work order** panel and scenario hosting in `SandboxPage` (starter load, resume after reload, evidence trail, answer-revealing helpers hidden), `/scenario/:id` practice route, sandbox scenarios on `/trade/plc`, employer assignment of scenarios, and candidate exam conditions returning the existing result code. Evidence: 38 mutation-checked unit tests (`tests/p6-scenarios.test.ts`) and a three-part real-browser E2E (`scripts/sandbox-p6-scenario-browser.cjs`, wired into CI after the P5 sensor step). **Honest limits:** the result code is unsigned and frontend-only, so assessment integrity is honour-system; four scenarios, not a ten-rank catalogue; the v3 exercise state machines are untouched; no owner visual review of the Work order panel; no Windows Edge, low-spec or real-GPU run. CI: [run 42365917887](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42365917887) (manual dispatch on `9ae6b4e`) succeeded including the P6 E2E, bundle budgets and accessibility; two earlier dispatches failed on the bundle budget and a test typing error and were fixed (run `node scripts/check-performance-budgets.cjs` after building; `verify:full` does not). P6 full exit is INCOMPLETE.

## P5 faults & diagnostics — branch review and first slice (7 November 2026, DRAFT)

**Where the work stood.** `main` is still the v3 app plus docs (`6bf6fdd`); none of the sandbox work is merged. It lives on a **stacked chain of unmerged draft branches**, each based on the previous: `feat/p0-p1-sandbox-foundation` (#14) → `design/ux-first-3d-workbench` (#15) → `engineering/p2-plc-programming` (#16) → `engineering/p3-3d-conveyor-sorting` (#17) → `engineering/p4-electrical-panel` (#18, the tip). P5 continues from the P4 tip on **`engineering/p5-faults-diagnostics`** (also draft and unmerged). The older `feat/*-2026110x` branches are the previous developer's and are not part of this chain.

**Baseline checked independently** on the P4 tip (clean `npm ci`, Node 22, headless Chromium): typecheck clean, 619/619 unit tests, `verify:full` green, and 7 of the 8 sandbox browser scenarios passing first time.

**Defect found and fixed: the flaky P4 reversing browser test was a real UI race.** `sandbox-p4-reversing-browser.cjs` failed roughly 1 run in 3 at the final "Forward lamp lit" wait. A command log captured from a failing run showed the UI sending `operate pressed:false` twice in 24 ms, when the second click was meant to press. The UI built `pressed = !c.pressed` from its last worker snapshot, which is stale until the next ~50 ms scan, so two quick clicks sent the same value and a press was lost. That also broke the rule that the UI must not derive truth from snapshots. Fix: new command **`operateToggle`**, resolved by the worker against authoritative state in command order; all three UI call sites (patch panel, 3D label, inspector) use it. `operate { pressed }` is unchanged. Tests: `tests/sandbox-operate-toggle.test.ts` (8). Result: the reversing scenario passed **15/15** consecutive runs after the fix. **Do not compute a button's next state from a snapshot in new UI code.**

**P5 slice delivered (see [P5_FAULTS_PROGRESS.md](P5_FAULTS_PROGRESS.md)).** First-class, seeded, optionally hidden faults (open conductor, open contactor coil, welded contacts, open motor winding, stuck pushbutton, and stuck photoeye or level-probe outputs that make a sensor lie to the PLC) that change what the circuit solver sees, symptom-only supervisory alarms with an active/cleared history, a *Replace a part* repair action (paused only, neutral log), and a Troubleshooting panel in the Test stage. Faults are saved in the optional `ProjectFile.faults`; legacy v1 projects load unchanged. Evidence: 45 fault unit tests (32 + 13 for sensors, both mutation-checked), two real-browser E2Es (each 10/10 stable), 672/672 unit tests and all ten sandbox browser scenarios locally. **CI:** GitHub Actions only runs on pushes to `main`, pull requests into `main`, or manual dispatch, so a plain branch push runs nothing. I dispatched `ci.yml` by hand on the branch. Before the sensor faults: [run 42334198337](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42334198337) on `f60ce7f` **succeeded**, including the new P5 E2E, the P4 reversing E2E, bundle budgets, offline, accessibility, no-WebGL and the Linux Firefox/WebKit smoke. With the sensor faults: [run 42362095139](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42362095139) on `2162117` also **succeeded**, including the sensor E2E. The Windows Edge workflow was not run, and any later commit on this branch is documentation only. Real low-spec Windows 3D, full cross-browser WebGL and owner review remain open. P5 full exit is INCOMPLETE.

**Running the browser scripts locally (cloud sandbox or any machine without Puppeteer's browser download).** Build, serve `npx vite preview --host 127.0.0.1 --port 4173`, then:

```bash
PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-save --no-audit --no-fund puppeteer@24.31.0 axe-core@4.10.3
PLC_BASE_URL=http://127.0.0.1:4173 PUPPETEER_EXECUTABLE_PATH=/path/to/chrome node scripts/sandbox-p5-faults-browser.cjs
```

Caveat: in the cloud sandbox's pre-installed Chrome 153 (Puppeteer 24.31 targets an older Chrome), `scripts/browser-acceptance.cjs` fails 6/6 at a click on `/engineering` ("Node is either not clickable or not an Element"), and fails identically on the untouched P4 tip, yet it passes in CI. The target button sits about 1900 px below the viewport, so this looks like a Puppeteer/Chrome version mismatch rather than a product defect (the exact mechanism was not verified). Treat CI as the authority for that script; the sandbox and P5 scripts are unaffected.

**Suggested next steps:** add faults for the diverter, drain valve and pneumatics; add alarms for sensor and tank symptoms (for example tank overflow), plus overload/breaker and feedback-mismatch alarms; tie an execution-trace export to a fault session; then P6 (scoring repairs, re-hosting the assessment mode). Before relying on any browser script as a gate, run it several times in a row: one of the existing ones was only passing by luck.

---

## Current P0/P1 implementation and verification (6 November 2026)

Development branch `feat/p0-p1-sandbox-foundation`; draft review PR #14. **Owner revised 2.5D-first to genuine interactive 3D from P1**. The public-facing sandbox is a real Three.js/React Three Fiber workbench with original low-poly 3D devices (supply, PLC, START/STOP, contactor, ideal DC motor), projected drag-to-place, 3D terminal hit targets, actual 3D cable geometry, camera orbit/pan/zoom, motor fan rotation derived from the authoritative scan clock, and an accessible browser-local patch panel/fallback. The saved project coordinate format remains compatible with the earlier JSON format. The deterministic PLC and 24V circuit computations still execute only in `src/sim/orchestrator.ts` (Web Worker); nothing about the renderer proves certified PLC or real machinery physics. Existing v3 guided exercises and employer assessments remain unchanged. No backend, account or cloud features were introduced.

**Evidence for application code commit `07f10396b1b37e97c2804ed44f185ac4dea774b2`:** GitHub Actions Linux run `42275581892` passed all gates, including **544/544 Vitest tests**, semantic TypeScript, Vite production build, compressed bundle budget, real WebGL-backed Chrome sandbox test (3D palette drop, 3D terminal connection, user-editable Ladder latch, motor behavior, wrong logic, broken wire), retained engineering/assessment Chrome smoke, offline routes, WCAG-selected automated accessibility, no-WebGL/4× CPU-throttle fallback, Firefox legacy smoke and WebKit legacy smoke. Windows run `42275581656` passed compilation and Edge legacy smoke. **The Windows hosted Edge runner could not provide WebGL; a genuine 3D Edge test was NOT verified.** Firefox and WebKit tests covered the existing application, not full 3D workspace hardware acceptance. Real 8GB Windows devices, physically observed 3D interactions/low-end performance, and owner review are still unverified. A Vercel review preview is auto-generated for the feature branch; this is not production acceptance or merge authorization.

**New UX/UI-first increment:** branch `design/ux-first-3d-workbench`, draft PR #15, based on the unmerged P1 branch. Deliverable includes `docs/product/UX_WORKBENCH_V1.md`, full-screen engineering hierarchy, Build/Wire/Program/Test shortcuts, device library search, contextual snapshot-only inspector, responsive presentation, and dedicated browser UX checks/screenshots. These changes are UI-only and are **not accepted** until owner visual review and the latest feature-branch checks. Do not merge PR #15 before PR #14 is reviewed and approved.

**Release status:** REVIEW / NO-GO for merging to `main` until owner review and any required remaining real-device / graphics browser gates are resolved. Do not imply feature/accuracy parity with Factory I/O. Next practical task after P1 review is expanding the device library and PLC programming depth under the 3D-first roadmap, keeping all functionality frontend-only.

## P2 programming continuation (owner-authorized source work; review-only)

After the owner approved proceeding from the UX-first prototype, P2 source work started on branch `engineering/p2-plc-programming`, draft PR #16, stacked on unmerged UX PR #15 and 3D PR #14. It retains the 3D workbench and both assessment/exercise routes with **no backend**. The actual PLC worker now runs either (1) a multi-rung LadderDocument (up to eight networks, local BOOL tags, timers, CTU and edge operations) or (2) compiled bounded Structured Text, with a single physical output mapping to Q0.0. The ST AST is compiled on language activation, cached in worker state, and re-used across scans. Worker-published tag values, per-rung memory, real editor feedback and an after-scan breakpoint feed the approved programming/diagnostics interface. Old `formatVersion:1` JSON remains importable.

Program and UI evidence: `tests/sandbox-p2-programming.test.ts` covers wired motor behavior under TON, CTU and ST, case-insensitive ST `Run`, malformed programs, scan breakpoints and legacy projects. `scripts/sandbox-p2-browser-acceptance.cjs` creates the 11-wire circuit in a browser, edits two Ladder rungs and a real TON, then compiles/runs ST and arms a real worker breakpoint. `docs/product/P2_PROGRAMMING_PROGRESS.md` lists the explicit remaining P2 features; **this is a bounded increment, NOT full P2 exit.** New program semantics do not imply IEC 61131-3 fidelity, certified safety, or physical equipment acceptance. CI evidence must be recorded for the final commit before acceptance.

The developer has not merged PR #14, #15 or #16 or promoted an external deployment. Owner review, real WebGL/low-spec physical Windows and complete P2 feature gates remain open.

### Next P2 implementation — typed numeric PLC (7 November 2026)

Owner requested continued engineering on the same **draft PR #16**, with PR #14 (3D) and #15 (UX) still unmerged. The authoritative `engineering/ladder.ts` runtime now holds bounded local `INT`, `DINT`, and `REAL` numeric registers alongside BOOL tags, applying MOV, ADD, SUB, MUL, DIV and six comparisons in actual top-to-bottom scan order. The numeric instruction editor in `src/program/NumericInstructionControls.tsx` and `src/program/LadderEditor.tsx` uses the approved workbench. Values persist in the worker between scans and are visible in online monitoring and scan trace. Numeric tags cannot be used as Boolean contacts/coils; missing operands, invalid initial values and arithmetic faults are rejected. Overflow and division by zero pause and deenergize simulated outputs.

Evidence added: `tests/sandbox-p2-numeric.test.ts` exercises typed registers through the *real* wired motor and validates overflow, invalid tags and legacy compatibility. `scripts/sandbox-p2-numeric-browser.cjs` creates the 11-wire circuit in headless Chrome, programs INT + ADD + numeric comparator from the UI, observes the motor follow the threshold, and verifies that an unreachable threshold leaves it stopped. The original 3D, UX and P2 browser flows are unchanged; `.github/workflows/ci.yml` now gates numeric browser acceptance separately. **Current verification:** Linux run [42298005285](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42298005285) passed TypeScript, all unit tests, production build, bundle budgets, Chrome P1/UX/P2 and numeric E2E, accessibility, offline smoke and no-WebGL functionality. Firefox/WebKit installer/tests were still executing at this writing. Windows run [42298005243](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42298005243) passed compilation; hosted Edge smoke was not yet complete when recorded. Final full-CI status must be reviewed before any acceptance claim.

**Open:** physical analog mapping, more advanced PLC function blocks/typed addressing, physical low-spec Windows 3D/WebGL acceptance, owner product review and draft-PR dependency review. No backend, cloud, account service, payment, merge, or commercial release approval.

## P4 second continuation — physical dual-contactor 24V reversing workcell (7 November 2026)

Latest source **`engineering/p4-electrical-panel`**, still draft [PR #18](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/18), stacked on unmerged #14–17. This increment adds a genuine 21-wire 3D **forward/stop/reverse** educational exercise: original reversible motor F+/R+/M−, momentary reverse-request button, forward and reverse contactors each with 24V A1/A2 coil, NO 13/14 and NC 21/22 auxiliary, cross-connected NC coils, PLC I0.4 ReverseRequest and Q0.4 Forward/Q0.5 Reverse. `reversingProgram()` supplies an editable bounded Ladder example; bounded ST Forward/Reverse BOOL outputs use exactly the same terminals. A modeled mechanical interlock prevents both contactors from closing when unsafe user code commands both coils; incorrectly powering both motor direction terminals inhibits movement. The worker owns signed shaft rotation/direction events; renderer has no separate physics. V1 offline JSON and all P1–P4 prior scenarios remain supported. A new `Place reversing DOL layout` starts **unwired**, with visible direction/interlock status and text patch controls for keyboard/no-WebGL. These are simplified **24V teaching components, NOT three-phase industrial starters, certified electrical/safety interlocks, or safety-rated E-stops**.

Native `tests/sandbox-p4-reversing.test.ts` covers forward→stop→reverse, two-button inhibit, physically missing NC links, deliberately unsafe both-coils Ladder program, invalid double motor feeds, emergency stop, bounded ST, project validation and repeatable playback. Chrome E2E `scripts/sandbox-p4-reversing-browser.cjs` builds and wires all **21 actual connections** and verifies direction, stop, wrong requests, E-stop and a removed NC interlock link. `.github/workflows/ci.yml` includes this after earlier P4 and before offline/a11y/no-WebGL/Firefox/WebKit checks. The new code initially surfaced a missing reserved Ladder input `ReverseRequest`; this was fixed. The 618/618 native tests and TypeScript/build were green, but CI exposed a ~1.1KB overage in the existing **120 KiB landing gzip budget**; `src/app/App.tsx` now lazily loads the entire `/sandbox` route to keep that budget intact without increasing any threshold. [Implementation CI 42326367072](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42326367072) was still running at time of this note; verify its final status and subsequent latest-head runs before claiming full green.

**Remaining:** real 3-phase reversing and star–delta, rated contactors/thermal/current physics, analog/current measurement, interlock and emergency-stop standard compliance, full P4 QA, P2/P3 open scope, real low-spec 8GB Windows 3D/Edge, full WebGL Firefox/WebKit, owner visual review. Production/no-go restrictions unchanged. No backend, cloud, account, payments, external deployment, live machinery or merge is authorized.

## P4 continuation — latching training E-stop and breaker reset guard (7 November 2026)

This is the **newest P4 source checkpoint** on `engineering/p4-electrical-panel`, draft PR #18; it supersedes the first nine-device/15-wire DOL checkpoint described below without erasing its QA history. `src/components/registry.ts`, the existing electrical graph and `src/sim/orchestrator.ts` now integrate a **latching NC training E-stop** A/B as a real power-path element (press=open, manual reset=closed). Its actual downstream supply break can depower the PLC/contactor without a renderer-driven shortcut; it is **not** a safety-rated or certified E-stop. The P4 template has **10 components and 16 manually patched wires**, with a real motor, overload NC auxiliary, contactor and pilot lamp. The voltage meter still derives all readings from the authoritative Worker. A breaker reset is now refused if the directly shorted branch remains connected, without executing a hidden PLC scan while paused.

Preserve **physical/logic separation**: overload trip opens 95-96 in the contactor-coil circuit but does not modify the user program or its retained PLC `Run` memory. An insecure seal-in program can therefore **restart the motor when the overload is reset**; teach this as a commissioning hazard instead of silently fixing it. `tests/sandbox-p4-panel.test.ts` now checks the ten-device DOL, E-stop, upstream vs downstream short, reset refusal/recovery, actual meter polarity, orphan endpoints, project v1 validation and deterministic replay; the existing `tests/sandbox-p4-electrical.test.ts` is retained. The updated `scripts/sandbox-p4-panel-browser.cjs` actually connects the 16 wires, runs and trips motor/lamp, measures 24V, operates E-stop and overload, injects the protected short, checks reset refusal, removes the wire and restores operation. Chrome P1/P2/P3 tests remain in CI.

**Implementation CI:** [Linux workflow 42324166062](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42324166062) passed source/TypeScript, Vite bundle, the unit suite, P1–P4 Chrome E2E, offline, accessibility and CPU/no-WebGL steps; Firefox/WebKit were still executing when recorded. [Windows hosted 42324166093](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42324166093) passed. Recheck the latest documentation-only commit's CI before any full-green claim. Physical low-spec Windows WebGL/Edge, full P4 Firefox/WebKit 3D interaction, actual protection physics, forward/reverse/star-delta and independent owner visual acceptance **remain open**. P4 full exit and commercial release are **NO-GO/INCOMPLETE**. All PRs #14–18 remain draft, unmerged, and no external actions are authorized.

## P4 protected electrical panel — development continuation (7 November 2026, DRAFT)

The owner authorized advancing from P3 into **P4 — Electrical & Control Panel**, without claiming earlier stages fully accepted or merging their work. Latest source branch: `engineering/p4-electrical-panel`, draft PR **#18**, based on P3 PR #17, P2 PR #16, UX PR #15 and 3D PR #14. All remain review-only and unmerged. **No backend, cloud, authentication, payments, production deployment or physical machinery authorization.**

Implemented first bounded P4 vertical slice: original 3D 24V branch breaker (IN/OUT), manual-trip overload NC auxiliary (95/96), real 24V pilot lamp (L+/M-), and an authoritative worker-based dual-lead signed DC meter with measured/floating/short states. The true source-of-truth remains `engineering/electrical.ts` ideal graph solver. `src/sim/orchestrator.ts` compares a directly shorted circuit before/after opening the breakpoint, trips the breaker only for a **downstream-isolatable** short, and updates the PLC and actual loads from that resolved graph. Manual overload trip drops the actual contactor coil while the PLC Run program may remain latched; it is not thermal/overcurrent physics. `src/app/SandboxPage.tsx` adds a 9-device **Place protected DOL layout**, manually wired 15-terminal lesson, protection trip/reset controls and a two-probe meter available even when paused or WebGL unavailable. The original P1/P2/P3 scenes, editable programs, offline v1 project files, existing exercises and employer assessment remain intact.

New `tests/sandbox-p4-electrical.test.ts` covers actual motor/lamp/contactor behavior, fused downstream vs. unfused upstream shorts, manual overload, meter polarity/open/short, invalid imported duplicate protection, reset/reproducibility. New `scripts/sandbox-p4-panel-browser.cjs` genuinely wires 15 terminals in Chrome and checks motor/lamp, 24V measurement, overload trip, downstream short and recovery. The first P4 implementation run passed TypeScript/Vite/bundle and **598/598 Vitest** tests across **81 files**, and all previous browser scenarios. Initial P4 browser E2E exposed a **test timing error**: attempting to remove the intentionally shorted wire before the Worker finished pausing; the test now waits for the paused Run toolbar. Final CI must be checked and reported in [PR #18](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/18) before claiming the entire engineering increment verified. Previous P3 [Linux run 42308634492](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42308634492) and [Windows Edge 42308634603](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42308634603) passed on P3.

**Still open:** complete P4 forward/reverse, star-delta, certified E-stop, current-rated protection curves, broad panel devices, calibrated instruments, full electrical simulation, physical target Windows/low-spec WebGL, full cross-browser 3D P4 interaction, owner UX acceptance, and all tracked P2/P3 gaps. No claims of Factory I/O/TIA Portal parity or actual industrial electrical/safety engineering. P4 full stage and production release are **NO-GO/INCOMPLETE**.

## P3 3D plant and sorting continuation — November 2026 (REVIEW / NO-GO)

The owner authorized moving from ongoing P2 development into P3 engineering without merging earlier drafts or claiming full P2 acceptance. New branch `engineering/p3-3d-conveyor-sorting`, draft PR **#17**, is based on P2 branch/PR #16 (itself stacked on UX PR #15 and P0/P1 PR #14). All remain **unmerged**, existing v3 exercises/employer assessment preserved, and **no backend**.

Working P3 vertical slice: original low-poly Three.js 24V conveyor, powered mark photoeye and solenoid diverter with actual terminal wiring, 3D carton movement from worker state, manually fed marked/plain parcels, one station, geometry-aware sensor and downstream gate, I0.2 Photoeye and Q0.1 Sort PLC tags, editable Ladder sorting example and optional ST output. Sorted accepted/rejected counts and input/output states are worker-published; stop/power removal freezes parcels, wrong logic and wiring alter routing. `src/plant/sorting-conveyor.ts` owns pure fixed-step material handling and `src/sim/orchestrator.ts` remains the only ten-phase scan authority. No change to project `formatVersion:1`.

QA: `tests/sandbox-p3-sorting.test.ts` includes marked/normal routes, wrong program, missing sensor and diverter wiring, misaligned geometry, broken conveyor supply, reset, snapshot isolation, legacy compatibility, ST path and determinism; `scripts/sandbox-p3-sorting-browser.cjs` actually wires 16 nets in Chrome, runs both parcel classes and alters user Ladder. See `docs/product/P3_PLANT_PROGRESS.md`. A source-code CI run passed the 574-unit suite, TypeScript and bundle build, retained P1/P2/UX integration, and the new P3 Chrome sorting E2E; **record final full GitHub Actions run IDs and any remaining Firefox/WebKit/Windows scopes before claiming all CI green**. Physical 8 GB/low-spec Windows 3D, real WebGL Edge, owner visual review, and remaining P3 breadth (pneumatic cylinders/valves, multiple tanks/pipelines, multi-parcel flow, realistic hydraulic and plant physics) remain **open**. Do not merge, deploy, monetize or describe this as Factory I/O parity without separate authorization.

### P3 tank-process engineering continuation — 7 November 2026

Second P3 workcell is built **on the same draft PR #17**, not a separate simulator. A 3D tank, powered inlet pump, high-level probe and drain valve use the existing authoritative 50 ms Worker, idealized 24V netlist and user-authored Ladder/ST. New terminals: PLC I0.3 = `TankHigh`, Q0.2 = `Fill`, Q0.3 = `Drain`. The program genuinely fills the 1000 ml vessel via the electrically wired pump until a 750 ml HIGH switch, then drains through the electrically wired valve until the switch clears below 600 ml. The pump, probe and valve must also be placed near the tank. Original low-poly Three.js liquid/actuator models, accessible gauge/status panel, **Place 3D tank layout**, **Load tank control example**, and keyboard-readable 11-wire terminal map were added. A broken sensor or wrong PLC program produces corresponding incorrect results; physical hydraulics, pressure and real analog I/O are **not** modeled. No backend or project schema change.

New `src/plant/tank-process.ts`, `tests/sandbox-p3-tank.test.ts` (13 targeted tests) and `scripts/sandbox-p3-tank-browser.cjs` (real 11-wire Chrome run, full HIGH/drain cycle, wrong Ladder) extend the existing P1/P2/P3 CI. **587/587 unit tests** across 80 suites, TypeScript, production build, original P1/P2/sorting Chrome scenarios and new P3 tank browser E2E passed on implementation CI. Expanded library (13 devices) required updating the older UX test, and the accessibility audit found a scrollable PLC tag monitor without keyboard focus; the monitor and scan trace now have `tabIndex={0}`. Final head [Linux run 42308446899](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42308446899) and [Windows Edge hosted run 42308446891](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42308446891) were **still executing when this paragraph was authored**; their final status must be verified, never inferred.

P2 advanced engineering, full P3 equipment breadth and full physical/real low-spec Windows, Firefox/WebKit P3 3D interaction, and owner UX approval remain explicitly open. Draft PRs #14–17 unmerged. **No merge, cloud, external deployment, payment, commercial release or real-machinery connection authorization.**

## Earlier progress — v3 product (shipped, retained as the assessment layer)

> **Status:** v3 is complete and live: two trades with full 1–10 ladders (PLC + CCTV = 20 playable exercises), two-audience shell, local employer→candidate assessment with evidence trail, device-art visuals, mobile-ready, branded "EFO Skill Lab". This is the assessment layer referenced above.

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

### Phase 2 — PLC 1–10 ladder ✅
- [x] Ladder progression UI as the main learner surface (`src/app/TradeLadder.tsx`)
- [x] **All 10 ranks authored and playable** — conveyor start, motor seal-in, sensor wiring, timed run-on, batch counting, starter diagnosis (seeded), star–delta, tank level, sorter commissioning, factory acceptance (seeded capstone)
- [x] Each exercise verified headless (correct path → 100% pass, no console errors)
- [x] Covers distinct archetypes: operate/repair, ladder-build, wire/measure, timers, counters, diagnosis, sequencing/interlocks, process protection, commissioning, FAT

### Phase 3 — Local assessment flow ✅
- [x] Employer: select exercise + label, generate assignment (`src/app/EmployerPage.tsx`)
- [x] Shareable assignment link + code
- [x] Candidate completes under exam conditions; result code export (`src/app/CandidatePage.tsx`)
- [x] Employer review of returned result (rubric + evidence)
- [ ] Nice-to-have later: visual replay of the evidence timeline

### Phase 4 — Second trade ✅ (CCTV, full 1–10)
- [x] Second trade chosen: **CCTV install** (owner decision)
- [x] Implemented as a trade module against the contract — **no shell/engine forks** (`src/trades/cctv/`, registered in `registry.ts`)
- [x] **Full 1–10 ladder authored & playable**: camera aiming, cable & termination, IP/NVR, PoE budget, offline diagnosis (seeded), night & IR, storage & retention sizing, multi-camera coverage, bandwidth & stream profiles, system handover (seeded capstone)
- [x] Each verified headless (correct path → 100%); CCTV is available in the picker

### Device artwork ✅
- [x] Reusable, theme-aware SVG device-art library (`src/ui/device-art.tsx`): motor, conveyor, photoeye, stack light, contactor, CCTV camera (bullet/dome), NVR, PoE switch, parcel — with gradients/shading
- [x] Applied to the flagship PLC conveyor scene and the CCTV cable/IP/night/storage/coverage scenes so they read as real equipment
- [x] Note: these are code-drawn SVG assets (no external images needed). Photographic device art per PRD §12 remains optional and owner-sourced if ever wanted.

### Historical v3 Phase 5 — Backend & accounts (SUPERSEDED / OUT OF SCOPE)
- [ ] **Do not build** Supabase, authentication, employer accounts, cloud result storage, or server infrastructure in the current frontend-only versions. These were historical v3 plans; new owner approval would be required.

### Phase 6+ — Scale
- [ ] Remaining trades (BMS, phone/PC, …)
- [ ] Instructor/cohort features, analytics, billing

---

## 5. Open decisions awaiting owner (also in PRD §13)
- [x] **Product/brand name** — **EFO Skill Lab** (decided 6 Nov 2026; threaded through the app via `src/platform/config.ts`)
- [ ] Second trade for Phase 4 (CCTV vs electronics)
- [x] No backend for current versions (owner decision, 6 Nov 2026)
- [ ] Monetization, if ever considered, requires a separate owner decision; no payments/paywalls now.

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
