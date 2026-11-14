# PLC Skills Lab — P15 Autonomous Factory Process Completion

**Engineering date:** 2026-11-12  
**Parent:** exact P14 green head `535f303e5f044692aaf42988f4d8fc2c17cf1b7f`.  
**PR:** [#55](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/55), draft/open/unmerged; contains earlier P15 repeat-production and the autonomous expansion.  
**Software verification:** MUST be established on the exact final commit by complete Linux and hosted Windows CI, not by any historical ancestor.  
**Product release:** NO-GO. No merge/deploy/hardware/network/payments/backend is authorized.

## P15 delivered engineering scope

The previously verified P15 repeat-production assessment uses 24V PLC outputs and private operator-commanded test switches with unique body identities. The autonomous expansion now adds an **independent one-start training trial** for each of four original factory scenes. In these trials, the only test button is the initial Start contact; all subsequent worker motions depend on the actual learner PLC program's outputs and real connected feedback sensors. The scorer never forces PLC coils, generates bodies itself, substitutes renderer coordinates for physics, or persists a result.

| Original workcell | Worker-owned autonomous process | Physical proof and fault |
| --- | --- | --- |
| Gantry transfer | 3 separately generated feeder cartons, physical pickup detection, gripper feedback, X-axis transport, release and home with a powered exit conveyor | Three conserved original body IDs beyond x=500; registered gripper leak blocks item 2 and repair continues that same item |
| Palletizing | 8 original cartons, pickup photoeye and part-held feedback, distinct PLC pick/place edges, two-layer 2×2 support positions, pattern-full feedback | 8 unique stable `palletSlot`/`palletLayer` tags, no ninth placement; item 2 gripper failure requires PLC-driven retry pulses before recovery |
| Robot material sorting | 3 original cartons, actual inductive material sensor, separate true pickup sensor, opt-in robot routing and two independently powered output conveyor lanes | Actual seeded metal and cardboard classified and released at opposite physical y-locations; robot latches each route during pickup; gripper leak blocks and then recovers original item 2 |
| Bottle production | 3 physically seeded cylinders, slow conveyor, three independently sensed process zones, volume feedback and capped feedback | Each original bottle gets at least 500 mL measured process fill before cap; feeder and conveyance run only from PLC Qs; a blocked nozzle holds item 2 at the filler until repair |

## Source boundaries and negative controls

- All scenarios reuse the existing deterministic 50 ms PLC / five 10 ms world-substep simulation. Tests run genuine PLC electrical output terminals with real powered plant sensors and a private Start contact. They accept structurally different learner controllers (CASE and IF/ELSIF), not a hard-coded program signature.
- Source physical models include per-bottle cap dwell tied to the bottle's real ID, finite bodies, conveyor contact, bounded pallet count and opt-in physically separated robot lanes. Existing projects without robot `sortMode=1` retain the previous unsorted behavior.
- In the robot workcell, the material class is not injected by the test: seeded original feeder products include both metal and cardboard; actual inductive output drives the PLC input. A wrong program that always selects one lane fails.
- Source tests reject constant-ON/constant-OFF controllers, disconnected sensing, nonexistent 24 V feedback, missing route output, pre-existing faults, reserved fixture collisions, false product accounting, and unsafe idle.
- No fixture input switch, score, physics body, fault condition, test result or evaluation-specific source signature can contaminate the learner's saved project. Source edits/reloads invalidate all displayed reports.

## Verification files

- Source tests: `tests/p15-multiproduct-process.test.ts`, `tests/p15-autonomous-robot-sort.test.ts`, `tests/p15-autonomous-factory.test.ts`.
- Mandatory browser: `scripts/sandbox-p15-multiproduct-browser.cjs`, `scripts/sandbox-p15-autonomous-robot-browser.cjs`, `scripts/sandbox-p15-autonomous-factory-browser.cjs`.
- Assessment engines: `src/plant/scenes/matrix-p15.ts`, `matrix-p15-autonomous.ts`, `matrix-p15-autonomous-factory.ts`, run in the private `src/sim/p12-assessment.worker.ts`.
- UI: `src/ui/sandbox/SceneMatrixPanel.tsx`. The existing P12/P13/P14 four-case checks remain accessible and still required by CI.
- Existing `.github/workflows/ci.yml` runs full source/semantic TypeScript, Vitest, production/offline budget and the original P1–P14 browser tests plus three new P15 Chromium paths, accessibility/no-WebGL, Firefox/WebKit and hosted native Windows Edge separately.

## Claims NOT established by these tests

This is **credible bounded educational factory-process source behavior**, not industrial qualification. No claim is made of high-volume industrial throughput/MTBF, validated mechanical forces or safety-rated stop, vendor-equivalent IEC semantics or kinematics, live physical PLC/Siemens Ethernet, calibrated fill-volume metrology, sanitary or manufacturing compliance, real camera/robot measurements, comprehensive vendor parity or all instructor-solution correctness. Model-only throughput refers to work-completed per *simulated* hour; it must never be advertised as real productivity.

Owner-run actual 8 GB/no-GPU Windows acceptance, physical PLC trials, cross-device assessment, WCAG manual/accessibility field audit, legal asset licensing and commercial safety review remain unverified. Final overlapping draft PR reconciliation, selective merge and any deployment require separate owner approval. No backend, accounts, cloud infrastructure or payments are in this product's current development scope.

**P15 autonomous source development must not be described as CI-verified until the final exact GitHub commit has two completed SUCCESS workflow runs. P15 software development and product acceptance are distinct gates.**
