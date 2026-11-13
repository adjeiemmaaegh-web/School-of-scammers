# P13 — Factory Matrix Expansion & Physics Integrity

**Development checkpoint:** 2026-11-12 · Source branch `engineering/p13-factory-matrix-expansion-2026-11-12`
**Parent source:** P12 exact-head green `41a95211a5e9b9ebff21cd2578edb681f1513a29` (draft PR #52).

## Objective

Extend P12's independent worker-owned four-case challenge system beyond six original 3D factory workcells, while avoiding false grading for material-processing processes not yet technically represented.

### Capability register: 21 original factory scenes

**P12 retained, fully four-case calibrated within bounded training models (6):**
rotary-inspection, two-level-lift, scissor-lift-station, guarded-conveyor, height-guard, material-inspection.

**P13 introduced a new real-PLC actuator/drive four-case suite (11):**

| Original workcell | Actual worker machine tested | What the matrix does NOT claim |
|---|---|---|
| sorting-line | Diverter vane reject/home movement | Verified parcel sorting accuracy |
| gate-accumulation | Stopper stroke and return | Verified physical multi-body queue throughput |
| weigh-reject | Pneumatic pusher stroke | True mass-sensitive rejection |
| mini-warehouse | PLC-commanded 15-bay crane position at bay 1 | A stored or retrieved physical item |
| mixing-tank | Agitator run/stop and motor stall recovery | Liquid mixed volume or quality |
| three-way-handoff | Physical turntable quarter-turn and stop | Carried-body orientation/transfer accuracy |
| reversible-roller-lane | Roller motor run/stop and seized-bearing response | PLC-controlled reverse material transfer |
| parallel-sort-cells | Lane A belt drive while lane B stays off | Full independent two-lane sorting |
| temperature-batch | Batch agitator switching and stall recovery | Calibrated temperature/process controls |
| flow-valve-diagnostics | Diagnostic mixer motor response | Genuine analog valve aperture or water flow |
| robot-warehouse-receiving | Crane motor/bay positioning | Physical robot grip, body pickup, storage |

For all eleven, the source `src/plant/scenes/matrix-p13.ts` runs a **real powered PLC16 code path** and actual process equipment. Every independent case has a new isolated deterministic production-world clone:
1. **Idle:** physical 24 V NO demand OFF; Q output unenergized and equipment physically idle.
2. **Demand:** close a genuine netlist-connected 24 V NO pushbutton to I0.0, observe worker PLC Q0.0 and a registered machine signal (rejected/extended/running/moving/rotated or indexed crane bay).
3. **Release:** open that 24 V input, observe commanded Q de-energize, mechanical stop/retract/position holding according to the actual equipment model.
4. **Machine fault + repair:** inject the device's genuine registered plant fault while demand remains true; the physical result must stay blocked. Clear the fault while paused and prove that the energized PLC command produces real physical recovery.

The private button substitutes an existing I0.0 sensor only **in the test clone**. The submitted original workcell must have its stated sensor physically wired/powered where required, Q0.0 exclusively connected to the stated actuator, and the original PLC/supply fully wired. An unchanged built-in placeholder program is blocked. Constant-ON and constant-OFF programs must fail real independent cases.

**No tests create bodies or manipulate their type in secret.** A new real engineering fix in `src/plant/equipment/storage.ts` prevents the crane model from reaching its selected bay without a store/retrieve PLC command. This eliminates an actual false completion that existed in the old simplified engine. The P13 crane test explicitly verifies that reaching a bay is *not* the same as storing an item.

**P13 advanced remaining gap register (4):**
- `gantry-transfer`: current PLC bridge does not supply meaningful x/z target control and an actual body within gripper tolerance.
- `palletizing`: no end-to-end physically positioned box at the palletizer, PLC-coordinated pick/place cycle or body-conserving stack test.
- `robot-sort`: robot arm requires a genuinely reachable material body, 3-axis target and grasp; no credible four-case whole-robot validation exists yet.
- `bottle-line`: the only original box feeder emits box-shaped bodies; the existing filler/capper require cylinders. Passing such a trial with a fabricated bottle would misrepresent the actual industrial teaching model.

These four remain available for ordinary unsolved 3D scene work and P11 chronological observations, but **P13 never renders a fictitious four-case passing assessment**. The UI discloses each explicit missing precondition and invites source improvements rather than false grading.

The outcome is **17/21 original scenes with some independent four-case PLC/physical evidence** (6 P12 + 11 P13), but the scope of *what is assessed* differs. Only 6 have the earlier curated safety/limit-specific matrices, and P13's 11 certify only their named individual actuator/machine behaviors. Do not label 17 complete factory process assessments.

## Architecture / confidentiality

P13 reuses P12's private offline module Worker `src/sim/p12-assessment.worker.ts` with no backend, authentication, accounts, cloud, billing, or network fetch. It can never mutate the actual learner project. Real engine `createWorld()` and `tick()` power and mutate private workcell clones; `ProjectFile` and `RenderSnapshot` inspection never reads rendered 3D geometry, fake wall-clock data, user settings, saved results, or direct Coil forces.

When the original project, source code or scene changes, any previous verdict disappears. The real-world 8 GB Windows, physical industrial PLC, optical/dynamic accuracy and manufacturing safety validations remain owner-run, not claimed from these tests.

## Exact source verification gate

**Required for acceptance, not assumed:**
- `tests/p13-factory-matrix-expansion.test.ts`: 11 original supported scene definitions, 4 named unsupported, and P12 six combine to exactly 21; 44 real physics/PLC passing cases, deterministic replays, constant ON/OFF negatives, physical-wire/fault/fixture rejection, store/retrieve command gate regression, honest no-stock-claim checks. No mutation.
- `scripts/sandbox-p13-expanded-matrix-browser.cjs`: actual Chromium, source-scene gallery -> editable real gate/PLC16 wiring -> isolated four-case worker -> deliberately wrong always-on Structured Text rejection -> no fixture persisted -> replace project with bottle scene using actual confirmation and reveal genuine missing cylinder-bottle support rather than presenting a false pass.
- `.github/workflows/ci.yml`: exact P13 full Linux TypeScript/Vitest/Vite, performance, P1–P12 browser scenarios, P13 browser scenario, offline/no-WebGL, a11y, Firefox/WebKit smoke, release provenance. Hosted native Windows Edge CI must independently pass on the same exact head.

**No claim of completed P13 software verification until both hosted workflows pass.**

## Outstanding before a commercial or industrial launch

Four advanced material-handling/bottle scene real physical matrices; improved conveyor/spawn/body logistics; real kinematic XY/Z robot and gantry I/O with material-grip proof; analog PLC output and real flow valve actuation; multiple independently reviewed reference solutions; fault campaigns and negative controls across all 21; owner-run real 8 GB Windows/no-GPU and physical PLC checks; accessibility, quality, legal licensing and safety acceptance. Final consolidation of overlapping stacked draft PRs requires owner-authorized reviewed merging. No cloud, payments, new backend, safety certification, external factory connection or deployment authorized.

**NO-GO · DRAFT · UNMERGED · NO DEPLOYMENT.**
