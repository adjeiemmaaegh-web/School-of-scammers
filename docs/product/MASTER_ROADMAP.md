# PLC Skills Lab / EFO Skill Lab
## Repository-wide architectural review and ONE execution roadmap for Claude

**Review date:** 17 November 2026 (Asia/Dubai)  
**Repository:** https://github.com/adjeiemmaaegh-web/School-of-scammers  
**Production URL reported by project:** https://plc-skills-lab.vercel.app  
**Verified GitHub `main` commit during this review:** `284ba4783225f64b88c1c1d3e5bb1cc314511e55`  
**Status:** Planning and source review; **not** a claim of final software, hardware, educational, legal, or production acceptance.  
**Audience:** Product owner, Claude, reviewers, controls-domain experts, QA.  
**Document authority:** This is the **single future-work roadmap**. Existing P1–P25, UX2–UX5 and historical PR documents describe completed/source-integrated work and evidence; they are NOT a second implementation backlog.

---

# A. Executive verdict

The project is already a serious *development-stage educational simulator*, not an empty repository. Its best asset is a deterministic and inspectable pipeline linking real user wiring and Ladder/ST/FBD logic to an actual Web Worker-run simulated plant. The architecture separates the rendering surface from simulation authority and contains meaningful circuit, plant, assessment, and CI safeguards. The product has evolved through merged P1–P25 factory slices and UX2–UX5 improvements.

**The largest remaining challenge is coherence, trustworthiness, and usability—not generating another collection of machine demos.** The current interface and codebase comprise multiple eras: the modern simulator, old direct `/labs` surfaces, a historical local assessment system, several overlapping device/plant abstractions, and large workbench/orchestrator/render modules. Complete this as one engineering product with durable projects, contextual visual authoring, predictable programming, general-purpose device composition, truthful fault diagnostics, and validated learning flows.

**Release posture: NO-GO for claims of completed industrial engineering equivalence or safety-rated training.** Software workflow evidence is substantial, but physical low-spec Windows testing, independent controls-engineer review, instructor/student validation, licensing/provenance, durability across actual browser failures, and final owner acceptance remain open. No backend, SaaS, cloud sync, authentication, payments, external PLC network access, or autonomous deployment is approved.

## Scope of this review: what was actually verified

**Directly examined through the connected live GitHub repository:** repository metadata and current `main` SHA; recent commit history; PRs #70, #71, #73, #78, #79, #80 and open issue #81; README/CLAUDE.md; v4 PRD and architecture; automation-platform developer skill; handover, simulator-first audit, UX2 roadmap, plant-library brief, P6–P25 archive index, release-readiness register; `package.json`; GitHub CI configuration; and representative current implementation files covering app routing, workbench, Three.js rendering, simulator orchestration, Web Worker, project schema and validation, PLC mapping/runtime, three PLC editors, equipment registries, material-world simulation, scene authoring, wiring and floor-plan views, diagnostics context, assessment probes, and local project storage. Directly inspected implementation sizes include ~1,253 lines for `SandboxPage.tsx`, ~1,290 lines for `orchestrator.ts`, ~896 lines for `Sandbox3D.tsx`, and ~738 lines for `ux2-workbench.css`. These are maintainability warning signs, not evidence of incorrect functionality.

**Not independently performed:** cloning the entire repository into a working development environment, traversing every source/test file line by line, installing npm dependencies, executing Vitest/TypeScript/Vite/browser workflows, opening the actual running UI, device-based performance tests, verifying all GitHub Actions job results at the latest merge commit, or auditing third-party packages with a dependency scanner. The connector exposed file-by-file source, not a complete checkout. Accordingly, any issue outside files directly inspected is a *risk or proposed test*, not a confirmed defect. **Claude's first stage MUST close this evidence gap before code changes.**

**Live provenance links:**
- Main merge commit: https://github.com/adjeiemmaaegh-web/School-of-scammers/commit/284ba4783225f64b88c1c1d3e5bb1cc314511e55
- P1–P25 integration PR #70: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/70
- Assessment/security remediation PR #71: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/71
- UX2 workbench PR #73: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/73
- Combined UX3/UX4 PR #78: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/78
- Latest merged UX5 PR #80: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/80
- **Open** UX6/UX7 issue #81: https://github.com/adjeiemmaaegh-web/School-of-scammers/issues/81
- **Open draft** older UX5 PR #79: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/79
- Release register: https://github.com/adjeiemmaaegh-web/School-of-scammers/blob/main/docs/product/RELEASE_READINESS_2026-11-15.md

---

# B. Non-negotiable product contract

1. **Primary product:** freely explorable, browser-based, 3D-first, offline-capable **industrial automation simulator** comparable in *learning workflow* to a Packet Tracer-style environment; NOT a quiz app, passive 3D demo, vendor clone, production PLC IDE, or certified plant model. Simulator first; Learn/Practice and Assessments secondary and preserved.
2. **Platforms:** desktop/laptop browser and tablet, **minimum 768 CSS-pixel width** for the planned engineering experience. The simulator fills the app viewport and has no outer-document scrolling. Phones below 768px are not a product acceptance target. Keep accessible no-WebGL, keyboard and nonvisual controls.
3. **Frontend-only:** React/TypeScript/Vite/Three.js/R3F with a Web Worker, browser-local storage and import/export; no server-side user accounts, Supabase, database, subscriptions, employer SaaS, cloud synchronization, or payments.
4. **One simulation authority:** UI sends intent commands; `src/sim/orchestrator.ts` owns `tick()` and ordering; electrical solver and deterministic plant models own simulated physics; 3D/2D renderers show immutable worker snapshots. No canned outcomes or visual-only apparent success.
5. **One real user project:** scene, components, terminals, wires, controller I/O, PLC programs, properties, faults, plant state configuration and exercise metadata all refer to the same validated project model. Existing `formatVersion:1` projects remain importable. Runtime state and view preferences must not be conflated with saved engineering state.
6. **Learning truth:** errors, wrong wiring, incorrect code, lost power, false sensors, jammed machines and misplaced components produce measurable consequences. Grading uses real independent worker-driven test cases, required positive preconditions, and reproducible seeds.
7. **Honest physical scope:** simplified 24V, analog and three-phase teaching models are documented per component. No statement that software is safety-rated, physically equivalent to Siemens TIA Portal/Factory I/O, or adequate for field commissioning. Original assets/UI; review all external licenses before distribution.
8. **Preserve legacy:** existing PLC/CCTV ranked exercises and employer/candidate result-code routes, historical `/labs` engines, seeded scenarios, data import compatibility and local assessment records. They may be rehosted or bridged, but must not be silently deleted.
9. **No speculative commits or deployment:** all implementation in reviewed feature branches and PRs; no blind merge, main reset, branch deletion, live hardware commands, production deploy, licensing promises or external system changes without owner approval.

