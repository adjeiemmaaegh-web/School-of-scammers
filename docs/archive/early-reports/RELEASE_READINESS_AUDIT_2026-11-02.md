# PLC Skills Lab — 2026-11-02 source and hosted-demo acceptance report

**Decision: hosted engineering demonstration GO; complete commercial/industrial product NO-GO.**
Source repository: https://github.com/adjeiemmaaegh-web/School-of-scammers
Public site: https://plc-skills-lab.vercel.app/
Baseline source after this development pass: the commit immediately preceding this report. The report is documentation-only.

## 1. Evidence verified in Vercel

- Production React/Vite build: PASS on Node.js 22, with strict TypeScript checking.
- Vitest: **59 test files, 380/380 tests passing**, including structured text, analog PID tank, star–delta starter and 24 V control patch bench.
- Offline engineering checks: PASS. These check PLC sequence tests, session replay and integrity, fault campaigns, import resolution and routes (not substitutes for real user tests).
- GitHub Actions: repository workflow now includes a Chrome browser smoke step after typechecking, Vitest and build. The workflow's own execution must be confirmed separately; its existence alone does not imply a passed GitHub CI run.
- Live HTTP: 200 for all tested routes; static assets are served from Vercel and the SPA rewrite permits direct navigation.
- Headless Chrome acceptance: **PASS** against https://plc-skills-lab.vercel.app/ on 2026-11-02. Verified eight routes (/, /labs, /engineering, /simulation, /assessments, /process-control, /starter-lab, /electrical-bench), interactive starter STAR→dead-time→DELTA/STOP, isolated 24V return-wire repair with illuminated indicator and 24.0 V reading, ten PID scans, guided motor-fault assessment, and 390px mobile document width for /, /labs, /starter-lab and /electrical-bench. No uncaught page exceptions were observed in this smoke. These are targeted smoke tests, not exhaustive cross-browser/manual acceptance.

## 2. Changes and actual tested functionality

1. **Corrected TypeScript and full build blockers** (React key type and regression-suite reducer typing), enabling a real Vite build.
2. **Corrected previously failing test semantics** around scan-delta input injection and physical diverter travel, without disabling safety assertions.
3. **Corrected Vercel SPA deep-link routing**; /engineering and /labs now open directly.
4. **Lazy-loaded heavy 3D and engineering workspaces**, improving landing page payload separation.
5. **Added non-WebGL fallback**, retaining status and controls on graphics-limited browsers.
6. **Introduced a bounded Structured Text learning interpreter** and a PID-controlled tank exercise, with explicit supported semantics and model limits.
7. **Introduced star–delta starter sequencing**. Main, STAR and DELTA commands are modeled separately; mechanical welded feedback, transfer timeout, overload, protective interlocks and dead-time are simulated. Positive and negative regression tests verify non-overlap and fault containment. This is not a three-phase electrical or safety-rated model.
8. **Introduced an idealized 24 V circuit patch and meter bench**. Learners add/remove connections under isolation, switch a lamp loop, probe ideal voltage or continuity, investigate a floating return and see modeled short-supply isolation. Physical current, resistance, transients and shock/arc energies are excluded.
9. **Added repeatable browser smoke QA** at `scripts/browser-acceptance.cjs` and configured GitHub Actions to execute it against a local Vite preview.
10. **Fixed a mobile min-content overflow** caused by the starter scan-history table, verified at 390px viewport.

## 3. Traceability against approved simulation-first roadmap

| Stage | Scope | Current assessment |
| --- | --- | --- |
| 0 | Architecture, upstream and license audit | Architecture/PRD defined; license provenance review still open |
| 1 | Deterministic PLC core | Implemented and unit-tested for current instruction subset |
| 2 | Ladder/ST programming | Implemented in teaching subsets; full IEC instructions, typed online force/watch and vendor reference mapping incomplete |
| 3 | Electrical lab | Discrete 24 V wiring, virtual probes and fault cases; generalized circuit/netlist accuracy incomplete |
| 4 | Device/plant simulation | Conveyor, motor starter and tank supported; pneumatic, lift, pump variants and reusable scene authoring incomplete |
| 5 | 3D industrial experience | Rendered conveyor, sensor and devices with WebGL fallback; full drag/drop 3D scene editor, industrial asset library, LOD and machine diversity incomplete |
| 6 | Commissioning | Guided conveyor, FAT-style evidence, test and fault review exist; expert sign-off pending |
| 7 | Fault injection and diagnosis | Several modeled failure families and deterministic tests; real hardware comparators absent |
| 8 | Curriculum/scenarios | Conveyor, starter, wiring, tank/PID and ST exercises implemented; still not complete against all planned plant families |
| 9 | Assessments/replay | Rubrics, simulation evidence, local session replay and exports; independent educational/pilot validity not demonstrated |
| 10 | Advanced industrial tools | PID, simulated analog tank and ST subset; broader HMI/PID, trend precision and interchange remain incomplete |
| 11 | Integration/hardening | Strict typechecking, 380 tests, Chrome smoke and deploy integration pass; accessibility/security and performance audits still open |
| 12 | Formal validation | NOT accepted: cross-browser, low-spec Windows hardware, field/reference PLC comparison, security, accessibility and expert educator/pilot review still required |

## 4. Open release blockers

- Full formal hardware and browser matrix: latest Chrome smoke does **not** prove Edge, Firefox, Safari, Android/iOS or 8 GB Windows graphics performance.
- Feature completeness: complete IEC 61131-3 language behavior, generalized analog and electrical simulation, configurable machine types, robust scene editor and reusable industrial 3D assets.
- Performance: large Three.js renderer chunk remains about 959 kB minified (separately loaded); measure FPS, start time and memory on target CPU-only Windows machines.
- Safety/accuracy: qualified industrial controls review and reproducible comparison against real/reference PLC trace data. No safety/certification claim is authorized.
- Licensing and content provenance: review all packages, model assets and external content before public or commercial release.
- Accessibility, privacy, data durability, network/offline behavior and threat-model review.
- User trials: curriculum effectiveness and assessment rubric validity need instructor and learner evidence.

## 5. Engineering instructions

Local dev (Node 22): `npm install && npm run dev`.
Full build gate: `npm run verify:full`.
Optional Chrome acceptance (CI installs the dependency explicitly): `npm install --no-save puppeteer@24.31.0 && npx puppeteer browsers install chrome`, then serve built files with `npx vite preview --host 127.0.0.1 --port 4173` and run `PLC_BASE_URL=http://127.0.0.1:4173 node scripts/browser-acceptance.cjs`.
Frontend only: no backend, authentication, database, SaaS or hiring account features were introduced.

**Status:** source development has progressed meaningfully; live educational demo available; entire PRD NOT complete or accepted. Do not conflate 380 green tests and one Chrome smoke with industrial fidelity, commercial production readiness or certification.
