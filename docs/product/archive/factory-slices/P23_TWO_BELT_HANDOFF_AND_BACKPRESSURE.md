# PLC Skills Lab P23 — Original Two-Belt Handoff and Real PLC Downstream Backpressure

**Started:** 2026-11-13. **Verified P22 parent:** `d6b8831ea94d88708be1a4f6634c5477315770b1` (draft #62, unmerged). **Branch:** `engineering/p23-two-belt-handoff-2026-11-13`.

## Scoped new competency

P22 proved an original two-carton accumulation trip, physical pusher clearance and source-lane full-sensor inhibition. It did not establish **what happens when the recovering original carton enters a separately powered destination belt** or whether an empty source alone safely enables feeding. P23 adds a new **commissioning exercise**, not a new collision solver. The existing worker-owned carrier handoff and P22 per-conveyor original-body zone sensors are exercised together, with actual 24V PLC motor and sensor terminals.

The original `gate-accumulation` workcell, feeder and source belt remain unchanged. The learner adds an aligned adjacent belt `receiver` at (515,225), 600×150 mm, 250 mm/s, `zoneSensorMode=1`, `zoneCapacity=1`. The source is at (455,225). The receiver's independent electrically powered motor is `scene-plc.Q0.5 -> receiver.CMD_run+` with genuine return and 24V supply; genuine `receiver.OUT_zoneFull -> scene-plc.I0.7` provides actual receiving occupancy. Source P22 `belt.OUT_zoneFull -> I0.5`, plus P21 gate, pusher and reset circuits, are still mandatory. Temporary independent 24V START I0.0, ACK I0.4 and NEW-CARTON I0.6 are added **only to a cloned worker trial**.

## Original physical event and negative-program contract

1. Safe original idle, then two genuine Q0.0 pulses create original b1/b2.
2. Source's genuine I0.5 full signal must inhibit an early b3 before the P21 200ms physical-contact latch.
3. Learner PLC physically retracts stopper, drives original b1 out with the real pusher, and only a fresh powered reset clears original b2.
4. Original b2 must cross the source/receiver seam, acquire real `supportedBy='receiver'` in the worker's physics, assert receiver `zoneFull` and genuine PLC `I0.7`, while actual Q0.5-powered receiver motor carries it at least 35 mm farther.
5. With source emptied and **destination still occupied**, a new independent powered I0.6 request must **not** energize Q0.0 or create b3. A program that consults only source `I0.5` now fails.
6. The same original b2 must travel beyond the far edge of the destination (world x>900 mm), and the real I0.7 signal must electrically return LOW. Only a subsequent demand may create original b3 through a new Q0.0 edge.
7. Three independently seeded original lots (1, 42, 65535), exact seed-42 replay, nine genuine source bodies, body conservation, original IDs and seeded materials; no fake bodies, PLC forces or UI-timer shortcuts.

Reject at least: source-only feeding while downstream full, receiver motor never powered, permanently withholding b3, blind source-full feeding and omitted jam reset. Block invalid geometry/capacity, missing/misrouted receiver I0.7, missing motor Q0.5, unsafe duplicate devices and nonconforming inherited P22 circuits **before** the source-only assessment. Wrong programs fail from observed worker physics and electrical states, not source-text blacklists.

## Files and evidence gates

- `src/plant/scenes/matrix-p23.ts`: private source-owner physics + electrically powered PLC assessment.
- `src/sim/p12-assessment.worker.ts`: new `run-two-belt-handoff` route.
- `src/ui/sandbox/SceneMatrixPanel.tsx`: new P23 commissioning UI with read-only ephemeral reports and source-signature invalidation.
- `tests/fixtures/p23-handoff-programs.ts`: test-only correct/incorrect real PLC programs, **not shipped in learner bundle**.
- `tests/p23-real-belt-handoff.test.ts`: direct 10ms body handoff/motor proof and genuine PLC campaigns.
- `scripts/sandbox-p23-two-belt-handoff-browser.cjs`: mandatory fresh browser authored ST, 24V terminal wiring, positive original-material campaign and source-negative proof.
- `.github/workflows/ci.yml`: P23 mandatory on exact PR head, preserving P1–P22 browser and native regression checks.

P23 is not accepted by code presence. Require semantic TypeScript, all native tests, production/offline build/budgets, mandatory Chromium positive and negative, all inherited browser regressions, Firefox/WebKit/no-WebGL/accessibility and separate hosted Windows Edge success **on one exact final head**, or disclose failures precisely. Internal physical model already supports adjacent center-point carrier reassignment; do **not** claim a new high-fidelity gravity/force/contact solver or hardware-equivalent conveyor zero-pressure accumulation.

## Open NO-GO

No actual photoeye beam calibration, industrial PLC networking, anti-crush or safety-rated controls, load/current/torque realism, machine stop certification, human detection or physical belt test. Owner-run Windows 11 8GB/no-dGPU actual WebGL/CPU, physical machinery/PLC and instructor/student validation, supply/license review, long draft PR stack reconciliation and explicit release approval remain open. No merge, deployment, accounts, remote sync, cloud, payments or real hardware actuation authorized.