---

# C. Verified inventory, strengths, limits and risks

| Area | Current evidence | Remaining engineering decision / gap | Priority |
|---|---|---|---|
| App/navigation | `App.tsx` includes `/sandbox`, `/learn`, `/assess`, `/employer`, `/take`, `/scenario/:id`, and legacy `/labs/*`; sandbox is lazy-loaded. | Establish one coherent navigation and contextual workbench; keep routes functional. | P0 |
| 3D and layout | `Sandbox3D.tsx` real R3F scene, 3D/2D/logical views, camera tools; UX2–UX5 merged including compact labels and Focus selected. | Issue #81: conflicting toolbars, obscured machine space, panel resizing/focus/touch/keyboard; pixel-accurate owner review. | P0 |
| Catalog | `src/components/registry.ts`, `src/plant/equipment/index.ts`, UX2 PR #73 reports 54 registered kinds; plant registry has multiple original transport, sensor, robot, storage and process models. | Audit every listed kind for real placement, terminal behavior, property editor, render state, tests. Eliminate parallel registry ambiguity. | P1 |
| Simulation authority | 50 ms `tick()` in `orchestrator.ts`, five 10 ms plant substeps in `plant/world/runner.ts`; Web Worker queues commands. | Large orchestrator, first-PLC legacy special case, duplicate legacy mirrors and two plant representations increase regression risk. Refactor behind characterization tests, not by rewrite. | P1 |
| PLCs/I/O | `plcs.ts` up to 6 PLCs; `plc-io.ts` includes classic fixed I/O and configurable 16/16 PLC tags; analog mappings exist. | General I/O expansion, better tag/address configuration, per-device safe semantics, multi-PLC observability, standards coverage. | P1 |
| Programming | Real Ladder editor, bounded ST compiler/editor and bounded FBD engine + `FbdEditor`; program selection lives in `ProgrammingDock.tsx`. | IDE-grade editing and cross-language semantics; undo/redo, diagnostics, instruction coverage, online debugging and safe import/export. Do **not** rebuild FBD from zero. | P1 |
| Wiring/electrical | Terminal-level wires, 24V differential meter, breakers, relays, contactor/e-stop and three-phase teaching modules; validation checks domains. | More legible schematic/editor, wire management, correct reference/ground isolation, overload and short scenarios, breadth of analog/three-phase teaching abstractions. | P1 |
| Physical plant | 21 original scene catalogue and P1–P25 worker-tested material campaigns; per-instance conveyors, tanks, sensors, physical bodies, faults. | Test arbitrary combinations beyond reference scenes, general device composition, collision/sensor fidelity, multi-instance interoperability and bounded performance. | P1 |
| State durability | `sandbox-project-storage.ts` protects a primary `localStorage` JSON record with one recovery record, preserves some corrupt data, checks the observed raw value, caps project text at 1 MB. | Not atomic across simultaneous tabs; single-project workflow, limited history and browser quota recovery. IndexedDB-backed project library/backup policy is recommended. | **P0** |
| Scenario/assessment | `src/exercises/catalogue.ts` contains four classic sandbox definitions; wider factory learning library is separately present in P9–P25; `src/exercises/probe.ts` drives real `tick()`. | Unite discoverability and rubric architecture without counting separate scene and scenario registries as identical. Strengthen anti-bypass tests, instructor authoring, feedback, evidence limits. | P1 |
| Offline/PWA | `scripts/build-offline.cjs` makes content-hashed service-worker asset precache; bundle budgets and no-WebGL fallback exist. | Test offline upgrade/reload, failed cache update and storage-loss recovery; service-worker staleness and large build impacts. | P0/P2 |
| Automated QA | Node 22, Vitest, TypeScript, build/offline checks, browser scripts, Windows Edge, no-WebGL, accessibility, bundle budgets documented. | Never equate historical CI with exact current head; tests sometimes retry (`FLAKY` marker). Need reproducible final-head/real-device release evidence. | P0/P2 |
| Security/integrity | PR #71 tightened assessment identity/version, evidence bounds and CSP. | Local candidate/result codes are unsigned/editable; treat as practice evidence only. Check imports, browser storage, worker command limits, XSS/CSP and privacy. | P1 |
| Docs/repo governance | PRD, architecture, skill, many handover records; release register and archived factory-slice index. | Stale future tense in README/PRD/handovers, many historical PR branches, naming conflict (`School-of-scammers` versus EFO/PLC Skills Lab). Single status register and roadmap needed. | P0 |
| Legal, controls, field QA | Project explicitly identifies educational simplification, third-party provenance and real hardware as open gates. | Independent review, licenses/SBOM, 8GB CPU Windows/Edge acceptance, student/instructor trials. | P2/release |

## Specific observations that should become tickets, not unqualified defect claims

**F-01 · UX issue is current and already defined.** PR #80 is merged into `main` as `284ba478...`. Issue #81 records the remaining UX6/UX7 scope and exact viewport acceptance. Draft PR #79 is older and overlaps the already merged UX5 work: review/diff against main and **do not merge or replay blindly**.

**F-02 · Local storage is not a transactional project database.** `src/platform/sandbox-project-storage.ts` itself states that its `localStorage` compare-before-set cannot prevent simultaneous multi-tab overwrites. Its 1 MB text cap and one recovery copy are valuable basic safeguards, not a durable project library. Browser quota/permission failures must leave bytes untouched and give the user a reversible export path.

**F-03 · Very large modules.** `SandboxPage.tsx` (~89 KB), `src/sim/orchestrator.ts` (~86 KB), `Sandbox3D.tsx` (~54 KB) and dense CSS centralize large unrelated responsibilities. Characterize behavior first, then extract thin components/services without changing command semantics. Modularization by itself is not a reason to risk engine behavior.

**F-04 · Parallel plant and legacy PLC pathways remain.** The release register explicitly calls out coexisting `electrical-defs`/`params` and `plant/equipment` models. The orchestrator keeps a classic primary PLC path alongside generic runtimes and several legacy mirrors. This is technical debt, not proof of incorrect simulation. Introduce adapters, migration/compatibility tests, and a *single canonical registry contract* before expanding device breadth.

**F-05 · Project schema needs a future-proof migration story.** `ProjectFile` still uses `formatVersion: 1` with many optional fields; current input validation is extensive. Add versioned migrations, explicit unknown-field policy, stable IDs, named project metadata, deterministic export and roundtrip tests before further changes complicate file formats.

