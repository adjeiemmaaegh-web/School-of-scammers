# PLC Skills Lab P22 — Original Physical Zone Occupancy and PLC Feeder Backpressure Control

**Started:** 2026-11-13. **Exact starting source:** verified P21 commit `557244087d8aadb85b236f1d692587b0dae8a52e` (draft PR #61).  
**Branch:** `engineering/p22-physical-zone-occupancy-2026-11-13`.  
**Status:** engineering candidate; exact-head Linux and Windows CI must be inspected before declaring software stage complete. Draft and unmerged; no deployment.

## The next training problem

P21 taught a PLC to stop a conveyor after a genuine sustained two-carton jam and to physically recover it. It had no way for the upstream feeder to see a **pre-trip full lane**. The next controller could simply wait for the tripped signal and feed an unnecessary third carton during the 200ms contact dwell.

P22 adds **opt-in worker-owned source-zone occupancy** and a real PLC input. The training challenge requires authored PLC logic to prevent an upstream feed when both original cartons physically occupy the source belt **before** P21's accumulation trip. After the original physical pusher and fresh reset recover b1/b2, the learner must feed an independently requested third original carton through the real Q0.0 feeder channel. This is a bounded, center-of-body footprint teaching sensor, **not** a calibrated optical sensor, industrial zone-control safety system, torque limit, crush detector or physical PLC interface.

## Equipment and legacy compatibility

In the existing `belt-conveyor`, `zoneSensorMode=0` is the default; P8–P21 legacy scenes remain unchanged and all new telemetry is false/zero unless expressly enabled. With `zoneSensorMode=1`, `zoneCapacity` is configurable **1–5 original bodies**, default 2.

New actual worker-owned signals:
- `OUT_zoneOccupied` — a body is physically supported by this belt inside its actual yaw-adjusted footprint.
- `OUT_zoneFull` — physical count reaches or exceeds the configured capacity.
- `AN_zoneCount` — numeric body count, not a PLC count register.

The worker reads original `World.bodies`, checks `supportedBy===belt.id` and the real conveyor bounds, and does not trust body jam tags, rendered coordinates, phantom feeder pulses, other belts or the transient training-operator sprite. This detects **occupancy**, not pressure; no automatic motor or feeder shutdown is inserted. The learner's **actual powered PLC output** must inhibit upstream feed. Removal of original leader b1 from the source belt decreases count while P21's jam latch stays active until a fresh physical reset.

## Offline PLC commissioning

Reuse the original `gate-accumulation` scene with P21's required feeder/belt/stopper/pusher, genuine 24V wiring, `accumulationTripMode=1`, `accumulationDwellMs=200`, `jamResetMode=1`, and `obstructionTripMode=0`. Add `zoneSensorMode=1`, `zoneCapacity=2` and `belt.OUT_zoneFull → scene-plc.I0.5`. The private test Worker supplies a temporary real powered **next-carton request on I0.6**, independent of the P21 Start I0.0 and reset-acknowledge I0.4.

The assessment explicitly witnesses all of these events from the actual original simulation:
1. True idle on the isolated powered 16-input PLC, followed by two *separate* genuine Q0.0 pulses that create b1 and b2.
2. Actual zoneCount 2 and zoneFull I0.5 while **accumulationTripped is still false**.
3. A powered third-feed request on I0.6; a safe learner program does **not** energize Q0.0 or manufacture a third carton during this full-zone condition.
4. The original b2-to-b1 physical contact accumulates and trips P21's belt. Learner outputs retract the real stopper and physically push original b1 off the source belt; zoneCount drops 2→1 while belt remains latched.
5. A fresh 24V acknowledgement causes real Q0.3 reset; original b2 crosses the gate; only then does a new powered I0.6 request cause original b3 from a genuine Q0.0 rising edge. No product is destroyed or fabricated.
6. Independent material seeds **1, 42, 65535** and exact seed-42 replay; the 3 lots must conserve **9 original source cartons** and include cardboard and metal.

Wrong PLC controllers that feed when only `accumulationTripped` is false, feed immediately on I0.6, never feed after clearance, or omit reset must be rejected. Missing real zone-full signal wiring, incorrect settings, invalid geometry and feeder/pusher disconnects must be blocked before assessment. Test-only reference source lives in `tests/fixtures/p22-zone-programs.ts`, not shipped in the learner app. The report is ephemeral, signature-invalidated and never exported as certification.

## Engineering files and gates

- Native equipment: `src/plant/equipment/transport.ts`
- Offline source-owned worker challenge: `src/plant/scenes/matrix-p22.ts`, `src/sim/p12-assessment.worker.ts`
- Learner commissioning UI: `src/ui/sandbox/SceneMatrixPanel.tsx`
- Direct physics and real PLC/negative tests: `tests/p22-real-zone-capacity.test.ts`, `tests/fixtures/p22-zone-programs.ts`
- Mandatory browser proof: `scripts/sandbox-p22-real-zone-browser.cjs` added to Linux CI alongside all P1–P21 regressions.

**Do not call P22 verified based on file presence or earlier P21 checks.** Gate: exact-final-commit TypeScript, full Vitest, production/offline build, real Chromium source-authored P22 positive/incorrect program tests, inherited Chromium, Firefox/WebKit, accessibility and no-WebGL; separately hosted Windows Edge. Record any failing assertion and fix production semantics, never simply delete a check.

## Explicit NO-GO boundaries

This does not implement true photoelectric beam geometry for the new belt-wide derived sensor, industrial multi-zone conveyor safety, actual belt load/current/torque, real PLC/vendor networking, machine safeguarding, personnel detection, physical anti-crush controls, long-shift reliability, or certified industrial overload prevention. Owner-run low-spec Windows 11 real GPU/WebGL, hardware PLC and physical store/line validation, instructor/student assessment, full stack of unmerged P8–P21 draft PRs, asset/legal/security review and explicit selective merge/deployment signoff remain open. Backend, accounts, cloud, payments and live industrial outputs are excluded.
