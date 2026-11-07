# Audit: merged P1–P6 against the corrected product objective

**Date:** 7 November 2026. **Basis:** the repository at `main` + stacked PRs #20–#21, read for evidence (code, tests, routes), not recalled. **Objective audited against:** the owner's *Product Direction Correction*: a browser-based virtual industrial automation laboratory comparable in learning experience to Factory I/O, Cisco Packet Tracer and GNS3, where the **simulator is the primary product** and learning and assessments are separate, secondary sections.

**Verdict in one paragraph.** The engine foundation is real and honest (deterministic worker scan, terminal-level 24 V netlist, Ladder and Structured Text, faults, several PLCs and panels, 768 unit tests and 14 browser scenarios). But what a student can *build* is still a small set of **fixed, hand-coded workcells**, the PLC's I/O is **fixed, not configurable**, and the **homepage and navigation lead with assessment**, not with the simulator. It is closer to "a few excellent training circuits" than to "a laboratory where arbitrary components combine". Comparison to Packet Tracer is aspirational, not achieved, and no claim of Factory I/O parity is supportable.

## Requirement by requirement

| Requirement | Status | Evidence | Gap |
|---|---|---|---|
| Open 3D industrial workspace | **Partial** | Free placement and drag on a fixed 1080 × 580 floor, up to 60 devices; click/Delete/Undo (P8) | No grid/snap, no zoom-to-fit, labels crowd past ~12 devices; four panel slots only |
| Comprehensive reusable component library | **Weak** | 21 kinds in `src/components/registry.ts` | Electrical 24 V devices only. No relays, timers, I/O modules, analog sensors, solenoid valves, cylinders, other sensors, HMI. Each kind is hard-coded across `buildCircuit`, `tick` and the UI rather than defined by data |
| Configurable PLCs, I/O modules, signal mapping | **Missing** | PLC = 5 DI + 6 DO, tags (`Start`, `StopOK`, `Photoeye`, `Run`, `Sort`, …) are *bound to fixed terminals* in the orchestrator | No I/O modules, no user tag-to-address mapping, no expansion. A `io-mapping` validator exists only in the legacy `/labs/engineering` |
| Terminal-level electrical and control wiring | **Done (basic)** | Click-to-wire, 250 wires, 24 V solver with per-supply isolation, multimeter | No wire colours/labels/ratings; coarse electrical model (ideal switches and loads) |
| Ladder, FBD and Structured Text editors | **Partial** | LD (+ numeric ops, timers/counters) and ST work, per PLC | **No FBD editor.** PLCopen XML import/export exists in `src/engineering` but is not wired to the sandbox |
| Authoritative scan engine connected to live simulation | **Done for what exists** | `sim/orchestrator.ts` tick pipeline, deterministic, replayable; several PLCs | Plant side is not generalised (see next rows) |
| Equipment motion, material handling, process, sensors, actuators | **Partial, fixed** | One conveyor lane with one parcel, one tank, DC and reversing motors | Conveyor, photoeye, diverter, tank, pump, level probe, drain valve, breaker, overload and the reversing set are **single-instance by design** (placement is refused). Pneumatic cylinder model exists only in `/labs/pneumatics` |
| Diagnostics, faults, measurements, commissioning | **Partial** | P5: six fault kinds, symptom-only alarms, repair, meter, scan trace | Alarms follow the first PLC only; commissioning/FAT and signal-diagnostics tools exist only in `/labs` |
| Locally saved, reusable projects | **Partial** | One autosave slot in `localStorage` + JSON export/import | **No project library** in the sandbox (a legacy `ProjectLibrary` exists in `/labs`); no templates gallery beyond one panel |
| High-quality on ordinary computers | **Unproven** | Bundle budget enforced (entry 103 KB gzip), no-WebGL fallback | Not measured on real low-spec hardware; 3D scene is fixed-size |
| Arbitrary combinations, not hard-coded scenes | **Partial** | Several PLCs/supplies/panels combine freely (P7/P8) | The sandbox page still embeds per-scene layouts and wiring guides; plant devices cannot repeat |

## Product structure (the part that is plainly wrong today)

- **Homepage** (`FrontDoor`): eyebrow *"Virtual trade simulator & practical assessment"*, headline *"Practice the trade. **Prove** you can do the job."*, a "10 ranked exercises" chip, audiences section, and a trades grid. The sandbox is one of three equal buttons. This reads as a skills-test product.
- **Navigation:** header links are *Why / Who it's for / Trades*; the sandbox header links are *Exercises* and *Assessment*. There is no persistent top-level split between **Simulator**, **Learn & practise** and **Assessments**.
- **Learning** (`/trades`, `/trade/:id`, `/scenario/:id`) and **Assessments** (`/employer`, `/take`) exist and work but are intermixed on the homepage and in the ladder page.
- **Engineering modules not unified with the simulator** (all under `/labs/*`): PLC & wiring studio, analog/ST process control, star-delta starter, pneumatic cylinder, workcell composer, 24 V bench, DC network, assessment suite. Several contain exactly the engines the simulator lacks (pneumatics, star-delta, analog tank, PLCopen, I/O mapping, commissioning).

## Verification posture

Automated and passing: 768 unit tests (many mutation-checked), 14 real-browser scenarios run in CI on Chromium/Firefox/WebKit (Linux) and a Windows Edge workflow, accessibility audit, bundle budgets.

**Not verified, tracked separately and not claimed:** real PLC hardware or vendor-runtime fidelity, physical devices, low-spec and real-GPU 3D performance, Factory I/O feature parity, safety/certification (the simulator is educational and not safety-rated), owner visual review of recent UI.

## Plan (ordered by the owner's priorities)

1. **Homepage and navigation reorganised** simulator-first, with Learn and Assessments as clearly separate, smaller sections (this PR).
2. **Unify** the useful `/labs` engines with the simulator, starting with pneumatics, star-delta and analog process, as devices/templates in the simulator rather than separate pages.
3. **Generalised component and signal model:** per-instance state for every plant device (several conveyors, tanks, cylinders), a data-driven device definition registry, configurable PLC I/O with named tags and expansion modules, so new equipment is added by data.
4. **Expand programmable equipment** on that model (relays, timers, solenoid valves and cylinders, more sensors, I/O modules) and an FBD editor.
5. **Complete user-authored multi-device scenario from an empty project**, built and verified end to end by an automated test with no pre-wired template.
6. **Project library** in the sandbox and keep extending automated tests; track hardware/physical/advanced-fidelity verification separately.

**Status:** step 1 is done on branch `engineering/p9-simulator-first`: the home page now leads with the simulator ("Build, wire, program and run a virtual factory"), a primary navigation (**Simulator · Learn & Practice · Assessments**) is on every page, and `/learn` and `/assess` are separate hub pages; assessment copy is a single secondary section, and the limits are stated on the home page. Checked by `scripts/simulator-first-browser.cjs` (home copy and CTA order, section order, the same nav on nine routes, free entry to an empty floor, phone width) and the accessibility audit now covers `/learn` and `/assess`. All routes and flows (exercises, scenarios, labs, employer, candidate) are unchanged.

Step 3 (part): plant devices are now per-instance (several conveyor lanes, tanks and breakers; slice 3 in `SANDBOX_BREADTH_PROGRESS.md`). Still open in step 3: configurable PLC I/O and tag mapping, I/O modules, and a data-driven device definition registry. The reversing drive set is the last single-instance device.

Each step lands as its own verified, documented PR. Existing working functionality (exercises, assessments, `/labs`, scenario grading) is preserved throughout.