**F-06 · Documentation is a historical mixture.** The root README describes early draft P1–P6 sections, while its top note acknowledges PR #70 deployment. `docs/product/AUDIT_SIMULATOR_FIRST.md` calls FBD missing—but the current repo has `src/program/FbdEditor.tsx` and `src/engineering/fbd.ts`. The plant registry's header comment says “23” models while its current source list contains 26 entries. Treat these as documentation-drift examples; run the complete inventory to find others.

**F-07 · Existing tests do not establish UI/product quality or domain equivalence.** The release register documents P1–P25 integration and prior native/browser successes, but physical 8GB/no-discrete-GPU, exact-current-release browser behavior, independent controls verification and usability studies remain unaccepted. The latest commit's combined status lookup returned a **Vercel failure linked to build-rate limits**; classify this as deployment/platform status needing follow-up, not automatically as a software-code failure. Issue #81 reports five passing workflows for UX5; collect and archive actual run IDs for the **exact merge head**.

**F-08 · Simulation performance is a measurable risk.** Current `worker.ts` uses JSON serialization to compare complete project content on dispatch and a 50 ms interval to queue commands. Instrument worker dispatch costs and command queues under maximal supported projects, malformed imports and fast user interaction. Do not claim a performance bug without profiling, and do not alter scan-time semantics to improve apparent FPS.

**F-09 · Assessment integrity has a deliberate ceiling.** Offline employer/candidate codes remain editable local data even after PR #71. A completely client-only app cannot cryptographically establish a real candidate's identity or protect against a modified client. Offer reproducible learner evidence and clear disclaimers, not trusted certification language.

**F-10 · Names and user promise need discipline.** Product-facing name = **PLC Skills Lab / EFO Skill Lab** pending owner branding decision; the historical GitHub slug `School-of-scammers` is NOT the product description. Do not automatically rename the public repo because redirects, deployments and existing links could break.

---

# D. ONE master roadmap (R0–R12)

## Rules for executing this sequence

- **One active master task register**: `docs/product/MASTER_ROADMAP.md` derived from this document. Mark each task `NOT_STARTED`, `IMPLEMENTED_UNVERIFIED`, `CI_VERIFIED`, `OWNER_ACCEPTED`, `BLOCKED`, or `DEFERRED`. No ambiguous “done.”
- **Stage order is binding.** Claude may group closely related tickets into one reviewed PR but must not start dependent work before its foundation. A limited independent tests/docs effort may run concurrently. No automatic merging of historical branches.
- **Stage evidence is mandatory**: baseline SHA, changed files, compatibility implications, unit/mutation tests, browser evidence, failures fixed, exact commit/CI links, limits, and next-stage handoff.
- **Development can continue while owner-only physical/independent acceptance remains open**, provided those gates remain clearly marked unverified and no product is declared certified/released. Do not silently call an unverified stage production-ready.
- **Success means real behavior.** Each new tool/device must support place → configure → wire/map → write PLC logic → run/step → inspect worker state → intentionally break → repair → save/reload, with deterministic assertions. A beautiful model without functioning contacts/signals is not an accepted equipment feature.

## R0 — Ground truth, documentation consolidation and reproducible baseline
**Priority:** P0 · **Dependencies:** none · **Main outcome:** Claude knows the exact starting point and has a trustworthy test and backlog map.

- **R0.1** Fresh clone `main` and record its full SHA, Git status, Node/npm versions, resolved lockfile, file inventory and test count. Compare latest GitHub `main` against this review's `284ba478...`; if it moved, use latest only after diffing. Never overwrite working changes.
- **R0.2** Enumerate **every repository file**: app, components, programs, simulator, plant, electrical, diagnostics, workspace, platform, exercises, CSS/assets, tests, CI, scripts, docs. Generate a machine-readable source/component/scene/test/route ownership matrix. Distinguish archived docs and actual runtime source. Confirm 54 UI component kinds, 26 source-list equipment definitions, 21 scenes, 4 classic scenarios—or correct the counts from executable code.
- **R0.3** Run `npm ci`, `npm run typecheck`, `npm test`, `npm run verify:engineering:offline`, `npm run verify:full`, `node scripts/check-performance-budgets.cjs` plus all available exact-head browser/security/Windows jobs. Save logs, failures and runtime timings without weakening tests or retry-masking flakes. Confirm lockfile + Node 22.
- **R0.4** Establish a baseline screenshot matrix: blank project, two-machine, ten-machine, 21-scene examples, Ladder/ST/FBD, wiring, inspector, diagnostics, student scenario, no-WebGL; widths 1440×940, 1366×768, 1280×720, 1024×768 and 768 tablet. Note that screenshots are not physical hardware acceptance.
- **R0.5** Compare open issue #81, PR #79, merged #80, recent UX2–UX4 integration and historical PR #29–#41/#66–#67; record superseded source without mass merges. Investigate current Vercel rate-limit status separately.
- **R0.6** Reconcile README, PRD, architecture, `CLAUDE.md`, developer skill, handover and release register: present tense for merged features, current capabilities vs aspirations, preserved legacy, truthful field gates. Add one `docs/product/STATUS.md` and this master roadmap; archive, don't proliferate incremental reports.
- **R0.7** Write a prioritized, evidence-linked findings register for every critical/substantial problem discovered by the exhaustive checkout audit: file:line, severity, repro, affected workflows, owner, planned stage.

**Exit:** exact baseline reproducible; all files inventoried; no unsupported merge status; source-to-feature matrix; CI and browser logs with any blockers recorded; one roadmap and status page. **No functionality regression.**

## R1 — UX6/UX7: complete the professional contextual engineering workbench
**Priority:** P0 · **Dependencies:** R0 · **Source:** GitHub issue #81. **Do not repeat UX5.**

