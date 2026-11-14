# PLC Skills Lab — P20 Physically Triggered Gate Obstruction and Original-Carton PLC Recovery

**Date:** 2026-11-13. **Baseline:** P19 CI-green exact `ae1ce1061acbed9ecc531fb918e67695ad87ea96`.  
**Branch:** `engineering/p20-physical-obstruction-trip-2026-11-13` — review-only, draft and unmerged; previous P8–P19 drafts remain unmerged.  
**Production:** NO-GO.

## Why this is a product-engineering increment

P18 and P19 used instructor-registered equipment fault events and genuine powered electrical faults. P8 already showed real collision and material queueing: a body blocked by an extended gate or fixed solid gained a `jammed` tag, but the drive could continue to show `moving=true` even though the material had stopped, and no post-clearance PLC acknowledgment was required. This misleading process gap is materially different from P18's manually injected `belt-jammed` flag.

P20 implements **actual body-to-gate collision-triggered belt trip** in the worker-owned 10 ms physics loop. It keeps the existing untouched behavior as the default for all old scenes.

## The new physical model and observable evidence

- `belt-conveyor.obstructionTripMode=1` is explicitly **opt-in**. Setting 0 retains the existing P8 queued-body/free-drive behavior. P20 is separate from `jamResetMode` and `restartHoldMode`. All three default to zero to avoid silent alteration of inherited simulation projects. The P20 assessment requires the first two enabled.
- `src/plant/world/physics.ts` now records **the ID of the actually extended gate that physically blocked a moving original body** in `body.tags.jammedByGate`. It never invents a body, sets a PLC Q terminal, moves a gate for the learner or uses the renderer as evidence. Existing queue/contact geometry is preserved.
- On the NEXT worker equipment step, `src/plant/equipment/transport.ts` checks that an original body with this gate-contact provenance is still on the source belt and that the exact obstructing gate is **physically engaged**. The opt-in belt latches `stalled=true`, `moving=false`, `speed=0` and sets an authentic `OUT_obstructionTripped` sensor. Equipment state remembers the **original body ID and obstructing gate ID** until a legitimate reset.
- The worker physically stops the supported body's residual carrier velocity while that obstruction latch remains active, not just its on-screen animation. That carton and its identity are conserved during any wait.
- Pressing a reset **while the gate is still mechanically engaged** cannot clear this latch. When the PLC actually retracts the stopper, the body and belt remain stopped even though the previous contact no longer physically obstructs travel. A separate **new, electrically energized `CMD_resetJam+` rising edge**, after mechanical clearance and with the original body still physically on the source belt, is required to release the latch. Unrelated P18 registered jams and P19 power restoration remain independent gates.
- The worker publishes real `jam` and `obstructionTripped` feedback; its event log identifies the original body and obstructing gate. This is deterministic teaching physics, **not safety-rated guard monitoring, motor torque modeling, calibrated contact force or emergency stop**.

## Real offline PLC commissioning exercise

The P20 section in the existing original `gate-accumulation` scene requires the learner to:
1. Move its original feeder into the real belt pickup area (the shipped scene's nominal reference layout has a feeder away from the 600 mm pickup footprint), leaving the original gate at its physical outbound position.
2. Wire a real single 16/16 PLC and 24 V supply: Q0.0 pulses the feeder; Q0.1 runs the belt; Q0.2 extends/retracts the stopper; Q0.3 resets the belt only following clearance. Belt `OUT_obstructionTripped` supplies I0.1 and real stopper `OUT_retracted` supplies I0.2. The private audit temporarily energizes real I0.0 Start and I0.3 maintenance acknowledgement from 24 V buttons, never forces a Q.
3. Commission one real original box, wait for the **actual extended gate/body collision**, witness the physically stopped body and PLC jam sensor, then command stopper release from the user's own PLC logic. The belt must remain latched through clearance until a fresh maintenance reset pulse; the **same original ID** must then pass beyond the gate.
4. Complete three different seeded feeder lots (seed 1, 42, 65535), prove both source material classes occur, conserve three real originally spawned cartons, and independently replay seed 42 to the **exact same physical and PLC evidence**. Both unsafe early-reset Q and missing-reset Q source fail, as do an unreleased gate, missing feed or absent genuine sensor/wiring.

No stored grade, test body, teacher-only PLC source, private button, or fake contact is installed into the learner's project. Assessment occurs in the existing offline private Worker and is invalidated immediately on source edits.

## Artifacts and verification

- Plant core: `src/plant/world/physics.ts`, `src/plant/world/types.ts`, `src/plant/equipment/transport.ts`.
- Physically grounded isolated assessment: `src/plant/scenes/matrix-p20.ts`, `src/sim/p12-assessment.worker.ts` and accessible `src/ui/sandbox/SceneMatrixPanel.tsx`.
- Real geometry and negative tests: `tests/p20-obstruction-latch.test.ts`, instructor-only test fixture `tests/fixtures/p20-gate-programs.ts`.
- Mandatory Chromium browser acceptance: `scripts/sandbox-p20-physical-obstruction-browser.cjs` wired into `.github/workflows/ci.yml`, alongside all inherited P1–P19 browser scenarios, TypeScript/Vitest/Vite production build, offline, accessibility, no-WebGL, Firefox/WebKit and separate hosted Windows Edge.
- **Final exact-head GitHub Linux and Windows Actions must both be successful** before describing P20 as source-development verified. Earlier P19 CI-green does not verify this new behavior.

## NO-GO acceptance register

This is a deterministic single-original-gate educational trial, not a full conveyor jam classification across all machine families. Real motor-current trip detection, accumulation force/pressure, queue backpressure, gates in multiple axes, hardware relays/PLC IO, machine-safety rated emergency stops, calibrated reliability and physically measured material throughput remain open. Real 8 GB Windows/no-GPU WebGL acceptance, real PLC vendor/protocol verification, instructor and manual accessibility QA, security/asset/license review, stacked ancestor PR reconciliation and owner deployment authorization remain unresolved.

**Do not merge or deploy this draft. No backend, database, cloud, accounts, payments or live PLC actions are authorized.**
