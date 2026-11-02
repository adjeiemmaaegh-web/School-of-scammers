# PLC Skills Lab — Release Readiness Audit
Date: 2026-11-02
Repository: adjeiemmaaegh-web/School-of-scammers
Verified production commit: 7b0bc739fe27bc70c4933b9ae6e7f0576b3ff577
Live website: https://plc-skills-lab.vercel.app/

## Verified on Vercel (Node.js 22)
- Consolidated offline checks PASS (118 parsed TS/TSX files; 161 internal imports; 28 navigation targets; 17 compiled-engine assertions and evidence checks).
- Strict TypeScript check PASS.
- Vitest PASS: 55 test files, 342 tests, zero failures.
- Production Vite build PASS; 679 modules transformed. Application splits loading of EngineeringWorkbench, Conveyor and AssessmentSuite; 3D dependencies remain a large separately loaded chunk (~959 kB).
- Vercel production status READY for commit above.
- Live HTTP 200 for /, /engineering, /labs, /assessments and /reference. The two checked JavaScript assets also returned 200.
- Vercel SPA rewrite handles direct navigation to workspaces without rewriting missing /assets/ files.
- Simulated conveyor rendering has a simplified status fallback on devices without WebGL. This and lazy loading have unit coverage, but real browser experience is not yet accepted.

## Defects corrected in this cycle
1. Fixed test expectations for scan-delta fault injection; added an actual seal-in ladder fault-detection test. Confirmed baseline passes while injected fault fails the authored assertions.
2. Corrected the 3D visual adapter test to honor the diverter's 300-ms actuator travel rather than asserting instantaneous full extension.
3. Added a Vercel history fallback for direct links to client-side routes.
4. Lazy-loaded heavy React workspaces to reduce entry bundle size.
5. Added a WebGL-capability check, a simplified machine-status view and a 3D-to-simple-view control for low-spec PCs; does not claim full CPU-only training parity.

## Requirement coverage — not all stages complete
The current source is a *working educational prototype*, not a fully finished industrial simulation product.

| Area | Current evidence | Open requirements |
| --- | --- | --- |
| PLC programming | Editable ladder, branch/contact/coil operations, TON/TOF/RTO/CTU/edges, scan debugging | Structured Text editor and interpreter, broader IEC 61131-3 instruction semantics, typed analog tags, force/watch semantics and vendor reference comparisons |
| Electrical lab | 24V discrete wiring board, motor starter, terminal voltage and fault diagnostics | General-purpose circuit/netlist solver, virtual continuity/resistance with quantified precision and wider industrial component range |
| Machine simulation | Deterministic conveyor, photoeye, diverter and products | Reusable tanks/pumps/pneumatics/lifts and full object/scene authoring; hardware fidelity comparison |
| 3D | Conveyor rendering and status-bound visuals | Interactive equipment-placement editor, scene asset pipeline, LOD and target-device performance budgets |
| Assessment | Local test vectors, commissioning scenarios, fault/mutation analysis, export and replay | Independent expert review of rubric correctness; scenario-authoring and security/assessment integrity review |
| Learning content | 7 catalogue entries marked available, 3 planned | Tank level, star-delta starter, PID and larger graduated curriculum |
| Product | Live, Git-connected HTTPS frontend with direct-route support | Real-browser end-to-end workflows, cross-browser/mobile/low-spec benchmarks, accessibility, dependency/licenses and third-party notices, usability pilot |

## Acceptance gates before calling this fully ready
1. Execute browser UI smoke tests (navigation, 3D, programming, wiring, scoring, local persistence, import/export) in Chrome, Edge, Firefox and relevant mobile browsers.
2. Measure low-spec CPU/GPU/no-WebGL behavior and performance, including runtime memory/heap and load times.
3. Validate scenario outputs and essential safety behaviors against engineer-reviewed reference cases (educational only; no safety-rating claims).
4. Audit dependency licenses, external font/3D content, browser security headers, privacy and accessibility.
5. Complete the missing Stage 2–10 functionality or explicitly reduce project scope with an approved acceptance matrix.

## Release decision
- **Website deploy/build:** GO — live demo usable for testing.
- **Automated engineering gate:** PASS on verified commit.
- **Full PRD acceptance / production release:** NO-GO / incomplete.
- No backend, authentication, employer services or database were added (handled by a separate team).
