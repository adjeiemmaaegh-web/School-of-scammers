# PLC Skills Lab P14 — Real Physical Product Transfer and Processing

**Engineering date:** 2026-11-12  
**Source branch:** `engineering/p14-physical-material-processes-2026-11-12`, based on exact CI-verified P13 `1a53bb532f1728e222e723b604100f99eadc5932` (draft PR #53).  
**Release:** NO-GO. All stages are stacked drafts, unmerged. No deployment or industrial equipment use.

## Stage purpose

P13 supported bounded actuator tests in 17 of 21 original teaching scenes. The four remaining original learning workcells require *actual worker-owned material handling*, not equipment lamps or prefilled success signals. P14 improves the educational plant engine to support and assess genuine physical body provenance, picking, transfer, placement and bottle processing, while preserving deterministic, offline-first operation.

### Engineering changes

1. **Real pulsed feeder**: registered `box-feeder.CMD_feed` now produces exactly one seeded physical body on the rising edge of its PLC output, even when optional continuous automatic `enable` is off. Each real body goes through `spawnBody`, stable ID, finite geometry, scene seed, and cap/conservation accounting. Legacy interval-based auto-feeding remains. Opt-in `shapeMode=1` creates real cylinder bottles with measured-fill/cap tags; the default remains box.
2. **Gantry and robot machine travel**: both receive a registered boolean `dispatch` PLC command for a bounded 650 mm in-reach/material-transfer demonstration, in addition to their existing numeric XYZ target model. The robot distinguishes an intended close-range grip from an unrelated obstacle, without removing collision checks for other material. Genuine gripped bodies stay physically attached to the machine across 10 ms substeps, rather than being teleported back to a conveyor.
3. **Palletizer placement**: physical feeder carton can actually be picked, held, then placed by separate PLC `pick` and `place` outputs. The model uses the existing bounded layer/row/column pattern and retains correctly counted palletized bodies on a modeled pallet support rather than allowing them to fall through an imaginary stack. `placedCount` alone is never considered sufficient without a conserved physical body and its `palletized` tag.
4. **Bottle dosing**: the original bottle-line layout uses a measured long/slow conveyor, physical cylinder-form feeder, real filler and real capper. The capper has an opt-in `requiresFilled=1` interlock that requires an actually measured upstream `filledMl >= minFillMl` tag before any cap dwell begins. Unfilled or fault-blocked bottles cannot silently appear capped. Legacy capper behavior remains the default on old project instances.
5. **Source scene placements**: the four original advanced factory layouts now place the genuine feeder within a reachable pickup/transfer zone. They remain **unsolved**; no PLC wiring, ladder, FBD, ST source or completion results are auto-applied.
6. **Independent physical process grading**: `src/plant/scenes/matrix-p14.ts` adds four source-backed, 24 V/PLC16, real Worker controlled tests per scene: empty idle, real physical product completion, premature command stop/release without counterfeit completion, and registered machine fault followed by repair and measured product recovery. Each challenge runs a *fresh isolated clone* of the actual learner project. Private native NO buttons connect to PLC I0.0–I0.3 through the electrical netlist; original dedicated Q0.0–Q0.3 physical output wires and the learner's program are retained. No direct body insertion, forced coils, fake renderer, server, or saved grading data are used.

### Four bounded scenarios

| Original scenario | Required real-world model proof | Explicit limitations |
|---|---|---|
| gantry-transfer | feeder body -> PLC gripper attaches -> PLC dispatch moves it >500 mm -> physical release; no duplication | Simplified 2-axis gantry, discrete fixed target, no validated industrial servo motion |
| palletizing | seeded carton -> actual pick -> held carton -> separate PLC place -> 1 physically supported pallet-pattern body | Single-item educational pattern and support approximation; not full mixed-load palletizing safety |
| robot-sort | reachable carton -> PLC grip -> within-reach dispatch -> physical outfeed release | Robot cartesian target and grip only; no verified material-based *sorting algorithm* or articulated collision cert |
| bottle-line | physical cylinder -> real powered slow belt -> >=500 ml worker-measured fill -> opt-in cap-after-fill and persistent physical tag | Simplified process residence/dwell physics, no industrial dosing accuracy or sanitary compliance |

Four challenge cases are **not equivalent** to complete instructor-certified process solutions, safety validation, equipment parity with third-party simulators, or actual industrial PLC connectivity.

### Critical negative controls and gates

- Source suite `tests/p14-physical-material-process.test.ts`: exactly 21 unique original scenes allocated to 6 P12, 11 P13 and 4 P14 physical workcell groups, all four source-proved P14 process cases and deterministic repetitions, constant-ON/OFF programs fail, missing PLC/supply/device terminals and preexisting faults fail closed, no clone/test switch/grade mutates the learner's project, a non-cylinder feeder or non-interlocked capper is explicitly blocked.
- Mandatory real Chromium script `scripts/sandbox-p14-physical-bottle-browser.cjs`: original unsolved scene -> learner-edited PLC16 ST -> four actually wired Q outputs -> independent real Worker four-case assessment -> positive cylinder/feed/move/fill/cap/fault recovery -> edited always-on program fails -> no persisted test fixture or score.
- Inherited P13 browser acceptance is revised to recognize the **new unsolved P14 bottle matrix**, not incorrectly demand the former unsupported panel. All earlier software behavior must continue passing.
- Exact-head Linux TypeScript, full Vitest, Vite/asset offline packaging, all P1–P13 browser acceptance, P14 Chromium, WebGL fallback, accessibility/keyboard audit, Firefox/WebKit, and native hosted Windows Edge workflow **must both finish successfully** before P14 software verification is claimed.

### What still remains after P14 source development

Real 8 GB no-GPU owner hardware and cross-device acceptance; real physical PLC IO/protocol commissioning; industrial robot kinematics, process CFD, force models, safety-rated interlocks, advanced sensor calibration and fail-safe verification; multiple valid engineering solutions, instructor-authored independent reference case campaigns and full end-to-end multi-item throughput/quality tests; original asset/legal and industrial regulatory review; final selective reconciliation of the still-unmerged overlapping P8–P14 drafts. No backend/authentication, database, SaaS, payments, external deployment or physical-plant control authorized.

**P14 software stage status is contingent on the exact final commit green Linux + Windows CI, not the mere presence of this source file.**