- **R1.1** Consolidate redundant Build/Wire/Program/Test and Logical/Physical/Plan/Library/Inspector/Dock controls into clear primary modes and context-sensitive secondary tools. Maintain all existing routes/commands and user choices.
- **R1.2** Introduce explicit **Select, Place, Move, Rotate, Wire, Measure** states with visible active tool, cursor guidance, keyboard shortcuts, Escape-to-cancel, disabled-action explanation, no accidental edits while Run is active.
- **R1.3** Canvas occupies most of the available engineering viewport. Reduce overlays/ribbons, fix overlapping and nested scrollbars, give the left illustrated/searchable equipment library collapsible/resizable behavior, and preserve large 3D WebGL pointer targets.
- **R1.4** Context Inspector opens on selection/focus and clearly groups Properties, Wiring/Terminals, Live I/O, Faults and Simulation State. Provide selection outline, anchor handles, grid/fit/zoom/camera orientation and accessible focus controls without interfering with 3D drag.
- **R1.5** Dock supports Ladder/ST/FBD editor, watch table, trace, diagnostics and scenario panels through resizable tabs; Focus mode retains Run/Pause/Step, selection and essential status.
- **R1.6** Store view/panel/camera preferences separately from PLC project data; recover invalid values safely; keyboard/touch resizing; no cross-tab project overwrite.
- **R1.7** Validate blank/1/2/10+ equipment placements and complex machines at 1440×940, 1366×768, 1280×720, 1024×768, 768px tablet; real Chromium WebGL and no-WebGL checks. Preserve UX2–UX5, P4 reversing, P7 dragging, PLC/wire state, and all five workflow categories reported by issue #81.

**Exit:** visually reviewed screenshots and actual interaction evidence at all target sizes; no covered essential control or outer scroll, no regression in a 3D/2D/logical PLC work cycle; owner UX signoff separately tracked.

## R2 — Project management, persistence, recovery and offline reliability
**Priority:** P0 · **Dependencies:** R0, R1 UI hooks · **Goal:** users can safely do meaningful projects over many sessions.

- **R2.1** Introduce an offline **project library** (new/open/duplicate/rename/delete-with-confirm/archive/search/sort/recent), with stable project ID, title, revision, created/modified timestamps and schema version. Prefer IndexedDB transactional storage for durable multi-project use; keep a safe transparent adapter for existing `localStorage` single-project data.
- **R2.2** Implement non-destructive one-time migration from `efo-open-sandbox-project-v1`. Quarantine invalid bytes, never overwrite a damaged original on startup, preserve the recovery snapshot, prove legacy imports round-trip and allow export before repair.
- **R2.3** Add bounded snapshots/version history, manual Restore, JSON export/import with file-size and shape validation, duplicate-name handling, backup-all/restorable bundle and explicit recovery UI. Document what runtime/trace data is and is not persisted.
- **R2.4** Enforce single-writer ownership or explicit cross-tab conflict resolution using transactional version/epoch checks; prevent silent lost updates. Do not present `storage` events or localStorage compare-before-set as atomic transactions.
- **R2.5** Make quota, unavailable storage, private browsing, failed writes, browser termination and aborted imports visible and recoverable; never display “Saved” before a committed storage acknowledgement.
- **R2.6** Versioned SW/offline update protocol: confirm active assets, update-ready prompt, refresh without losing unsaved edits, offline first launch after initial install, graceful stale-worker failure and cache repair. Preserve security CSP/Worker requirements.
- **R2.7** Build multi-tab, forced crash/restart, corrupted primary/recovery, quota exceeded, bad imports, partial migration, offline update and cross-version roundtrip browser tests.

**Exit:** no tested scenario loses the last acknowledged project revision; multiple projects and safe recovery demonstrable in real browsers; no legacy data loss; offline start/update evidence collected.

## R3 — Simulation kernel consolidation and extensibility contracts
**Priority:** P1 · **Dependencies:** R0, R2 schema decisions · **Goal:** safe foundation for new equipment and PLC fidelity without rewriting working engines.

- **R3.1** Create characterization/golden-vector tests for `tick()`: classic first PLC, generic PLC16, multiple isolated supplies, mixed LD/ST/FBD, old `formatVersion:1` projects, paused meter, scan ordering, fault cases, worker snapshot immutability and seed replay.
- **R3.2** Document canonical per-instance device lifecycle and reduce divergent registries: component identity, terminals, visual geometry, electrical behavior, plant equipment behavior, parameters, fault hooks, telemetry and tests. Keep adapters for `components/electrical-defs.ts` and `plant/equipment`, not one risky rewrite.
- **R3.3** Extract coherent pure phases from the ~1,290-line orchestrator behind an unchanged `tick()` API: command validation, electrical solve, sampled PLC inputs, PLC scans, actuator mapping, plant substeps, sensors, events, snapshot. Preserve exact next-scan semantics and all 50ms/10ms contracts.
- **R3.4** Generalize the remaining first-controller/singleton mirrors only where safe and needed; explicitly preserve legacy projects and expected classic behavior. Never let an unrelated device share a boolean singleton by accident.
- **R3.5** Define typed per-device digital/analog inputs and outputs with units, range, active-state, timing, power reference, source/provenance and fault observability. Ensure analog never masquerades as 24V boolean power.
- **R3.6** Bound worker message size, edit queues, event streams, recorded traces and max scene bodies; profile dispatch JSON serialization and incremental snapshots before optimizing. Avoid nondeterministic wall-clock logic.
- **R3.7** Add reproducible deterministic replays, snapshot equality for same seed and actions, invariants for physical body count, no stale outputs after program failure, and mutation tests that prove critical assertions fail when behavior is broken.

**Exit:** all baseline scenarios byte/behavior compatible where specified; only one tick authority; new device can be implemented with a documented interface and without inserting unrelated hard-coded branches; profiling report and regression matrix.

## R4 — PLC IDE, IEC-oriented program editor, monitoring and I/O mapping
**Priority:** P1 · **Dependencies:** R3 · **Goal:** credible practical PLC programming experience using existing engines.

- **R4.1** Improve the **existing** Ladder, ST and FBD editors: clear rung/network canvas; drag/wire/touch operations; multi-selection, copy/paste, undo/redo, keyboard navigation, zoom; save/reload of editor layout; accessible compile messages with locations. Do not replace working execution engines with a mock editor.
- **R4.2** Define a documented, tested IEC 61131-3-inspired **supported subset** for contacts, coils, set/reset, edge detection, timers (TON/TOF/TP), counters, arithmetic, comparisons, typed variables, memory and numerical overflow/error handling. Identify unsupported language features explicitly; do not claim full IEC compliance.
- **R4.3** Support named symbolic tags, physical terminal mapping, configurable DI/DO/AI/AO where supported, expansion-module abstractions and per-PLC mapping diagnostics. Preserve classic 5/6 and PLC16 compatibility.
- **R4.4** Implement coherent online monitoring: force overrides labelled as simulation-only, watch tables, rung/FBD flow highlights, breakpoints, single scan step, counter/timer memory, scan trace, time-scale control if deterministic, and trace CSV export.
- **R4.5** Expand ST/FBD language safety and error messaging with parser recovery, negative tests, expression precision and correct scan order. Keep mathematical behavior deterministic and bounded.
- **R4.6** Create safe project-code import/export: documented text/JSON format, and PLCopen XML subset only where genuinely roundtrip-tested. Never promise Siemens project file support or vendor code equivalence.
- **R4.7** Multi-PLC program tabs show exact active PLC identity and don't silently apply code to a different controller. Add inter-PLC wiring/race educational examples with independent power domains.

