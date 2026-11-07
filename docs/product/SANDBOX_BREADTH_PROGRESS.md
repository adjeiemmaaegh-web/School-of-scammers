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

- **Still single-instance after slice 3:** only the forward/reverse drive set. (Slice 1 originally listed conveyor, tank, protection and more as single-instance; slice 3 removed that.)
- **A short anywhere de-powers every PLC.** The solver reports one global short; it does not isolate it to one supply's panel.
- **Supervisory alarms, the scan trace and scan/tag breakpoints follow the first PLC only** (the I/O lamps, tag monitor and ladder highlights follow the selected PLC). A `START_FAILURE`-style alarm for a second panel does not exist yet.
- **No communication between PLCs other than wiring** (no Ethernet/Modbus/Profinet, no HMI).
- With 12 or more devices the 3D floor's labels overlap (the floor has a fixed size and the camera a fixed range); the keyboard/phone wiring panel stays fully usable. A larger floor and zoom-to-fit belong with the canvas work.
- Placement is by hand or by the starter-panel template (see slice 2); no copy/paste or free-form canvas yet.
- It remains an idealised, bounded 24 V DC teaching model, not safety-rated and not general electrical simulation.

## Slice 2 — editing a plant like a bench (branch `engineering/p8-edit-plant`)

Until now a device could be placed but never removed, and a second panel meant 22 manual wires.

- **`remove {id}`** deletes a device and everything that depended on it: the wires on its terminals, faults on it or on those wires, its PLC program, its meter probes, and its per-device runtime (the runtime is rebuilt). Removing the **first PLC promotes the next**: its program and language become the legacy top-level fields, because those always belong to the first PLC. Removing the only PLC keeps the program. Paused only.
- **`addPanel {template: 'motor-starter', at?}`** drops in a six-part, eleven-wire, already-programmed starter panel at a free slot on the floor (2 x 2 slots sized to the real 170 x 130 footprint) or at `at`, with fresh ids that cannot collide with the user's own, honouring the 6-PLC, 6-supply, 60-component and 250-wire limits. Paused only.
- **UI**: *Add starter panel*, a **Remove** button on every device card, the **Delete** key on the selected device (never while typing in a field), and **Undo** for remove/add (an undo point is kept only if the worker actually changed the project, so a refused edit leaves none). The pre-wired panel is hidden in graded scenarios because it would hand over the answer.
- **A pre-existing usability bug found and fixed**: the sticky toolbar slid *behind* the sticky app header after scrolling, so Run, Pause and every other toolbar button could not be clicked once the page was scrolled. The toolbar now sits below the header's measured height, and the E2E fails if any toolbar button is covered after scrolling (verified by putting the bug back).

Evidence: `tests/edit-plant.test.ts` (19, mutation-checked: wires surviving removal, no promotion of the next PLC, faults not cleaned, overlapping panels, id collisions, runtime not rebuilt, meter probes kept, program entry kept, PLC limit not enforced: nine mutants, all caught) and `scripts/sandbox-p8-edit-plant-browser.cjs` (real Chrome: one-click working panel, add four panels, refused fifth, undo, remove a motor and see its two wires go, delete the first PLC and see the next take over, Delete key, reload, no overflow at 390 px).

CI: manual dispatch on the branch, [run 42387921585](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42387921585), **succeeded** (all browser E2Es including the new edit-plant one, bundle budgets at 103 KB entry gzip, accessibility, Firefox/WebKit smoke). 768/768 unit tests; the edit-plant E2E passed 10 of 10 consecutive runs locally.

