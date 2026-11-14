# PLC Skills Lab P25 — Genuine Stuck Outfeed, Fault-Latched Lamp and Fresh Maintenance Retry

**Baseline:** exact P24 source SHA `3b32d713d77a90d0c439551f2eb2f985398ed7fb` (draft PR #64, unmerged). **Stage branch:** `engineering/p25-outfeed-fault-retry-2026-11-14`. Development-only; no cloud, backend, payments, real PLC actuation or merge/deploy authority.

## Stage goal

P24 introduced original body b2 physically held at a secondary stopper for at least 200 ms; a powered I1.0 release immediately moved the healthy gate. P25 tests a crucial harder case: **what if the learner PLC removes release coil Q0.6, but actual stopper I1.2 never changes because the equipment has a genuine registered mechanical `stuck-extended` fault?** Correct logic must not infer clearance or auto-restart merely from deenergising a coil or repairing the mechanical fault.

P25 adds no fabricated physics, no new AI, no test-only output forcing, and no acceptance certification. It reuses **the existing real worker `outstop.stuck-extended` fault** while the same genuine b2 remains in physical contact; the original P24 200ms contact is required. A PLC-controlled 24V pilot lamp demonstrates how to latch visible fault diagnostics.

## Exact training circuit

Retain all original P21–P24 feeder, original belts, physical gate, pusher, source jam reset, receiver Q0.5, source/receiver occupancy I0.5/I0.7, outstop motor Q0.6, physical extended I1.1, retracted I1.2, held-load I1.3 and private release I1.0.

Add one **real `lamp` component** `outfeed-alarm` at (710,480), connect `scene-plc.Q0.7 → outfeed-alarm.L+`, and `scene-supply.M0 → outfeed-alarm.M-`. The real electrical solver's `deviceOn['outfeed-alarm']` must be true; PLC Q0.7 by itself is insufficient. The isolated assessor creates a private 24V-powered `p25-retry` pushbutton mapped to **PLC I1.4**, only inside its cloned world. It must NOT be saved to the learner's project.

## Genuinely observed original-material campaign

1. P24's real b1/b2 feeder, source body-to-body dwell trip, PLC-driven pusher, fresh Q0.3 reset and same original b2 physical receiver handoff occur in the normal worker.
2. Early powered I1.0 release while original b2 has not physically completed 200ms outstop contact is forbidden.
3. Same original b2 jams the actual extended `outstop` for ≥200ms, the real `OUT_heldLoad → I1.3` is HIGH, b2 is stationary under running powered receiver Q0.5, and third feeder demand is inhibited while the receiver is full.
4. The independent private Worker **pauses**, invokes real `setPlantFault('outstop','stuck-extended')`, then resumes the same plant. The fault is not synthetic PLC input or a fabricated failure flag.
5. Fresh powered release I1.0 makes the learner command Q0.6 OFF; the real faulted gate stays mechanically extended, physical retracted I1.2 remains LOW, and original b2 does not advance.
6. Within a bounded 8-scan (~400ms) learner-programmed timer, the absent **actual I1.2** causes a latched PLC recovery fault. The learner reasserts Q0.6, powers Q0.7 and the genuine 24V lamp. A new I0.6 demand cannot create b3 while b2 is held. Wrong programs that rely only on timers, drop the alarm, or ignore actual retracted limit fail.
7. The Worker **pauses and repairs** the actual registered mechanical fault by `setPlantFault('outstop',null)`, then resumes. For at least 12 more scans, the PLC must maintain Q0.6 ON, lamp ON, I1.2 LOW, original b2 fixed. A new feeder demand is still inhibited. Repair alone MUST NOT auto-release.
8. A separate, fresh, electrically powered I1.4 retry authorizes a SECOND genuine release attempt. Q0.6 drops, real I1.2 becomes HIGH, the true lamp circuit de-energizes, the same original b2 advances and exits the receiver (I0.7 LOW), and only a subsequent powered I0.6 request may generate new original b3.
9. Repeat on seeds 1, 42, 65535 plus exact seed-42 replay; nine genuine b1/b2/b3 originals, material diversity, duplicate prevention, all body conservation and original learner-project signature preserved. No fabricated packages, debug-forced PLC outputs, persisted certificates or teacher-supplied passing source.

### Negative-source and preflight cases

Test-only correct and wrong ST controller programs live **exclusively** at `tests/fixtures/p25-fault-retry-programs.ts`. Reject `ignore-limit`, `no-timeout`, `auto-retry`, `never-retry`, `unsafe-feed`, `no-alarm` and `premature-release` on authentic physical/electrical evidence, not regex source matching. Reject wrong Q0.7 circuit, missing lamp/return, occupied maintenance I1.4, non-original P24 wiring, pre-existing unrelated faults and wrong original scene.

## Evidence and stage acceptance

- `src/plant/scenes/matrix-p25.ts`: independent, bounded, copied original worker world; registered outstop fault, genuine electrical lamp and powered retry. No production engine semantics altered.
- `src/sim/p12-assessment.worker.ts`, `src/ui/sandbox/SceneMatrixPanel.tsx`: isolated worker route and source-signature-invalidated ephemeral UI.
- `tests/p25-real-outfeed-fault-retry.test.ts`: native actual physical `stuck-extended` mechanics, positive original PLC multi-seed evidence, program negative controls and hard preflight.
- `scripts/sandbox-p25-stuck-outfeed-retry-browser.cjs`: mandatory Chromium from unsolved original scene to authored real I/O, three seeded authentic physical lots, negative missing-timeout PLC rejection.
- `.github/workflows/ci.yml`: required P25 browser plus inherited complete P1–P24 suite.

**Software acceptance is not source presence.** Require exact-final-head Linux offline gate, semantic TypeScript, full Vitest, production/offline bundle budgets, mandatory P25 Chrome good/bad assessment, all inherited P1–P24 browser regressions, Firefox/WebKit, no-WebGL, WCAG and separately hosted genuine Windows Edge success. Report failures without hiding intermediate mistakes.

**Not industrial safety:** Motor power and stopper movement are bounded deterministic teaching approximations. This is not a tested physical E-stop, functional-safety architecture, real PLC firmware/equipment communication, machine safety/anti-crush/force certification, or proof of actual Windows 11 8GB/no-dGPU GPU performance. Owner-run field hardware QA, teaching validation, license/security/asset review, resolution of the long stacked unmerged PR chain and explicit release/merge approval remain OPEN. Public production **NO-GO**.