**Exit:** a fresh learner can complete the same motor starter and process-control behavior through each supported language, see accurate live state, observe intentionally wrong logic fail, save/reopen without corruption, and inspect understandable errors. Independent instructor review tracks semantic correctness.

## R5 — Electrical panel, wiring, power and industrial I/O laboratory
**Priority:** P1 · **Dependencies:** R3/R4 · **Goal:** wiring and electrical mistakes have understandable consequences.

- **R5.1** Upgrade logical wiring canvas into an engineering schematic: terminal search, device grouping, net labels/wire colors, wire routes, branch junction display, inspect/connect/disconnect, continuity mode and snap-to-terminal. Preserve accessible terminal list and live worker commands.
- **R5.2** Extend idealized 24V supplies, protective devices, contactors, relay, pushbuttons, motor starter, reversing starter, overload, E-stop training abstraction and lamps. Keep reference-ground isolation and differential meter correct.
- **R5.3** Integrate reusable educational panel templates (DOL, forward/reverse, timer relay, interlocks, star/delta *teaching abstraction*) but preserve an **empty, unwired** route and hide solutions in graded exercises.
- **R5.4** Introduce explicit digital sensor supply vs output, analog voltage/current or normalized signals as separate bounded channels, terminal compatibility and incorrect-domain warnings; optionally map analog values to PLC I/O with clear units.
- **R5.5** Add inspection instruments: multimeter with signed polarity, continuity, current-as-modeled where supported, digital logic probe, oscilloscope/trend graph where meaningful; instruments must read the solver, never invented display values.
- **R5.6** Audit fault semantics: open wire, welded contact, dead coil, overloaded actuator, stuck sensor, tripped breaker, incorrect common, reversed/shorted path. Error messages must say symptoms and impacts, not reveal hidden assessment fault identity.
- **R5.7** Keep **three-phase** content separately labelled educational model with clear limitations; do not imply real mains design, thermal protection, industrial electrical certification or safe field wiring.

**Exit:** at least DOL, reverse-start, interlocked branch, pneumatic valve and analog level control all built *from an empty floor* with testable wrong-wire and recovery cases; measured simulated voltages and I/O match model contracts.

## R6 — General-purpose 3D factory composition and equipment design
**Priority:** P1 · **Dependencies:** R1, R3, R5 contracts · **Goal:** a universal industrial laboratory, not only conveyor scenes.

- **R6.1** Audit every current UI library kind and plant definition: original model, terminal interface, parameter validation, worker behavior, 3D/live overlay, fault support, persistence, test and performance budget. Mark incomplete items explicitly in the palette.
- **R6.2** Improve true 3D authoring: orbit/fly/first person, Fit all/Focus selected/top/side, perspective and orthographic where useful, move/rotate/yaw/elevation, alignment, grid snap, surface mounting, drag preview, collision feedback, grouping/ungrouping, duplicate, copy/paste, undo/redo, layer/filter/visibility and keyboard controls.
- **R6.3** Add reusable **assemblies/subsystems** with self-contained component IDs, exposed electrical terminal ports and named equipment control ports. Pasting two assemblies must not cross-wire hidden data or reuse IDs.
- **R6.4** Unify device geometry with simulation geometry enough that sensor range, photoeye beams, field-of-view, supported motion and collision origins are inspectable. A moved/mis-rotated sensor must affect worker behavior, not merely animation.
- **R6.5** Expand the tested library around genuine gaps (not arbitrary model-count milestones): electrical cabinets and PLC I/O modules; motor/drive types; cylinders, air supply and directional valves; level/flow/temperature/pressure/weight sensors; tanks/pumps; conveyor families; stoppers/pushers/diverters; robots, palletizers, warehouses and material handling.
- **R6.6** For each equipment type define truth table, operating envelope, units, settings, faults, valid connections, negative cases and render behavior; low-poly 3D fallback and no-WebGL alternative required.
- **R6.7** Validate truly *user-authored* multi-machine compositions including two or more independent lines, shared logistics/handoff, multiple PLCs, and multiple sensors of the same type. No hidden scene-ID-specific logic.

**Exit:** build, wire, program, run, fault, save and reopen a previously unseen combined workcell from an empty project, with no canned answer or special-case renderer path. All accepted catalog kinds behave as documented.

## R7 — Deeper process physics and industrial system behaviors
**Priority:** P1/P2 · **Dependencies:** R3, R4, R6 · **Goal:** coherent learning realism, not unmeasured parity with commercial software.

- **R7.1** Consolidate bounded material-body conservation and collision behavior: feeding, multi-body accumulation, jam, conveyor handoff, queue/buffer, transfer, reject, sorting by material/height/weight, stopper interaction and recovery of original bodies. Preserve P15–P25 evidence.
- **R7.2** Build deterministic actuators: 2D/3D stroke, travel limits, motor acceleration/direction where modeled, pneumatic valve/cylinder sequences with air availability, turntable indexing, lift/gantry and robot pick/place within defined workspace.
- **R7.3** Expand process models with documented units, first-order approximations, analog sensors, level/temperature/flow/pressure, filling/capping, mixing, heater/valve controls, bounded PID instruction/example only if semantics are validated. Clearly label intentional simplifications.
- **R7.4** Support timed events, seeded failure campaigns and parameter variations without nondeterminism. One PLC scan always samples the previous settled sensor state; no instantaneous mid-scan feedback.
- **R7.5** Benchmarks: maximal supported body count, two independent active scenes, 60 placed components, 250 wires, six PLCs, 10-minute and 1-hour accelerated simulation, replay equality and worker/message-bounds. Track CPU, memory, scan p50/p95 and render FPS. Set acceptance thresholds based on owner reference hardware, then test, rather than inventing measured results.
- **R7.6** Add illustrated model-limit information in the inspector and per-scene documentation: e.g., physically modelled vs idealized motion, reference sensor range, no calibrated motor torque or real safety circuits.

**Exit:** representative conveyor/warehouse/robot and tank/process workflows show physically derived differences for bad placement, wrong logic, disabled power, faults and reset, with conservation/timing assertions and bounded runtime.

