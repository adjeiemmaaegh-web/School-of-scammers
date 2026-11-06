# P4 — Electrical & Control Panel: protected 24V DOL engineering increment

**Status:** Owner-authorized P4 *source development* on branch `engineering/p4-electrical-panel`, **draft PR #18**, stacked on P3 PR #17, P2 PR #16, UX PR #15 and initial 3D PR #14. They are unmerged. **No backend/auth/cloud/payment/production deployment.**

## Why this increment

The approved PRD defines P4 as **control-panel wiring, virtual multimeter, DOL / forward-reverse / star-delta, interlocks / E-stop, and bounded short / overcurrent behaviors**. This increment implements a **real, repeatable protected 24V DC DOL vertical slice**, not the entire P4 milestone. The educational solver remains a pure idealized *graph reachability* model. It is **not SPICE, not a rated protection coordination study, not a certified emergency stop or a mains motor wiring design**.

## Working devices and circuit

The original component registry and 3D equipment library adds:

| Device | Terminals | Effect |
|---|---|---|
| Branch breaker | `IN` / `OUT` | Normally closed switch. If a direct ideal high-to-low short is present **only when this breaker is closed**, it trips to open, latches, and disconnects its downstream branch. Can be manually training-tripped/reset. Not rated by amps or time |
| Overload NC auxiliary | `95` / `96` | Normally closed 24V control contact. Manual training trip opens the *actual contactor coil* path. Does **not** falsely modify the PLC's Run memory or imply thermal accuracy |
| 24V pilot lamp | `L+` / `M-` | Actual 24V load. Illuminates only when a complete energized circuit exists |
| Two-probe virtual DC multimeter | Worker commands `setMeterProbe` | Select existing terminal IDs for + and − probes; solve actual ideal 24V graph and display signed **24 / 0 / −24 V**, **floating/open**, or **short/unreliable**. Probe selection while paused does **not** advance PLC scan state |

### Protected DOL starter layout

From a blank project press **Place protected DOL layout**. It places 9 original 3D components, intentionally **not prewired**: supply (25,25), breaker (175,25), PLC (340,25), START (40,245), STOP (240,245), overload (450,245), contactor (600,25), motor (830,25), pilot lamp (810,245).

Manually connect the **15 real terminal pairs**:

1. supply.P24 → breaker.IN
2. breaker.OUT → plc.L+
3. supply.M0 → plc.M
4. breaker.OUT → start.A
5. start.B → plc.I0.0
6. breaker.OUT → stop.A
7. stop.B → plc.I0.1
8. plc.Q0.0 → overload.95
9. overload.96 → contactor.A1
10. supply.M0 → contactor.A2
11. breaker.OUT → contactor.13
12. contactor.14 → motor.L+
13. supply.M0 → motor.M-
14. contactor.14 → lamp.L+
15. supply.M0 → lamp.M-

Load **editable latch example**, Run and press START. The real worker scan seals `Run` and energizes the contactor; the actual contactor NO contact drives motor and pilot lamp. A **manual overload trip** opens 95/96, deenergizing the contactor and load while the PLC's Run coil remains true. Reset to reconnect and run. To simulate a **downstream direct short**, pause, wire breaker.OUT → supply.M0, then Step or Run: the breaker trips if isolating it removes the short, motor and lamp stop. Remove the short wire *before* resetting the breaker. A direct short **upstream** of the breaker is reported as a supply fault but is **not** falsely isolated by that breaker.

Probe source P24 (red) and source M0 (black) to see +24V without running PLC; reverse the leads for −24V. Probing two equipotential nodes yields zero. Unconnected nodes are displayed as floating. The existing keyboard/2D terminal patch works without WebGL; the 3D view only presents the **authoritative Worker snapshot**, it does not simulate current.

## Implementation

- `src/components/registry.ts` — breaker, overload, lamp terminal contracts.
- `src/electrical/panel-meter.ts` — pure voltage difference/floating/short result; no DOM or clock.
- `src/sim/signals.ts` — typed `operateProtection` and `setMeterProbe` commands; breaker/overload/lamp and meter state in immutable snapshots.
- `src/sim/orchestrator.ts` — embeds breaker and overload as actual ideal switches in the same 24V graph. On a short, compares the closed-circuit graph to the graph with just the breaker opened; only a downstream-isolatable short trips it, then resolves the circuit and PLC power **in that same simulation scan**. Reset is latched; repeated short immediately re-trips. Overload 95/96 is a real NC electrical path. Pilot lamp is a real load. Paused meter requests recompute the netlist but **do not execute PLC programs**.
- `src/render/Sandbox3D.tsx` — original low-poly protection toggles and emissive pilot lamp; UI never owns power states.
- `src/app/SandboxPage.tsx`, `src/ui/sandbox/WorkbenchInspector.tsx`, CSS — starter equipment, protected DOL help, trip/reset and two-probe meter (accessible text controls even without WebGL).
- `tests/sandbox-p4-electrical.test.ts` — dedicated real-circuit regression.
- `scripts/sandbox-p4-panel-browser.cjs` — real Chrome browser builds/wires 15 nets, runs motor/pilot, measures 24V, trips overload, resets, deliberately shorts branch, verifies trip/isolation, removes short and confirms recovery.
- `.github/workflows/ci.yml` includes new browser gate **in addition to** all previous P1/P2/P3/UX/native/Windows/Firefox/WebKit checks.

## Verification and open gates

The new tests and run evidence are listed on [draft PR #18](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/18). **Do not mark passing from source code alone.** A production release requires independent Windows real-device, 3D graphics/performance, and human acceptance.

**Not included in this P4 increment:** mains 3-phase DOL, reversing/star-delta contactor interlocks, full 24V wiring conventions and schematic editing, real thermal overload curves, current-limited supplies, fuse coordination, rigorous ampere calculations, true calibrated multimeter or certified E-stop. These are **open P4 requirements** and must not be presented as delivered. Earlier P2/P3 roadmap gaps remain open. Source work continues but acceptance and any merge/deploy require separate owner authorization.
