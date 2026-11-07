# P4 — Electrical and control-panel engineering

**Status:** Active P4 source development on `engineering/p4-electrical-panel`, [draft PR #18](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/18), stacked on unmerged draft PRs #14–17. **No merge, external release, backend, accounts, payments, or real-machine connection is authorized.**

## Working 3D electrical-panel vertical slice

The approved PRD’s P4 phase covers panel wiring, protection, multimeter, DOL/reverse/star-delta, interlocks and E-stop. The current slice implements a **bounded educational 24V DC direct-on-line (DOL) circuit**, not an actual industrial motor starter or fully completed P4.

| Device | Terminals | Modelled effect |
|---|---|---|
| Branch breaker | `IN`, `OUT` | Idealized series switch, latched on manual trip or a directly shorted branch **only when opening this breaker isolates that short**. A still-present direct short refuses reset. No amp rating or thermal/arc physics |
| Training E-stop | `A`, `B` | Latching **NC** pushbutton, manual reset. Opens a real wired source path and drops PLC/contactor supply when mounted in that circuit. **Not a certified, redundant or safety-rated E-stop** |
| Overload auxiliary | `95`, `96` | Manual training trip opens the real contactor-coil path. It does **not rewrite the learner’s PLC `Run` latch** or imply thermal/current detection |
| Pilot lamp | `L+`, `M-` | Real virtual load, illuminated only with a complete energized 24V circuit |
| Two-probe DC voltmeter | Terminal dropdowns | Worker-owned readings from actual connected circuit terminal potentials: signed +24/0/−24V, floating/unconnected, or unreliable on a direct source short. No PLC scan advances merely to select probes |

### Protected motor-control exercise — 16 wires

From an empty workspace choose **Place protected DOL layout**. It places ten original 3D components **without prewiring**: supply (25,25), breaker (175,25), E-stop (160,245), PLC (345,25), START (35,400), STOP (285,245), overload (510,245), contactor (605,25), motor (855,25), pilot lamp (815,245).

Wire the following:

1. supply.P24 → breaker.IN
2. breaker.OUT → estop.A
3. estop.B → plc.L+
4. estop.B → start.A
5. estop.B → stop.A
6. estop.B → contactor.13
7. supply.M0 → plc.M
8. supply.M0 → contactor.A2
9. supply.M0 → motor.M-
10. supply.M0 → lamp.M-
11. start.B → plc.I0.0
12. stop.B → plc.I0.1
13. plc.Q0.0 → overload.95
14. overload.96 → contactor.A1
15. contactor.14 → motor.L+
16. contactor.14 → lamp.L+

Load the editable **latch example**, Run, then press START. The actual PLC logic energizes Q0.0, and the hardwired contactor 13–14 supplies the motor and pilot lamp.

**Exercises with real consequences:** manually trip overload 95–96; motor/lamp stop even when `Run` remains latched. **Resetting the overload can cause an unsafe automatic restart** under this intentionally minimal learner program, demonstrating the need for a proper restart interlock. Pressing the latching training E-stop breaks the supply path; resetting it restores PLC power but *does not* certify safety or replace real E-stop engineering. Pause and connect breaker.OUT → supply.M0, then Step or Run: the breaker trips *only* if opening its contact isolates the short. It refuses reset until that fault wire is removed. A direct supply short upstream is **diagnosed but not falsely credited** to the branch breaker.

Select red and black meter probes from actual terminal IDs; disconnected nodes report floating. Meter changes while paused do not run any PLC code or move the plant. No hidden renderer simulation is involved: the Worker publishes all voltage, protection, motor, lamp and meter state.

### Architecture and tests

- `src/engineering/electrical.ts`: existing pure idealized 24V reachability solver; open/closed contact and actual load modeling, short detection.
- `src/electrical/panel-meter.ts`: pure differential voltage and floating/short interpretation.
- `src/components/registry.ts`, `src/sim/signals.ts`: explicit terminal and protocol definitions for protection, E-stop, pilot lamp and meter.
- `src/sim/orchestrator.ts`: same ten-phase worker for P1–P4; compares pretrip network to network with breaker open, refuses reset into remaining direct short, and retains user-written Ladder/ST semantics.
- `src/render/Sandbox3D.tsx`, `src/app/SandboxPage.tsx`, `src/ui/sandbox/WorkbenchInspector.tsx`: original 3D protection equipment, accessible 16-wire patch/controls, terminal meter and live breaker/overload/E-stop/motor/lamp readouts.
- `tests/sandbox-p4-electrical.test.ts` covers original nine-device starter; `tests/sandbox-p4-panel.test.ts` adds ten-device E-stop, reset/refusal, upstream vs downstream shorts, signed meter reads, malformed controls and deterministic replay.
- `scripts/sandbox-p4-panel-browser.cjs` gates a genuine user-wired Chrome WebGL scenario with motor, lamp, overload, training E-stop, short and guarded recovery, while earlier P1/P2/P3/UX and accessibility/Windows browser suites remain active.

### Acceptance and omissions

**Verification is based on actual CI, not source existence.** The previous P4 nine-device implementation passed 598/598 tests and browser/Windows checks (see draft PR #18 historical evidence). The new E-stop/16-wire continuation requires its own completed CI run. Physical low-spec Windows WebGL, cross-browser full 3D, human visual review and hardware testing remain **unverified**.

**Not yet built:** forward/reverse or star-delta 3-phase motor control, genuine contactor electrical/mechanical interlocking, overcurrent/amperes and thermal breaker/overload ratings, safety-certified emergency stop circuits, realistic mains and standards-grade schematic wiring, calibrated electrical instruments. Full P2/P3 backlog is still open. **P4 and commercial release are NO-GO / INCOMPLETE.**