## R8 — Diagnostics, fault injection, commissioning and engineering evidence
**Priority:** P1 · **Dependencies:** R3–R7 behaviors · **Goal:** instrument the product like a usable virtual laboratory.

- **R8.1** One Diagnostics workspace: alarms, event log, PLC I/O status, power rails, per-device live states, meter, trace, sensor field visualization, cycle/scan timeline and watch lists; no invented readings from rendering.
- **R8.2** Paused-only instructor fault insertion, hidden fault challenges and symptom-first learner diagnosis; root-cause reveals only through explicit review mode, never by leaking a hidden `faultId` into student UI or export.
- **R8.3** Fault consequences must enter electrical solver/plant equations, not toggle UI. Model failure recovery, safe restart latch and acknowledgment with original retained body where applicable.
- **R8.4** Reusable commissioning workflows and FAT-style checklists: inspect wiring, verify PLC I/O, manually jog in *simulated* mode, run a trial, record observations, compare expected/observed behavior, export bounded HTML/CSV/JSON evidence locally.
- **R8.5** Add regression fixtures for deliberately incorrect sequences, stuck buttons, broken wiring, misaligned sensors, divide by zero, nonfinite analog, power loss and jam. Verify hidden fault does not leak across tooltips, snapshots, traces or result messages.
- **R8.6** Trace/replay privacy, size caps and time-scale semantics; distinguish diagnostic replay from a full deterministic project rerun. Do not call a recent scan trace a complete execution recording.

**Exit:** an instructor can create an unknown, repeatable fault; a learner can prove diagnosis using real virtual instruments; clearing/fixing changes future worker behavior; evidence export is honest and bounded.

## R9 — Learning paths, scene gallery, assessments and instructor usability
**Priority:** P1 · **Dependencies:** R2, R4–R8 capabilities · **Goal:** educational depth with trustworthy local limitations.

- **R9.1** Keep distinct concepts: **scene/template** (editable factory layout), **tutorial** (guided workflow), **scenario challenge** (starter and objectives), **assessment** (hidden variants, independent rubric and bounded evidence). Do not count all 21 scene layouts as 21 fully assessed courses.
- **R9.2** Create a coherent learning progression: safety limitations and basics → DC 24V wiring → Ladder start/stop and timers → digital sensor control → reversible/motor panel → structured text/FBD → pneumatic sequences → analog tank and PID → sorting/robot/warehouse → troubleshooting/commissioning → multi-PLC systems.
- **R9.3** Expand original gallery with clearly scoped beginner/intermediate/advanced projects, wiring manifests, learning objectives, intentionally wrong alternatives, optional hints, step-by-step tutorials, and *empty starter* mode. Never embed answer code into an assessment starter.
- **R9.4** Normalize scenario data model: required outcomes, preconditions, measurable physics, timing and fault cases, deterministic seeds, grading reproducibility, rubric version and instructor comments. Accept any functionally correct implementation in the supported LD/ST/FBD subset; reject trivial always-on or vacuous passes.
- **R9.5** Improve local learner feedback: exact failing objective, evidence trail and retry recommendations without disclosing restricted hidden answers before submission. Exportable achievement/portfolio is **self-reported simulated evidence**.
- **R9.6** Preserve employer/candidate local flows and all old PLC/CCTV exercises; test expired/malformed/share-code edits, evidence limits, mode/identity confusion, and interrupted runs. Label codes as unsigned and non-authenticating; never claim verified hiring certification.
- **R9.7** Field test with actual instructors/students: can a first-time user wire, program and troubleshoot without developer help? Record completion, usability friction, support requests and false scoring. Owner acceptance later.

**Exit:** minimum one reviewed course from novice to multi-machine commissioning, with working scenes, correct/incorrect solutions, browser evidence and understandable feedback. Legacy paths remain accessible.

## R10 — Authoring tools, documentation and developer experience
**Priority:** P2 · **Dependencies:** R3, R6, R9 formats · **Goal:** future contributors and instructors extend the simulator without editing core switch statements.

- **R10.1** Define a versioned declarative scene/assembly/tutorial/assessment package schema with validation and original asset requirements. Import is untrusted: no arbitrary scripts/eval, external network fetch or arbitrary filesystem access.
- **R10.2** Add in-app authoring mode for scene layout, named assemblies, configurable properties, I/O mapping, scenario objectives and local export/import, initially separate from the learner assessment path.
- **R10.3** Generate device documentation from canonical registry definitions where feasible, including terminal diagrams, units, signal conventions, supported/unsupported behavior, failure modes and associated tests.
- **R10.4** Reduce the historical document sprawl: one current PRD, architecture, status, roadmap, device catalog, test matrix, maintainer guide and archived evidence index. Update `CLAUDE.md` with exact stage process and known constraints; no dozens of parallel increment reports.
- **R10.5** Add contributor templates, feature matrix, issue/PR labels, ownership guidance, change log and release version policy. Tests are required for any added equipment or PLC instruction.

**Exit:** a contributor can implement and verify a new bounded device/scene using documented contracts, while a course author can package a local scenario without editing assessment internals.

## R11 — Repository-wide hardening, accessibility, browser and performance QA
**Priority:** P0 throughout, final sweep P2 · **Dependencies:** all code stages · **Goal:** defensible exact-head release evidence.

- **R11.1** Audit all source/tests/config/third-party dependencies for input validation, scripts/CSP/XSS, local data handling, insecure imports, sensitive information/secrets, response bounds, prototype-poisoning risks, resource exhaustion and unsafe UI/worker assumptions. Run security/audit scans and disclose limits, not only green tests.
- **R11.2** Test **all current routes**, including `/labs`, PLC/CCTV guided exercises, employer/candidate flows, scenarios, 2D/logical/3D workbenches, no-WebGL, offline and export/restore; maintain deterministic fixtures.
- **R11.3** Establish reproducible CI on clean Linux Node 22 and Windows Edge, browser Chromium and Firefox/WebKit where available; screenshot matrix PC/tablet, `axe` keyboard/focus, pointer/touch, zoom, reduced motion and high contrast. Do not pretend touch emulation equals a physical tablet test.
- **R11.4** Remove source of any flaky browser checks; show first failure and evidence, never treat retry success as complete stability. Add timeout/failed-worker/fast-click race tests; preserve the worker-authoritative `operateToggle` intent rule.
- **R11.5** Measure real 8GB/no-dGPU Windows computer performance with representative scene and many PLCs: render FPS, scan latency, memory, startup/download, time to interactive, battery/CPU where relevant. Maintain existing build gzip budget until measured reason and owner approval for any change.
- **R11.6** Run source/asset/license inventory and SBOM, check GPL/AGPL/other obligations if included, font/illustration rights, privacy/CSP and third-party code provenance. No vendor icons/assets without rights.
- **R11.7** Independent electrical/controls-engineer review of simulated scan, I/O isolation, wiring protection, analog/process limits, machine physics and instructional terminology. Fix misunderstandings and disclaim unsupported equivalence.
- **R11.8** Long-run soak, rapid project-edit stress, test data corruption, service worker lifecycle, browser restarts, cross-tab contention, worker recovery and forced-reload data durability; repeat on final SHA.

