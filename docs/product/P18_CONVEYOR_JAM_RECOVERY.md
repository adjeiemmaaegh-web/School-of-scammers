# PLC Skills Lab — P18 Conveyor Jam, Maintenance Reset and Same-Body Recovery

**Development date:** 2026-11-13.  
**Exact starting source:** P17 verified `bb4cafbfc1c6bc8af15ea3a35f28adb487091d28`.  
**Branch:** `engineering/p18-conveyor-jam-recovery-2026-11-13`; **review:** [draft PR #58](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/58).  
**Release status:** NO-GO. All parent P8–P17 draft PRs remain unmerged.

## Purpose and bounded scope

P17 independently exercised different seeded material arrival sequences and verified workcell-specific original-product quality. It did not exercise actual **conveyor failure, persistent equipment-stop acknowledgement, or interruption of material transportation during processing**. P18 adds an opt-in teaching model for these boundaries, initially scoped to the original three-cylinder bottle-line workcell.

The belt-conveyor model now exposes `CMD_resetJam+` as an actual 24 V load and retains `OUT_jam` as actual 24 V sensor output. Setting `belt.jamResetMode=1` enables a **physical stop latch**: a registered `belt-jammed` machine fault stops the drive and forces its measured speed to zero. Mechanical repair alone removes the immediate fault but leaves the simulated machine latched and its real jam signal asserted. Only a **new low-to-high resetJam command edge** arriving through the learner's powered PLC after repair clears the latch and permits belt motion. A reset held high before repair, a pulse while the machine is still jammed, or fault removal without acknowledgement cannot clear the jam.

The default `jamResetMode=0` deliberately retains the previously saved project's legacy behavior and signal mapping; P1–P17 tests are regression gates, not automatically migrated. This is **not a safety-rated emergency stop, an industrial drive safety function or a real machinery restart permission**.

## Real PLC-controlled learner challenge

The P18 trial is available in the existing original bottle-line's multi-case assessment panel, subject to physical terminal wiring and the opt-in jam mode. The user must independently author a valid PLC program; there is no hidden reference controller in the learning simulator:

- First, temporary genuine 24 V Start is pressed to PLC I0.0. Original PLC coils drive feeder Q0.0, belt run Q0.1, fill Q0.2, cap Q0.3, and new belt reset Q0.4. Original powered process sensors occupy I0.1–I0.5.
- The real belt jam signal `belt.OUT_jam` is connected to PLC I0.6. An evaluator-only temporary **maintenance acknowledgement pushbutton**, powered from the existing 24 V source, is connected to I0.7. The test does not force output coils, create a replacement body, change the user's program or store extra button objects.
- Once a specific original bottle (1, 2 or 3) is **actually moving on the original belt**, the private simulator injects a registered `belt-jammed` fault. The target cylinder must physically stop and remain unprocessed while the jam signal is true. The scorer observes its original body ID, worker coordinates and actual sensor values.
- A private mechanical-service operation clears the fault but **does not** automatically clear the jam latch. The scorer proves the same original item remains stopped across a second observation window.
- Only **after repair**, an operator pulses the separate real 24 V acknowledgement button. A passing learner PLC detects the jam and acknowledgement, momentarily energizes Q0.4, and resets the actual belt on a fresh command edge. The same cylinder must resume and physically finish filling at least 500 mL and capping; all three original bottles must complete without duplication, deletion, phantom output or oversupply.
- Three independent test source profiles target original bottle 1, 2 and 3 with deterministic feeder seeds 1, 42 and 65535. A repeated source/seed/position must yield exactly the same resulting worker evidence.
- Independent negative controls reject a reset never issued, reset permanently held high, wrong PLC Start program, missing belt jam sensor, unpowered/disconnected reset command, invalid seed and invalid fault selection. The auditor's final pass is based exclusively on actual physical Worker state and electrical PLC outputs.

## Code and evidence

- `src/plant/equipment/transport.ts` and `src/plant/world/types.ts` implement the opt-in belt reset command and latched-stop model, including a previous-command edge record.
- `src/plant/scenes/matrix-p18.ts` defines the private, deterministic, source-preserving bounded trial, preflight constraints and body/PLC measurements.
- `src/sim/p12-assessment.worker.ts` adds `run-jam-recovery` to the isolated offline local assessment Worker; there are no timers, online calls, storage writes, backend requests or live PLC outputs.
- `src/ui/sandbox/SceneMatrixPanel.tsx` adds an accessible, explicit P18 assessment button, missing wiring feedback, per-gate results, model-only throughput and original bottle ID.
- `tests/p18-conveyor-recovery.test.ts` includes both direct machine tests and real three-bottle PLC source/controller runs, negative controls and deterministic replay.
- `scripts/sandbox-p18-conveyor-jam-browser.cjs` loads the authentic unsolved original bottle scene, configures an independently authored PLC and real wires, verifies the private Worker and UI, rejects a false reset program and confirms no persisted test artifacts.
- `.github/workflows/ci.yml` makes browser acceptance mandatory alongside full inherited P1–P17 simulations, semantic TypeScript and build, offline checks, accessibility, no-WebGL, Firefox, WebKit and separate native hosted Windows Edge.

## Boundaries / unresolved acceptance

The registered jam is **instructor-controlled and simulated**. It does not establish any actual conveyor torque/current response, physical safety enclosure, emergency stop redundancy, OSHA/ISO functional safety standard, validated restart logic on real drives, certified PLC/fieldbus communications, automatic machine vision, real stochastic line reliability, independent instructor assessment or true industrial throughput. The three-product scope is an educational commissioning demonstration, not a high-volume factory endurance study. Further work may include jam recovery on other transports, collision-initiated jam classification, power-loss restart interlocks and adversarial human safety.

Owner-run actual Windows 11 8 GB/no-GPU tests, real WebGL and PLC hardware, accessibility/manual field QA, legal/security/licensing, customer acceptance, full stacked-PR reconciliation and any merge or deployment are **OPEN**. The existing backend/accounts/database/cloud/payment scope stays outside this frontend lab.

**Do not mark P18 development verified until the final exact commit has completed successful Linux and hosted Windows Edge workflows. Do not call it production-accepted based on automated simulation alone.**