Two regressions in my own earlier work surfaced while verifying this slice, and are fixed: (1) the new Remove button made the device-card action row too wide on a phone (the row now wraps; the multi-PLC E2E's 390 px check caught it, and now names the offending elements); (2) with the toolbar correctly below the header it covers a band of the viewport, so three older E2E scripts that clicked an element already partly visible behind it now scroll the target to the centre first, as a person would. `sandbox-browser-acceptance.cjs` also had a latent race (it dropped onto the 3D floor before the canvas had measured itself, still 300x150) that appeared in back-to-back runs; it now waits for the real canvas size and passed 6 of 6 standalone and 3 of 3 after another script.

Limits: no copy/paste of arbitrary selections, no multi-select, no undo for ordinary edits (placing, wiring, moving), only for remove/add panel; one panel template; undo history lives in the page, not in the saved project.

## Slice 3 — per-instance plant devices (branch `engineering/p9-simulator-first`)

The plant models were single-instance by design. They are now generalised, using the same pattern as the PLCs: per-instance state keyed by component id, with the legacy single-device fields kept as a mirror of the first so every existing project and test behaves as before.

- **Conveyor lanes** (`WorldState.lanes`): every conveyor is its own lane with its own parcel, counters and photoeye truth. A photoeye or diverter belongs to the conveyor it is positioned along (the plant's existing geometry rule); in range of several, the **nearest** wins (`src/sim/stations.ts`). `feedParcel` takes an optional `conveyor` id (default: the first).
- **Vessels** (`WorldState.vessels`): every tank is its own vessel; pumps, drain valves and level switches belong to the tank they are mounted beside (nearest wins). A level switch reads its own tank.
- **Protection** (`WorldState.tripped`): breakers and overloads each have their own trip state. A short trips the first closed breaker whose opening isolates it; an unfused short is never given false protection.
- **Per-device state** (`deviceOn`) now also covers conveyors, diverters, pumps and drain valves; the 3D scene, the device cards, the inspector and the process panels show each lane and tank individually (one sorting panel per conveyor, one tank panel per tank).
- Placement limits are lifted for conveyor, photoeye, diverter, tank, pump, level switch, drain valve, breaker and overload. **Still one per project:** the reversing drive set (forward contactor, reverse contactor, reversible motor, reverse button), because its contactor pairing and interlock are not generalised yet.
- Evidence: `tests/multi-plant.test.ts` (19: station assignment, two lines sorting different parcels at once through their own PLCs and photoeyes, a stuck eye lying only to its own PLC, a stopped belt, two tanks cycling independently, a cut pump wire on one tank, STOP on one PLC, per-tank level switches, two breakers tripping separately, no reset into a standing short, determinism), mutation-checked: photoeye truth from the first lane, level switch from the first tank, global trips, belt energy from the first conveyor, broken nearest-wins, pump power from the first pump, feed ignoring the lane (seven mutants, all caught). All 768 earlier tests still pass; five asserted the removed one-of-each limit and were rewritten to the new rule. `scripts/sandbox-p10-multiplant-browser.cjs` (real Chrome): two lanes and two tanks in one project each, inside the real floor, PLCs programmed through their tabs, independent sorting, belts, tank cycles and STOPs read from the DOM.
- **Limits:** one photoeye and one diverter act per lane (the first assigned; extra ones read the same lane); one pump/valve/switch geometry per tank; sensor cards still show the first PLC's input rather than each sensor's own output; alarms and the scan trace still follow the first PLC; the floor is a fixed 1080 x 580 px.

## Slice 4 — a complete user-authored scenario from an empty project, and exact positioning

The owner's success test: *can a student open the simulator and practise automation freely, the way a networking student uses Packet Tracer?* This slice builds that as an automated, repeatable proof.

- **Exact device positioning (new):** the inspector now has X and Y fields (commit on Enter or blur; clamped to the 1080 x 580 floor). Until now a device could only be placed by clicking the 3D floor, which is imprecise for devices that only work beside a conveyor or tank, and not usable by keyboard.
- **The scenario** (`tests/scenario-from-empty.test.ts`, 12 tests; `scripts/sandbox-p11-authored-plant-browser.cjs`, real Chrome): from an empty project, with only `place`, `wire` and a program (no template, no example program, no pre-wired panel), build **17 devices, 32 wires, 2 supplies, 2 PLCs, 2 Structured Text programs**: line A (supply, PLC, START/STOP, contactor, conveyor, photoeye, diverter, run lamp, sorts marked parcels) and station B (its own supply behind its own breaker, PLC, STOP, tank, pump, level switch, drain valve) interlocked so B fills only while A runs, via a shared common and A's Run output wired into B's input. It then: checks the wiring with the multimeter; commissions (nothing moves until START, the tank waits for the belt); sorts a marked and a plain parcel while the tank fills; runs B's fill/drain cycle; halts B when A stops and A not when only B stops; finds a dead contactor coil with the meter and repairs it; takes a short behind B's breaker and shows that only B trips while A keeps running (and the breaker cannot be reset into the standing short); proves a real wiring mistake has a real consequence (no shared common, no interlock signal); saves, reloads and behaves identically; replays deterministically. The browser version does the same through the library, inspector, terminals, ST editor, instrument panel and instructor fault panel.
- **Two more things this slice surfaced and fixed:** the taller inspector made the sticky toolbar cover its terminal buttons after scrolling, which exposed that keyboard focus and scroll-into-view ignored the sticky header and toolbar (WCAG 2.4.11 focus not obscured). The page now sets `scroll-padding-top` from the measured header height plus the toolbar, and the one older script that did not scroll its targets to the centre now does.
- Mutation-checked (additional PLCs not scanned, isolated supplies leaking, pump power from nowhere were caught; "global trips" was an equivalent mutant here because the scenario has one breaker, and is covered by the two-breaker test in `multi-plant.test.ts`).
- **Open usability issue, found by this work and not yet fixed:** the sticky toolbar now wraps to two rows (about 100 px) on a 1440 px screen because the starter-layout and edit buttons were added to it, so while scrolling it covers a large band of the viewport. Several older E2E scripts that clicked without scrolling the target to the centre had to be changed for this (a person scrolls; Puppeteer only scrolls elements that are entirely off-screen). The product fix is to group the layout presets into a menu so the toolbar fits one row; it is a follow-up, not done.
- **What this does and does not prove.** It proves one non-trivial, user-authored, multi-device plant works end to end through the real UI on the real engine, for the equipment that exists. It does **not** show that arbitrary plants work: the component library is small, PLC I/O is a fixed 5-in/6-out with fixed tag names, there is no FBD, and the reversing drive set is single-instance. It is not Factory I/O parity, not vendor-PLC fidelity and not safety-rated.

## Next slices (proposed, not started)

1. Undo/redo for every edit, copy/paste and more panel templates (forward/reverse, protected starter).
2. Per-panel alarms and a per-PLC scan trace.
3. Multi-instance plant devices (two conveyors, two tanks) with a generic device model.
4. Pneumatic cylinders and valves in the sandbox.
5. A free-form canvas and cable routing, then a controller-to-controller network.