**Exit:** comprehensive release evidence attached to one exact commit; no untriaged severity-1/2 defects; explicit machine/environment tested; owner-only hardware/domain/legal gaps not silently marked complete.

## R12 — Beta acceptance, ownership handover and controlled release
**Priority:** P2 · **Dependencies:** R0–R11 plus owner approval · **Goal:** a usable, supportable educational beta, not an unsupported industrial-certification claim.

- **R12.1** Freeze a release candidate SHA/version, feature matrix, documented model limitations, import/backup/rollback instructions, support FAQ, sample projects, offline first-run instructions, privacy statement and safety disclaimer.
- **R12.2** Check user journeys: empty project starter, 24V motor, reversing starter, analog tank, sorting/pneumatics, multi-PLC scene, hidden fault, graded assessment, save/export/import and offline reconnect. Attach screenshots/videos/logs for exact release code.
- **R12.3** Owner accepts PC/tablet UX and authentic 8GB Windows performance; independent controls reviewer signs the *educational model limitations*; instructor/student test notes and licensing checklist complete. Any outstanding gate = **NO-GO for unrestricted release claims**.
- **R12.4** Only after explicit owner authorization, prepare a preview/release process and rollback protocol, verify the deployed build maps to the approved SHA, and monitor user-visible errors. **Do not deploy automatically under this roadmap**.
- **R12.5** Archive exact QA logs, baseline/delta manifest, current document status, known limitations, deferred features and first post-beta maintenance backlog. Close duplicates/superseded historical PRs deliberately; no automatic branch deletion.

**Exit:** reviewed beta package and explicit owner GO; otherwise complete development package with a truthful NO-GO issue list. A public site being “READY” on Vercel is not equivalent to product acceptance.

---

# E. What NOT to build now / optional later research

The following ideas are deliberately **out of the current contracted build**. They may be separate owner-approved post-beta investigations, not dependencies for R0–R12:

- **Actual PLC communications and HIL** (Siemens S7 TCP, Modbus TCP, OPC UA, industrial fieldbus, vendor firmware). Normal browsers cannot make arbitrary raw industrial TCP connections; any gateway/native bridge must undergo fresh architecture, permission and safety review. Do not pretend an I/O driver dropdown establishes hardware integration.
- **Backend / SaaS / online employer accounts / cloud synchronization / multiplayer / payments / subscriptions**. The owner explicitly excluded this infrastructure; do not create it because the assessment features exist.
- **Realistic full factory CAD, SPICE-grade mains, certified machine protection, full Siemens TIA Portal equivalence, proprietary PLCopen vendor import, Factory I/O artwork, industry-certified hardware safety**. These are potentially very expensive separate programs and not truthful claims for this educational simulator.
- **Generative AI instructor, automatic fault diagnoses and AI-generated safety advice**. Could be evaluated later with a local/offline and provenance-first design; AI must not override worker truth, grade from model guesses or pretend certified engineering authority.
- **Smartphone-first UI** (below 768px). Design target remains desktop/tablet; don't sacrifice the engineering canvas for phone cosmetics.

---

# F. Dependency map and release milestones

```text
R0 Ground truth + full repo inventory + CI baseline
 |
 +-- R1 Contextual workbench UX ---------------+
 |                                              |
 +-- R2 Durable projects / offline ---------+   |
 |                                          |   |
 +-- R3 Engine contracts / registry --------+---+ 
      |
      +-- R4 PLC IDE + IO mapping ------+
      +-- R5 Electrical + instruments --+-- R6 3D composition + catalog
                                        |         |
                                        +---------+-- R7 Process/material physics
                                                    |
                                                    +-- R8 Diagnostics/FAT
                                                    |
                                                    +-- R9 Learning/assessment
                                                          |
                                                          +-- R10 Authoring/docs
                                                               |
R11 Hardening runs continuously; final full sweep after R10 -----+
                                                               |
                                                    R12 Owner beta/release gates
```

**Milestone A — coherent safe engineering workbench:** R0–R2, verified current app, UX6/7 and project durability.  
**Milestone B — industrial simulator engineering core:** R3–R6, unified devices, I/O, editors, electrical and 3D composition.  
**Milestone C — deep learning capability:** R7–R10, generalized processes, commissioning, assessment and authoring.  
**Milestone D — demonstrably reliable beta:** R11–R12, exact-head QA, owner reviews, release decision.  
Milestones describe work completion, **not** independent authorization to deploy or claim physical equivalence.

## Task status template Claude must maintain

| Task ID | State | Baseline SHA | PR/commit | Unit/engine evidence | Browser evidence | Owner-only blockers | Notes |
|---|---|---|---|---|---|---|---|
| R0.1 | NOT_STARTED | 284ba478… | — | not run in this review | not run | none | Compare latest main first |
| R1.1 | NOT_STARTED | — | issue #81 | — | — | UX screenshot review | Existing UX5 merged; avoid duplication |
| R2.1 | NOT_STARTED | — | — | — | — | real-browser storage acceptance | Existing guarded localStorage is not IndexedDB |

### Definition of done for every implementation ticket

1. Source/feature contract and existing implementation checked so that work is not duplicated.
2. Reproducible failing test or explicit new acceptance test written first where feasible.
3. New behavior is worker-verified; UI does not fabricate physics or PLC status; no regression of historical app.
4. Unit, integration, invalid-input, deterministic replay, and mutation/negative tests added for critical behaviors.
5. Browser E2E follows **actual learner commands** from empty project through signal/worker state; screenshots when UI changed.
6. `npm run typecheck`, `npm test`, `npm run verify:engineering:offline`, `npm run verify:full`, performance budget and relevant browser workflows pass on exact final source, **or failures are explicitly blocked/unverified**.
7. Documentation updated only for changed facts; accessibility, offline, save/restore and older data considered.
8. PR includes changed files, evidence, scope boundaries, risk, owner acceptance gate and next-stage handoff. No auto merge or deployment.

---

# G. Claude kickoff / execution instruction (copy verbatim into the coding agent)

