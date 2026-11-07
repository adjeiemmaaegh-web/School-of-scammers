# Sandbox breadth — toward a "Packet Tracer for PLCs"

**Status:** Active development on `engineering/p7-multi-plc`, branched from `main` after the P0–P6 merge (PR #19). Not yet merged or deployed. No backend, accounts or cloud. This document tracks the slices that widen what the open sandbox can build; the PRD phase list (P0–P7+) is unchanged.

The goal this serves: a learner builds a *plant*, not one fixed circuit: several controllers, several panels, wired together, each programmed separately, then run and troubleshot. Slice 1 is multiple PLCs and panels.

## Slice 1 — several PLCs, supplies and panels

**What works** (all through the same authoritative `tick()`):

- Up to **6 PLCs** and **6 24 V supplies** per project (project cap raised to 60 components and 250 wires). E-stops can repeat (their state is per component); contactors, motors, lamps and pushbuttons already could.
- **Each PLC samples its own wired terminals and scans its own program**, Ladder or Structured Text, independently (a project can mix languages). Each drives only its own Q0.x terminals.
- **PLCs interact only through the netlist**: wire one PLC's output to another's input and the signal crosses. Sequencing, interlocks and hand-offs between panels are real wiring.
- **Supplies are independent unless wired together.** Several supplies are separate sources; "24 V" always means 24 V relative to the device's *own* reference (`solveNetAware().reads24`). Without a shared common (tie the M0 terminals), a signal cannot cross between supplies and a meter reading between them is *floating*, not an invented 24 V. A positive net reaching another supply's negative net is flagged as a short.
- **Per-device state**: every contactor, motor and lamp has its own energised flag (`deviceOn`) and each motor its own shaft angle; faults (welded contacts, open coil, open winding, stuck button) apply per component id and were tested on a non-first panel.
- **UI**: *Place two-panel layout*; a **PLC tab** per controller above the programming dock (clicking a PLC in the 3D scene selects it too); the dock edits the selected PLC; the Live I/O lamps and the ladder/tag monitor follow it; device cards, the 3D scene and the inspector read per-device state; the multimeter works inside any panel.
- **Project files**: the first PLC keeps its program in the legacy top-level fields; each further PLC's program is in the optional `ProjectFile.plcPrograms[id]`. Single-PLC projects keep their exact v1 shape (no new key), and saved files load unchanged.
- Program commands take an optional `plc` id (`loadProgram`, `loadST`, `activateLanguage`); omitted means the first PLC, exactly as before. `run` validates every PLC's program and names the one at fault. A runtime fault in any PLC fails the whole plant closed and names that PLC.

**How it is built** (so the next person does not break it): the first PLC is the *primary* and uses the legacy `WorldState` fields; extras live in `WorldState.plcs[id]` (`src/sim/plcs.ts`). That asymmetry kept all 710 pre-existing tests green with no change to single-PLC behaviour; the **snapshot is symmetric** (`RenderSnapshot.plcs` has every PLC), so UI code never needs to care. Use `perDeviceLive()` (`src/sim/device-state.ts`) for contactor/motor/lamp/PLC state.

## Evidence

- `tests/multi-supply-solver.test.ts` (9) and `tests/multi-plc.test.ts` (30): two panels run independently, each PLC runs its own program (Ladder + ST mix), PLC-to-PLC signalling through wiring and its failure modes (cut wire, no common), per-device faults, unpowered PLC, fail-closed on a runtime fault in a non-first PLC, limits, project round-trip and rejection of bad files, the meter across isolated supplies in both its running and paused code paths, determinism. **Mutation-checked**: not scanning extra PLCs, driving every PLC from PLC 1's coils, contacts following the first contactor, leaking isolated supplies, ignoring the target PLC, filing a program under the first PLC, scanning an unpowered PLC, and the meter ignoring isolation (both paths) each made at least one test fail, then everything passed once restored byte-identical. One mutant survived at first (the paused meter path had no test) and prompted a test.
- One existing test changed on purpose: a second E-stop used to be refused (`sandbox-p4-panel`); it is now accepted because E-stop state is per component, and the test says so.
- `scripts/sandbox-p7-multiplc-browser.cjs`, real Chrome: lay out two panels, wire 22 conductors by clicking terminals, Ladder on PLC 1 and Structured Text on PLC 2, independent run/seal-in/stop, I/O lamps following the selected PLC, a PLC-to-PLC signal that is blocked until the commons are tied, reload persistence of both programs, no horizontal overflow at 390 px.

- **CI:** `ci.yml` dispatched manually on the branch: [run 42385092279](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42385092279) **succeeded**, including the multi-PLC E2E, the P6 and P5 E2Es, bundle budgets (entry 103 KB gzip, limit 120 KB), accessibility and the Linux Firefox/WebKit smoke. Locally the E2E passed 10 of 10 consecutive runs, all earlier browser scenarios still passed, and 749/749 unit tests pass.

## Limits — read before relying on it

- **Still single-instance:** conveyor, photoeye, diverter, tank, pump, level probe, drain valve, breaker, overload, and the forward/reverse set. Those plant models and protection flags are not multi-instance, so two sorting lines or two protected panels are not possible yet.
- **A short anywhere de-powers every PLC.** The solver reports one global short; it does not isolate it to one supply's panel.
- **Supervisory alarms, the scan trace and scan/tag breakpoints follow the first PLC only** (the I/O lamps, tag monitor and ladder highlights follow the selected PLC). A `START_FAILURE`-style alarm for a second panel does not exist yet.
- **No communication between PLCs other than wiring** (no Ethernet/Modbus/Profinet, no HMI).
- With 12 or more devices the 3D floor's labels overlap (the floor has a fixed size and the camera a fixed range); the keyboard/phone wiring panel stays fully usable. A larger floor and zoom-to-fit belong with the canvas work.
- Placement is still by hand: no remove-component command, no copy/paste of a panel, no free-form canvas yet. Layout is the existing 40-device-class 3D floor.
- It remains an idealised, bounded 24 V DC teaching model, not safety-rated and not general electrical simulation.

## Next slices (proposed, not started)

1. A remove/duplicate-panel command and a templates menu, so a second panel is one action.
2. Per-panel alarms and a per-PLC scan trace.
3. Multi-instance plant devices (two conveyors, two tanks) with a generic device model.
4. Pneumatic cylinders and valves in the sandbox.
5. A free-form canvas and cable routing, then a controller-to-controller network.
