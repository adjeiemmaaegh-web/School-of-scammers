# PLC Skills Lab

**Browser-based virtual PLC and industrial automation training.** PLC Skills Lab is a frontend-only educational simulator with ladder logic, a bounded Structured Text interpreter, electrical wiring labs, deterministic virtual machinery, fault diagnosis, commissioning exercises, typed I/O debugging and offline project/session exports.

**[Open PLC Skills Lab](https://plc-skills-lab.vercel.app/)** · [Engineering Workbench](https://plc-skills-lab.vercel.app/engineering) · [Exercise catalogue](https://plc-skills-lab.vercel.app/labs)

**Status: educational development/beta application; full PRD and industrial acceptance remain NO-GO.** These simulations must never control physical machinery or be represented as certified electrical, safety, or PLC instruction. Vendor-specific scan semantics, field physics and safety accuracy have not been independently validated.

## Practical workflows
- Author NO/NC contacts, branches, output coils, on/off/fixed/retentive timers, up/down counters and edge instructions in the ladder editor.
- Practice bounded BOOL/INT/DINT/REAL/LREAL Structured Text, CASE, FOR, persistent memory and single-program PLCopen XML 2.01 import/export. Unsupported IEC constructs fail explicitly.
- Exchange simple graphical Ladder Diagram NO/NC contacts, branches and coils as bounded PLCopen LD XML; unsupported instructions are rejected. Add custom PLC tags without editing JSON.
- Wire idealized 24 V circuits, diagnose shorts/opens, use a virtual multimeter, and complete conveyor, motor starter, pneumatic, PID and DC network labs.
- Build and commission 3D workcells from **13 equipment kinds** and four PLC-driven templates. Tune normalized actuator rise/fall behavior and observe pump/valve-dependent tank fill; run simulated FAT against the edited scene.
- Examine actual **simulated** scan snapshots, typed I/O, timers, counters, transitions, CSV evidence and offline replay. Compare externally captured real-PLC BOOL scan CSV against the teaching ladder engine; reference provenance remains unverified until independent review.
- Use simulation-only PLC input forcing for Start, SensorOK, Photoeye and ExitSensor. Isolate **virtual** power before changing forces. The watch table shows both underlying readings and forced PLC values. Safety power, guard, stop and outputs cannot be forced.
- Export projects/sessions as JSON; browser-local storage is not a durable backup. Record consent-based anonymous instructor/learner observations in Assessments, without claiming human tests were already performed.

This repository includes **no** backend, authentication, database, employer management or payment features; a separate team owns those systems.

## Offline use
Visit the hosted app once online in a service-worker-capable browser. The production build installs a versioned static cache of the HTML and lazy engineering routes for offline reopening. Reconnect for updates. Offline caches do not synchronize, back up or safeguard private project files; export your work. Local development does not register the production service worker.

## Local development and verification
Requires Node.js 22 and npm with registry access.

    npm ci
    npm run dev
    npm run verify:engineering:offline
    npm run verify:full

The production build runs semantic TypeScript, Vite, and an offline precache generator. GitHub CI additionally executes Vitest, headless Chrome interaction, offline navigation, Firefox, Linux WebKit, accessibility, no-WebGL fallback, and transfer-size checks. **Green tests verify the implemented training subset, not hardware equivalence or full PRD completion.**

## Specifications and release handover
- [Simulation-first PRD](docs/product/PRD.md)
- [Approved roadmap](docs/product/ROADMAP.md)
- [Release completion register](docs/RELEASE_COMPLETION_2026-11-05.md)
- [Standards, real-device, legal and human-validation gate register](docs/RELEASE_STANDARDS_AND_ACCEPTANCE_2026-11-05.md)
- [Physical device test protocol](qa/PHYSICAL_DEVICE_ACCEPTANCE_PROTOCOL.md)
- [Reference PLC measurement protocol](qa/PLC_REFERENCE_MEASUREMENT_PROTOCOL.md)
- [Independent learner/instructor study protocol](qa/INDEPENDENT_INSTRUCTOR_LEARNER_PROTOCOL.md)
- [Dependency and license provenance](docs/LICENSE_PROVENANCE_REVIEW_2026-11-05.md)
- [Committed lockfile and reproducible CI](docs/REPRODUCIBLE_DEPENDENCIES_2026-11-06.md)
- [Ladder XML interchange limits and evidence](docs/PLCOPEN_LD_INTERCHANGE_2026-11-06.md)
- [Input force and offline behavior](docs/FORCE_AND_OFFLINE_COMPLETION_2026-11-05.md)

Remaining release gates include expert PLC reference verification, low-spec 8 GB Windows measurements, actual low-spec Windows, Safari and real mobile acceptance (Windows-hosted Edge CI is separate), complete licensing and dependency review, broader plant/3D scene authoring, and independent instructional assessment.

- [Virtual machine catalogue and source acceptance](docs/FACTORY_MACHINE_CATALOG_COMPLETION_2026-11-05.md)