> You are the lead engineer for PLC Skills Lab / EFO Skill Lab in `adjeiemmaaegh-web/School-of-scammers`. Your **sole governing future-work roadmap** is `PLC_SKILLS_LAB_MASTER_REVIEW_AND_CLAUDE_ROADMAP_2026-11-17.md` (copy it into `docs/product/MASTER_ROADMAP.md` on a reviewed documentation branch after confirming latest `main`). This is NOT a request to restart completed P1–P25 or UX2–UX5 work.
>
> Begin at **R0, with a full fresh clone and complete repository file inventory**. Record the exact HEAD SHA and reconcile it against `284ba4783225f64b88c1c1d3e5bb1cc314511e55`. Read `CLAUDE.md`, `docs/product/PRD.md`, `ARCHITECTURE.md`, `RELEASE_READINESS_2026-11-15.md`, `FACTORY_SLICES_INDEX.md`, UX issue #81, merged PR #80, and `.claude/skills/automation-platform/SKILL.md`. They are reference/history; this new roadmap is the ordered future work. Inspect every runtime module, legacy `/labs` route, equipment/scene library, test, CI script and dependency before editing. Run the actual full test/build/browser matrix; publish exact evidence. If any check cannot run, mark it unverified.
>
> Make one stage execution plan and a single living task register. Work in the R0 → R12 order; stage dependencies are binding. Prefer targeted, reviewable, tested PRs over mass rewrites. After each stage, update status with commit, changed files, tests, browser screenshots where relevant, outstanding acceptance gates and next stage. Continue the source-development roadmap while appropriately tracking owner-only hardware and instructor/controls reviews as open—never claim acceptance they have not provided.
>
> **Architecture invariants:** frontend-only/offline-capable; real interactive Three.js/R3F; worker is sole simulation authority; use command intents and immutable snapshots; one deterministic `tick()` pipeline with 50 ms scan and bounded plant substeps; seeded physics; real 24V/analog terminal mapping; per-device state; clear no-WebGL and keyboard modes; backwards-compatible project import; bounded input/storage; no silent overwrites. Never replace real dynamic results with canned animation, infer PLC state from UI, leak hidden fault answers, or grade using a model answer instead of physical outcomes.
>
> **Product invariants:** original industrial-automation teaching simulator (not clone, not safety-rated), PC/tablet from 768px width, full-window canvas, professional contextual toolbars, left equipment palette, right Inspector, lower programming/diagnostics dock, empty-project workflow, real Ladder/ST/FBD editing, reusable physical scenes and local learning/assessment. Preserve PLC/CCTV legacy exercises and employer/candidate local codes, while making clear those codes are not authenticated certification.
>
> **Prohibitions:** no backend, Supabase, OAuth/login, database server, cloud sync, payments, industrial network connector, new vendor graphics, automatic main merges, branch destruction, production deployment or external hardware commands without explicit owner authorization. Do not weaken tests to force green CI, conflate retry with non-flaky acceptance, or claim real 8GB Windows testing without measured evidence.
>
> **First deliverable:** an R0 source inventory/verification report and the reconciled current status/roadmap on a reviewable branch. **First functional increment after R0:** R1 against issue #81, explicitly excluding work already merged in PR #80. **Next:** R2 durable project library and recovery. Then follow R3–R12. If reality differs from this roadmap, provide file:line evidence and propose a surgical amendment rather than unilaterally changing product scope.

---

# H. Immediate handoff checklist for this review

- [x] Identified correct repository and product; verified latest `main` commit via connector.
- [x] Confirmed PR #80 merged and #79 still open/draft; issue #81 is live future UX backlog.
- [x] Confirmed current LD/ST/FBD runtime/editor presence and worker-backed 3D/plant foundation.
- [x] Inspected current storage and documented concurrency/durability limits.
- [x] Inspected key source, scene, device, architectural, CI and historical QA documents.
- [x] Reconciled major historical vs current status contradictions in the new roadmap.
- [x] Produced one ordered, testable, Claude-executable roadmap with dependencies, acceptance and protections.
- [ ] Full checkout and every-file scan (R0, requires coding environment).
- [ ] Run current exact-head dependency, typecheck, unit, browser, security and build tests (R0).
- [ ] Inspect/approve latest actual 3D screenshots and low-spec Windows/tablet interactions (R1/R11 owner gates).
- [ ] Independent controls/education/legal/provenance validation (R11/R12 external gates).
- [ ] Deployment or product release decision (owner only; not authorized by this document).

**Final guidance:** Do not reward the project for having many simulated devices or passing many tests alone. Reward it for letting a student independently design, wire, program, inspect, break, repair and persist a genuinely new industrial automation system—then measure whether the same behavior survives crashes, offline use, low-spec hardware and formal educational review.

---
# I. R13 — Steady Guide beginner onboarding (added 2026-11-19)

This new user-requested feature is developed in draft PR **#89** on \`feature/steady-guide\`, created from the production-verified \`main\` SHA \`4eb3cd1a\`. It **does not change the required R0–R12 industrial/educational release gates** and should not be mistaken for a new working PLC engine.

| R13 unit | Deliverable | Current implementation state | Acceptance still needed |
|---|---|---|---|
| R13.1 | Separate first-time user Guide navigation and learn-first flow | Implemented on draft branch | Owner novice journey and mobile feedback |
| R13.2 | Equipment/terminal reference and original scene atlas | 54 component kinds; 21 original scenes, source-parity tests | Verify explanation quality and equipment changes over time |
| R13.3 | Hands-on selection guidance | Six task-based build plans linked to real labs/scenarios | Real new-user completion and safe example review |
| R13.4 | In-workbench help and highlight | Eight opt-in visual targets, Escape/return focus, no worker commands | Cross-device visual review and keyboard assistive-tech test |
| R13.5 | Authentic screenshots | Five original R1 PNGs embedded, 8 newer actual CI images reviewed, 14 states scripted | Complete SG-01..SG-18 including populated PLC/FBD/fault states; owner screenshot signoff |
| R13.6 | Offline, storage and performance | Lazy guide route, separately isolated progress, route/size guardrails | Exact-head browser/offline/low-spec passes and owner acceptance |
| R13.7 | Integration and release | Draft PR #89; main and production unchanged | Full CI green on exact source, review approval, explicit owner merge/deploy decision |

Steady Guide must never reveal graded scenario answers, modify current projects or claim actual industrial safety/PLC firmware equivalence. Documentation and evidence: \`docs/product/STEADY_GUIDE_DEVELOPMENT.md\` and \`docs/qa/steady-guide/CAPTURE_MATRIX.md\`.

