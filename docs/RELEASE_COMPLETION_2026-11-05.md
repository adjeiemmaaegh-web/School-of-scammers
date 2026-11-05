# PLC Skills Lab — Release completion checkpoint (5 November 2026)

**Approved scope:** Simulation-first, frontend-only PRD v2.0. No backend, authentication, employer account management, database or cloud infrastructure.

**Decision: educational hosted beta usable for guided simulated practice; complete industrial/commercial PRD: NO-GO.** A passing Vite build or successful deployment is not formal industrial training acceptance.

## Evidenced functionality at baseline
- Baseline main CI 4 November 2026: 468/468 Vitest tests across 64 files, TypeScript, Vite, Chrome interactive flows, Firefox/Linux WebKit smoke, accessibility, no-WebGL fallback and compressed size budgets passed.
- Ladder logic with TON, TOF, TP, RTO, CTU, CTD and edge instructions; bounded typed Structured Text teaching interpreter.
- Virtual electrical wiring and 24 V network, conveyor and motor starter, pneumatic cylinder, analog/PID tank, DC circuit studio, 3D composer, fault campaigns, commissioning, assessment and replay.
- Typed workcell scan watch, separated sampled I/O versus post-scan feedback, historical transitions and CSV.
- Completion branch adds restricted PLC input forces and versioned offline app-shell caching. The new pass must be checked against the exact final GitHub CI and Vercel commit, not this baseline count.

## Stage-by-stage source and acceptance assessment

| Stage | Development status | Not closed / formal gates |
|---|---|---|
| 0 Research / architecture | Defined in PRD, ADRs and upstream review | Provenance and dependency inventory/lockfile signoff |
| 1 PLC core | Teaching subset implemented and regression-tested | Vendor/reference trace comparison and full IEC support |
| 2 PLC studio | Editable ladder, typed ST, watches, limited force/single scans | Full IEC semantics, PLCopen XML round-trip, all debug/force semantics |
| 3 Electrical lab | 24 V, DC solver, terminals and probes | Comprehensive component/device and physical transient accuracy |
| 4 Machine framework | Conveyor, starter, pneumatics and tank | Generalized lift, VFD, pushers, realistic collision/physics library |
| 5 3D experience | Scene composer, interactive models, fallback | Full free-form 3D authoring, asset library and low-end hardware profiling |
| 6 Commissioning | Simulated FAT, test evidence, recovery | Expert industrial acceptance |
| 7 Faults | Seeded/instrumented fault exercises and trace | Reference engineering fidelity / breadth |
| 8 Curriculum | Multiple training scenarios | Planned machinery/scenario catalogue incomplete |
| 9 Assessment | Rubrics, replayable evidence and review | Instructor and learner trials, certification not authorized |
| 10 Advanced tools | PID, tank, ST, analog and trends subsets | Advanced HMI/analog fidelity and standards-based interchange |
| 11 Hardening | Strict TS, test/build, static hosting, offline cache, CI/browser gates | Reproducible pinned dependencies, security/provenance and device/storage validation |
| 12 Formal validation | **NOT COMPLETED** | 8GB Windows CPU-only run, true Edge/Safari/mobile, engineer PLC comparison, independent teaching and security/accessibility review |

## Unresolved full-release gates
1. **Full functional scope:** Multi-machine library, generalized 3D scene authoring/physics, comprehensive IEC language and tool coverage, PLCopen/standards interoperability. A bounded demo cannot be presented as feature parity with Factory I/O or vendor PLC IDEs.
2. **Industrial fidelity:** Independent reference PLC comparisons and engineering/safety review, including startup, timers/counters, scan ordering, realistic faults and recovery; no physical safety certification.
3. **Device/browser:** Physical low-spec Windows 8 GB CPU-only benchmark (memory, FPS and cold-start), actual Edge/Safari/mobile devices and input modalities; automated Linux WebKit is not an actual iPhone.
4. **Data/quality:** Independent usability, curriculum, storage-quota and loss/recovery tests with instructors/learners.
5. **Legal/security:** Lockfile, transitive SBOM, dependency and third-party asset licenses/attributions, vulnerability/security review and legal authorization before commercial release.

## Authorized use today
Educational simulation, internal guided practice, developer previews and curriculum research, clearly labeled as non-safety-rated. Do not connect these models to real machinery or certify industrial competence on the basis of the simulator. A third-party backend is not part of this source deliverable.

Repository: https://github.com/adjeiemmaaegh-web/School-of-scammers
Website: https://plc-skills-lab.vercel.app/
Final code/CI/deployment commit evidence must match when this branch is merged.
