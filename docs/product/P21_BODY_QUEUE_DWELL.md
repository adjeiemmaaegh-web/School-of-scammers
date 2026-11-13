# PLC Skills Lab — P21 Sustained Original Carton Queue and Physically Cleared Conveyor Trip

**Date:** 2026-11-13.  
**Exact starting baseline:** P20 CI-green `c6bce8d6839ca6c489a8f62b7c1c5d8814bae548`.  
**Development branch:** `engineering/p21-body-queue-dwell-trip-2026-11-13` and [draft PR #61](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/61).  
All P8–P20 ancestors remain unmerged. Production remains **NO-GO**.

## Product-level engineering gap

P20 upgraded an original single-carton collision against an extended gate into a physically caused, PLC-readable latched belt stop. It did not recognize and time a **second carton accumulating behind a first**. In a real conveyor learning exercise, two bodies queue differently from a body striking a gate: the backpressure must be attributed to the **specific original moving follower and original leader**, persist for a configured contact period, and clear only when the physically blocking product is removed without pretending that a safety-rated motor protection device exists.

P21 adds an opt-in original worker-owned physical model for **genuine body-to-body queue overload**. This stage does not infer actual torque, force or industrial motor temperature.

## Native physics and equipment changes

- `src/plant/world/physics.ts` records `jammedByBody` only when the real 10 ms body collision solver determines that a distinct original body blocks a commanded movement. This is separate from P20's `jammedByGate` provenance and P8's pre-existing visual jam flag. No PLC coils are forced, no external packet is generated, no render-frame contact is trusted and no body is replaced.
- New opt-in `belt.accumulationTripMode=1` and bounded `accumulationDwellMs` (100 to 4000 ms, 50 ms increments; default 500 ms) run purely within the worker-owned equipment state. The test demands that both contact bodies remain on the same genuinely running, powered belt. Continuously repeated contact of the **same follower/leader pair** increments dwell deterministically by 10 ms per physical substep. A new pair, disappearing contact, unpowered/idle belt, or a brief bump cannot legitimately finish the threshold.
- At threshold, the source belt latches a stop with `moving=false`, actual `speed=0`, `accumulationTripped=true` and numeric `queueDwellMs` feedback that is available through the existing real I/O bridge. Its original body IDs and collision/gate tags remain attached in equipment/physics state during the stopped scans rather than being erased by a zero-length movement calculation.
- The P21 latch is independent from P20's gate obstruction origin and P19's power-restoration latch. Defaults for all previous scenes are unchanged: if `accumulationTripMode=0`, P8/P20 still simulate the pre-existing material queue behavior without causing this new latched trip.
- Clearing the condition needs **two actual physical actions**: the original leading body still exists but is genuinely displaced outside its source conveyor by a powered pusher, and then a fresh PLC `CMD_resetJam+` energized rising edge after clearance. Deleting that leader, merely releasing the gate, pulsing reset early, or holding reset high across the incident cannot represent a valid source-belts' recovery. The original follower remains on the source belt and resumes with its same ID.

## Source-grounded lesson in an original scene

The P21 assessment extends the existing original `gate-accumulation` workcell with a learner-placed real pusher rather than inventing a special fixed demonstration controller. This lesson requires the user to author a genuine PLC16 ladder/ST/FBD output strategy. The test's reference ST program is stored **only under `tests/fixtures`**, never embedded as a passing answer in the browser.

The temporary private Worker creates two cartons strictly through **two separate energized Q0.0 feeder pulses**. The original source belt Q0.1 runs, Q0.2 holds the genuine stopper, and I0.1 reflects `belt.OUT_accumulationTripped`. When follower `b2` collides with blocked leader `b1` for the configured 200 ms, the worker verifies the original b1–b2 identity pair, zero commanded travel and the real PLC input.

The learner program must release the stopper and use Q0.4 to extend the real pusher. Only after original `b1` is physically off the 150 mm belt and the real `stopper.OUT_retracted` and `pusher.OUT_extended` signals arrive may the evaluator pulse a **temporary powered maintenance acknowledgement on I0.4**. The learner must issue a fresh real Q0.3 reset, and the same original follower b2 must cross beyond the stopper. The worker must retain both originally spawned bodies (one diverted, one received), with no duplicate, artificial ID or accepted fake clearance.

Three independent source material lots (PRNG seeds 1, 42, 65535) plus exact seed-42 replay are bounded educational production scenarios, with both cardboard and metal represented. Negative controls include early/no reset, a stopper kept extended, no second carton, disconnected original feedback, and a pusher not actuated. Preflight rejects wrong or unpowered terminals before executing. An edited PLC source invalidates any old report; results remain ephemeral and cannot be exported as a real performance certificate.

## Files and verification requirements

Core source: `src/plant/world/{types,physics}.ts`, `src/plant/equipment/transport.ts`, `src/plant/scenes/matrix-p21.ts`, `src/sim/p12-assessment.worker.ts`, `src/ui/sandbox/SceneMatrixPanel.tsx`.  
Automated unit/integration tests: `tests/p21-accumulation-trip.test.ts`, `tests/p21-plc-queue-campaign.test.ts`, and test-only `tests/fixtures/p21-queue-programs.ts`.  
Full browser proof: `scripts/sandbox-p21-real-queue-browser.cjs`, required by `.github/workflows/ci.yml` alongside the entire inherited P1–P20 browser/PLC/3D/offline regression matrix.

**P21 source-development verification requires both exact-final-commit workflows to be successful:** Linux semantic TypeScript, all Vitest, Vite/offline build, Chromium real workcell browser proof, no-WebGL fallback, accessibility, Firefox + WebKit, and separate hosted native Windows Edge. A previous green P20 commit, partial run, source tests alone or initial failures cannot establish P21 completion.

## Known limits and release restrictions

The contact model remains axis-aligned simplified deterministic teaching physics, not a calibrated multi-body rigid/contact solver. It does not measure actual belt torque, motor current, pusher force, machine guarding, E-stop, pressure accumulation, acceleration wear, SIL/PL, certified industrial power interlocks or long-term stochastic reliability. Exact geometry applies only to the lesson's configured gate/pusher/belt and does not certify 21-scene parity.

Owner-run physical Windows 11 low-spec/8GB/no-GPU real WebGL testing, genuine PLC/vendor networking, instructor/customer manual QA, licensing/security/legal/accessibility acceptance, full stacked PR reconciliation and explicit selective merge/deployment authorization remain **OPEN**.

**This is source development only. PR #61 is draft/unmerged. Production NO-GO. No backend, accounts, database, cloud, payments or real industrial outputs are authorized.**
