# EFO Skill Lab — Engineering Source Integration Register

**Date:** 10 November 2026
**Working branch:** `engineering/2026-11-10-p3-plant-integration`
**Review PR:** #37 (draft; unmerged). **Production gate:** NO-GO.
**Current canonical main:** `4b43c77f14a3aa73a7d8df48f2f0aa05fc543b77` (reference-only commit).

## Evidence-grounded source inventory

The latest main still provides the working single-worker 24V motor, configurable PLC16,
multiple independent PLCs, basic LD/ST, feeder-conveyor/tank teaching slices, faults,
local projects, scenario grading, and 3D/no-WebGL views. This is not comprehensive
PLC vendor emulation, production-grade factory physics, or hardware connectivity.

| PR | Source status in upstream PR | This integration branch | Remaining work |
|---|---|---|---|
| #28 | Open and independently developed | **Incorporated** plant contract and both worker-acknowledged P4/P7 browser scripts | Verify combined head and no hidden waits |
| #29 | Open, based on #28 | **Deferred deliberate reconciliation** | Its tank analog signal bus overlaps P3's distinct `p3-numeric.ts` bus. Choose one typed read contract; merge fail-closed missing-wire behavior without duplicate PLC input interpretation |
| #30 | Draft P1 source implemented, not accepted | **Deferred conflict** | Scene authoring, rotation, clipboard, undo/redo overlap P3's fixed-yaw plant bridge and shared `signals.ts`, `orchestrator.ts`, `Sandbox3D.tsx`, `SandboxPage.tsx` |
| #31 | Draft P2 source implemented, not accepted | **Deferred conflict** | FBD/Ladder/ST/forcing require coordinated per-PLC runtime and snapshot updates, including `plcs.ts`, `signals.ts`, `orchestrator.ts`, `ProgrammingDock.tsx`, `SandboxPage.tsx` |
| #32 | Draft P3 source complete | **Incorporated as working engineering base**, retaining its worker, registry, 25 model classes, ten original scenes, PLC numeric bridge and 3D | Test P3 source browser recipe and combined changes; orientation/analog output gaps |
| #33 | Draft P4 source complete | **Deferred conflict** | 400V supply and star/delta need electrically isolated netlist plus merges in registry, terminals, `signals.ts`, `orchestrator.ts`, `faults.ts`, `Sandbox3D.tsx`; do not substitute nominal 24V behaviors |
| #34 | Draft P5-UX source complete | **Incorporated** menu, logical terminal view, categories, inspector and dock; 12/13 JSX patch hunks auto-applied; overlapping import hunk reconciled manually to preserve `PlantScenePanel` | Run full UI/browser/accessibility suites and inspect true P3/P5 panel coexistence |

**Categories:** incorporated source means available **only on this draft integration branch**,
not merged into main. Deferred does not mean missing in upstream source. Neither an
upstream test claim nor code presence proves combined acceptance.

## Integration sequencing and significant conflicts

1. Preserve the P3 fixed five 10ms physical substeps per 50ms PLC tick; no React/Three
   physics state or second PLC interpreter.
2. PR #28 browser ack changes are independent of P3 engine; adopted intact.
3. PR #32 is the simulation anchor. Its typed numeric bus already publishes PLC16
   AI0/AI1 process values in engineering units without injecting 24V electrical power.
   Avoid simultaneous installation of #29's competing `analog.ts` interpretation.
4. P5-UX was merged at patch-hunk level rather than copying `SandboxPage.tsx`.
   Preserve the P3 scene gallery, plant state, component registry, 3D and fault UI.
   New P5 controls manipulate existing worker commands only.
5. P1 yaw: P3 code explicitly fixes physical equipment orientation to 0. Enabling
   90° placement without updating carrier collision/route physics would be dishonest.
6. P2 debug force semantics must never bypass physical sensor outputs or expose
   instructor-only controls during scored scenarios.
7. P4 three-phase circuit elements must not be inserted into the legacy 24V solver.
   The three-phase source itself is unmerged; existing P4 24V protection remains.

## Coherent first workcell under test

`tests/integrated-three-rollers-turntable.test.ts` authors a project from a
blank authoritative worker using actual place and wire commands. It contains a
24V supply, PLC16, box feeder, three roller conveyors, turntable, and two
photoelectric sensors. An editable ST program drives actual Q0.0–Q0.4 loads;
the worker calculates movement, process body accounting, sensor image and
turntable state. Separate cases break a PLC output and substitute an incorrect
program, then check physical consequences, deterministic replay and JSON
round-trip validation. This is **source test coverage to execute, not proof
of passing** until exact-branch evidence is recorded.

A fully orientable three-way conveyor/turntable transfer path is **not supported**
by current P3 placement physics. The test must not claim that a box traverses
a 90° connection between independent conveyors until that geometry is actually
implemented and asserted. This is the largest coherent *bounded* slice while
P1/P3 orientation merge remains open.

## Automated checks and acceptance checklist

**Engineering CI:** `npm ci`, `npx tsc --noEmit`, `npm test`,
`npm run build`, `npm run verify:full`, existing Chrome E2E,
optional P3 worker browser recipe now added to CI, P5 workspace browser
regression, accessibility, no-WebGL fallback and Windows Edge.
Record exact run IDs and failures here after checks finish.

**Source- and product-level open gates (ordered):**
1. Merge P1 editable rotation/snap/group/clipboard without a false physical yaw.
2. Merge P2 FBD, LD/ST expansion and per-controller debug without weakening
   solver and assessment boundaries.
3. Reconcile #29 numeric process input and P3 numeric bus as one typed protocol.
4. Merge P4 400V/star-delta source preserving physical separation from 24V.
5. Prove full turntable material transfer through rotated user-authored layouts,
   multi-body conservation and sensor causality in a real browser run.
6. Complete camera Orbit/Fly/First Person controls, real placement feedback,
   multi-view visual review, and optimized 8GB low-resource performance.

**Owner / external acceptance NOT included:** physical PLC/Siemens networking,
real industrial devices, screen-reader and assistive-technology review on
owner hardware, cross-platform mobile performance, factory-grade mechanics,
safety/IEC certification or commercial deployment.

## Legal/operational boundary

The FACTORY I/O source files are owner-supplied documentation, screenshots and
video observations. They are an evidence benchmark, **not** licensed simulator
code, vendor 3D assets or proof of real PLC communication.

Do not merge existing PRs, promote this PR from draft, deploy, activate external
services or represent this code as production-accepted without explicit
owner authorization.
