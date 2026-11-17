# PLC Skills Lab — Standards, simulation, security and human acceptance register
Date: 5 November 2026

**This is a software engineering increment, not certification or full PRD completion.**

## Evidence available for this increment (subject to CI)
1. **IEC-oriented Structured Text teaching subset:** supports BOOL, signed INT/DINT, REAL/LREAL finite numeric storage, deterministic IF/ELSIF/ELSE, CASE and bounded FOR, scan-local inputs, retained program outputs/internal memory, and explicit overflow/budget rejection. It does not implement every IEC 61131-3 Edition 4 type, POU, task, library, FB, SFC/FBD/LD language, standard function or vendor extension.
2. **PLCopen XML interchange:** single Structured Text PROGRAM with constrained elementary declarations and XHTML text, plus a separate bounded graphical LD importer/exporter for BOOL NO/NC contacts, series/parallel circuits and ordinary coils. Both use TC6 2.01. Timers, counters, FBs, multi-POUs and vendor features still fail closed. Consult docs/PLCOPEN_LD_INTERCHANGE_2026-11-06.md. No blanket PLCopen or IEC 61131-10 conformance claim.
3. **Industrial machine teaching model:** editable device rise/fall timing, pump/valve-dependent vessel filling and generated feedback. Still a bounded geometric scene with normalized models, not unrestricted mechanical CAD, real energy, collision/torque/mass physics or real I/O.
4. **Real-PLC comparison harness:** accepts externally captured chronological BOOL PLC input/output traces and real measured scan intervals; reports mismatches. It has **not** been supplied independent vendor PLC traces or expert signoff.
5. **Security/provenance:** optional CI artifacts include CycloneDX dependency SBOM, npm audit results, static asset inventory, and generated npm lockfile. They are raw evidence, **not** final licensing, security or redistribution clearance. Commit/verify a lockfile and signed review are required for reproducibility.
6. **Human trial evidence:** anonymous consent-based review records with role, scenario, observed completion/diagnosis/simulated isolation and usability. No independent humans have been evaluated by this session.
7. **Physical devices:** Linux automated engines are tested in CI; actual low-spec Windows, Edge, Safari, iPhone/iPad, Android and instructor/hardware measurements remain NOT TESTED.

## Required release signoffs
- Native PLC reference data and an independent qualified controls engineer confirming the supported behavior and limitations.
- Physical 8GB CPU-only Windows measurements and independently observed Edge, Safari and mobile-device checks.
- Vetted transitive dependency lockfile/SBOM, third-party asset/texture/model attribution, security triage and appropriate legal review.
- Real instructor and learner trial outcomes with valid consent, defect remediation and independent study review.
- Full roadmap scope, including unrestricted scene authoring and comprehensive IEC programming behavior, or explicit product scope reduction approved by the owner.

**Full industrial/commercial release remains NO-GO** even if all automated tests pass. A frontend-only educational beta can remain available with prominent limits. No backend, authentication, payments or real PLC connection is authorized.

## Geometric material-flow development — 6 November 2026
A separate opt-in deterministic parcel-flow engine now transports individual simulated cartons/metal items on commanded conveyors; position-derived sensor input images feed the PLC program on the following scan and controlled pushers can divert parcels. Test evidence and model constraints are tracked in docs/MATERIAL_FLOW_INTEGRATION_2026-11-06.md. This closes a meaningful **development** material-flow integration gap but not calibrated industrial physics, field sensors or physical PLC verification.
