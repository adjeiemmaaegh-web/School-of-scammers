# PLC Skills Lab — P16 Fault Resilience, Deterministic Replay and Assessment Integrity

**Stage:** P16 engineering increment, defined after P15's bounded autonomous four-workcell completion on 2026-11-12. No earlier P16 milestone/PR was present in the source repository.  
**Authoritative starting source:** P15 exact GitHub Linux/Windows CI-green `ad5b49673e142d6a730a975c486c30c4fcc964c5`.  
**P16 branch:** `engineering/p16-fault-resilience-audit-2026-11-12`.  
**Review PR:** [Draft #56](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/56). Never merge without owner approval. No deployment.

## Development scope and physically observable proof

P15's autonomous trials injected one registered equipment fault only on the second real source body. This leaves a timing blind spot: an incorrect PLC program might recover from a failure only at that precise point in the sequence.

P16 adds an **isolated four-profile fault-position and scorer-integrity audit** for the same original advanced workcells. The four positive trials run independently on fresh deterministic real plant/PLC Worker copies, with only a genuine 24 V Start pulse and ordinary equipment-fault injection. All feeder and actuator commands remain the learner's own powered PLC Q outputs; no assessor forces a PLC coil, creates a workpiece, edits an original body, fabricates a target signal or reads rendering state as evidence.

| Workcell | Items in each autonomous batch | Actual registered physical faults injected in separate trials |
| --- | --- | --- |
| Gantry transfer | 3 original cartons | Gripper leak on carton 1, 2, 3 |
| Robot metal/plain sorting | 3 original cartons | Robot gripper leak on carton 1, 2, 3; real inductive classification and separate receiving lanes remain required |
| Bottle fill/cap | 3 original cylinders | Blocked filler nozzle on bottle 1, 2, 3; conveyor stops at nozzle and same bottle must recover |
| Palletizer | 8 original cartons in 2×2×2 pattern | Gripper fault on carton 1, 4, 8; each physical pick uses a new commanded rising edge |

Per workcell, P16 requires (1) first-item fault recovery, (2) middle-item fault recovery, (3) last-item fault recovery, and (4) **repeat of the middle-item run** proving identical status, original-product counts, recovery status, simulated duration and model-only throughput. Each positive run checks actual worker-supported material outcomes, unique seeded physical identities and no ghost production.

After real positive trials, the auditor independently substitutes deliberately invalid training-only PLC controller and machine wiring in fresh private test copies; these are **never** included in learners' original files or offered as controller solutions:

1. Constant-ON PLC outputs must be **rejected** by the real engine's safe-idle condition.
2. Constant-OFF PLC outputs must **fail** because no genuinely controlled physical output batch completes.
3. The real pickup/fill feedback sensor disconnected from the PLC must **block** the assessment before any claim of success.
4. A real unpowered PLC (`scene-plc.L+` disconnected) must also **block**, not produce imagined motion.

The only passing P16 result requires all three independent fault locations, exact deterministic replay, all four negative controls, unmodified original source signature and bounded, finite model metrics. Source or scene edits terminate the Worker, invalidate visible results and prevent grade reuse. Scores, fault fixtures and temporary switches are not persisted or exported.

## Engineering implementation and verification

- `src/plant/scenes/matrix-p15-autonomous.ts` and `matrix-p15-autonomous-factory.ts` gain a bounded **optional** `faultAtProduct` selector; without this option they retain their P15's original second-item fault behavior, preserving backwards compatibility.
- `src/plant/scenes/matrix-p16.ts` implements the strict private multi-profile scorer, replay and adversarial checks.
- `src/sim/p12-assessment.worker.ts` runs the audit in the pre-existing dedicated offline browser Worker, without fetch, timers, network, localStorage, backend or external PLC.
- `src/ui/sandbox/SceneMatrixPanel.tsx` provides a separate accessible P16 audit action, four physical profile outcomes and four control results, plus simulated timing and explicit training-only metric labels.
- `tests/fixtures/p16-autonomous-programs.ts` contains source-only reference programs used strictly in automated tests, never secretly installed into the learning platform.
- `tests/p16-fault-resilience.test.ts` exercises all four real autonomous scenes, replay, anti-bypass, invalid timing, source edit failure and missing-feedback blocking.
- `scripts/sandbox-p16-resilience-browser.cjs` exercises original unsolved scene loading, browser-authored PLC source/wires, P16 isolated-worker pass for robot and bottle, all four negative controls, wrong-program failure and no persisted fixture/grade.
- `.github/workflows/ci.yml` makes browser P16 acceptance mandatory alongside all P1–P15 regressions and semantic TypeScript, Vitest, Vite/offline builds, no-WebGL, accessibility and Firefox/WebKit. The separate hosted Windows Edge workflow remains required on the exact final P16 commit.

## Release boundaries

An assessor-controlled fault is simulated training QA, not unscripted evidence of a real plant failure or all faults. These deterministic educational models do not establish industrial PLC/IEC vendor equivalence, safety-rated motion or E-stop, real robotics kinematics, sanitary filling controls, calibrated physical throughput, stochastic production loads, very long endurance/mean time between failures, security/legal/asset signoff, Factory I/O feature parity, or real hardware interoperability.

Physical owner-run testing on an actual 8 GB/no-GPU Windows device, manual cross-browser/keyboard/WCAG QA, instructor/learner acceptance, real PLC/network IO, legal review, complete stacked PR reconciliation and any selective merge remain **OPEN**. Business backend/authentication/database/cloud/payments and live machine outputs remain outside this engineering increment.

**Never mark P16 source development verified until BOTH final SHA GitHub workflows have completed successfully. Production acceptance stays NO-GO regardless of CI results.**
