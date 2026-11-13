# PLC Skills Lab P24 — Original Physical Downstream Hold and Powered Release

**2026-11-13 source parent:** verified P23 `2cce7dfa5837e511756c649284f2b6620f97bf2b`, draft PR #63 (unmerged). P24 draft branch `engineering/p24-real-downstream-hold-release-2026-11-13`; no deployment or merge authorization.

## Why P24 exists

P23 proved the same source-original b2 could enter a separately powered receiving belt, occupy real worker-derived zone-full PLC I0.7 and prohibit new feeder demand while present. Its b2 then simply left the receiving belt unhindered. Industrial-process education must also teach **a mechanically blocked downstream station that continues to occupy the receiving lane until genuine physical release**, and distinguish a real jammed carton from a prematurely issued release.

P24 adds an **opt-in physical hold-dwell signal** to the existing real stopper equipment. Legacy scenes default `holdSensorMode=0`, producing false/0 new signals and retaining P1–P23 semantics. When `holdSensorMode=1`, `holdDwellMs` is bounded from 100 to 4000 ms (50 ms steps, default 200). The same worker-owned physical body must persistently hold `tags.jammed===true`, `tags.jammedByGate===stopper.id`, a non-null physical support and **actual in-range position** against an engaged stopper. A new body, distant stale tag, loss of contact or retracting stopper restarts/resets the dwell. Stopper outputs:
- `OUT_heldLoad` — true only when same-body physical contact remains for the configured continuous duration;
- `AN_heldDwellMs` — bounded accumulated actual worker substep milliseconds, false/zero in legacy mode.

The physical report is **not a force/current/torque measurement, calibrated limit switch, industrial fault detector, anti-crush protection or safety-rated sensor**.

## Original gated receiving station

Reuse P23 feeder, source belt at (455,225), physically accumulated original pair, actual pusher/reset, adjacent 600×150 receiver at (515,225), PLC Q0.5 motor and real I0.7 full-zone feedback. Add one **original outstop at (535,225)**; settings `travelMs=100`, `holdSensorMode=1`, `holdDwellMs=200`, genuine 24V power and return.

New real terminals: `scene-plc.Q0.6 -> outstop.CMD_extend+`, `outstop.OUT_extended -> I0.9`, `outstop.OUT_retracted -> I0.10`, `outstop.OUT_heldLoad -> I0.11`. An independent **privately cloned powered release pushbutton at PLC I0.8** is introduced exclusively during testing, alongside prior START I0.0, ACK I0.4, MORE I0.6. No output forcing or fabricated body injection. All original learner source remains intact.

## Observable original-body contract

1. Original b1/b2 feeder pulses and source-zone I0.5 pre-trip inhibit; P21 genuine physical contact/dwell jam, powered pusher clears b1, then fresh Q0.3 reset frees same b2.
2. Original b2 must acquire `supportedBy='receiver'`, genuine motor Q0.5 advances >35 mm, actual I0.7 high.
3. The operator tries the 24V I0.8 release **before** real downstream contact/dwell; correct PLC must keep Q0.6 energizing the extended stopper (wrong In8-only or In7-only control must fail).
4. The worker must observe b2 **actually jammed against outstop**, held continuously for >=200 ms; genuine `OUT_heldLoad -> PLC I0.11` high. Same b2 stays stationary for ten more PLC scans even while receiver's actual motor remains powered.
5. With source empty but b2 genuinely held downstream, a powered I0.6 third-feed demand must keep Q0.0 low and preserve original two-body conservation.
6. A **fresh** powered I0.8 release AFTER actual physical hold feedback must cause the learner PLC to drop Q0.6, physically retract original outstop and electrically observe its true I0.10 limit. Original b2 then advances and eventually exits the actual receiving conveyor; I0.7 drops low.
7. Only after real body exit may a new independent powered I0.6 request create original b3 through Q0.0. Three independently seeded original lots (1, 42, 65535), exact seed-42 replay, nine original boxes across distinct materials, body conservation and immutable test project signature.

Wrong-controller examples: gate releases before physically witnessed I0.11 dwell, gate never energizes, gate never retracts, source-only feeder ignores held receiver, never produces fresh b3 and omits genuine source reset. Blocking preflight rejects missing/miswired terminals, incorrect geometry/dwell/mode, bogus duplicate devices and reserved operator I0.8 conflicts. Instructor-only reference ST lives in `tests/fixtures/p24-outfeed-hold-programs.ts` and never ships in the app.

## Engineering files and release gates

- `src/plant/equipment/actuators.ts` and `src/plant/world/types.ts`: opt-in physical hold timer in actual worker stopper, default no-op.
- `src/plant/scenes/matrix-p24.ts`: private source-only original-body powered PLC assessment with real feedback.
- `src/sim/p12-assessment.worker.ts`, `src/ui/sandbox/SceneMatrixPanel.tsx`: isolated Worker and ephemeral source-signature-invalidated learner report.
- `tests/p24-real-outfeed-hold.test.ts`: native physics and original multi-seed PLC cases, incorrect programs, preflight negatives.
- `scripts/sandbox-p24-physical-outfeed-hold-browser.cjs`: fresh original unsolved factory -> authored ST and complete genuine 24V terminals, real positive/negative Chromium.
- `.github/workflows/ci.yml`: mandatory P24 Chromium after P23, preserving all P1–P23 browser checks.

**Do not call this software-verified until** exact-final-head semantic TypeScript, full Vitest, production/offline bundle and size budgets, original P24 Chromium positive and negative, inherited P1–P23, offline deep links, accessibility, no-WebGL, Firefox/Linux WebKit, and separate hosted Windows Edge all pass. A source file or locally designed test is not proof.

**Explicit NO-GO:** machine safety, real PLC or vendor networking, real photoeye/pressure/torque, physical low-spec Windows 8GB/no-GPU real WebGL/3D, long-term reliability, actual teaching acceptance, source/license/security signoff, PR stack reconciliation and owner-authorized selective merge/deployment remain unverified/open. No backend, cloud, accounts, payments or external machine actuation authorized.
