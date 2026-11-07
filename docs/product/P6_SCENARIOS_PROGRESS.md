# P6 — Learning and assessment on the sandbox

**Status:** Active P6 source development on `engineering/p5-faults-diagnostics`, stacked on the unmerged P0–P5 work (PRs #14–18 plus this branch). **Not merged, not accepted, not deployed.** No backend, accounts or cloud. P6 full exit is **INCOMPLETE** (see "Still open").

PRD P6 exit criterion: *a progressive catalogue; the employer assessment runs on real scenarios.* This slice makes the first four **scenario exercises** run on the real sandbox, with an employer → candidate → review flow that uses the existing local assignment / result-code mechanism.

## What a scenario is

Not a bespoke state machine. A scenario (`src/exercises/types.ts`) is a **starter `ProjectFile`** (what is already placed, wired, programmed or faulted for a given seed) plus **outcome checks**. The learner works in the ordinary sandbox workbench (same worker, 3D scene, wiring, Ladder/ST editors, multimeter, repair). Grading (`src/exercises/grade.ts`) loads the learner's final project into a fresh headless world through the **same `tick()` the worker uses**, drives it with scripted operator actions and plant events, and measures what happened. Any wiring or logic that produces the behaviour passes: there is no model answer to match. Ladder and Structured Text solutions are graded identically.

Rules the code enforces:

- A check passes or fails (full `max` or 0). A **`required`** check must pass for the attempt to pass, however many points are earned elsewhere (so a motor that cannot seal in or be stopped never passes on points alone).
- Operator state is normalised before grading (every pushbutton released, E-stop reset): leftover state at submit time is not a wiring fault. A check that throws counts as failed with the error as its reason; grading never crashes on a malformed project.
- Grading is pure and deterministic (no `Date`, no `Math.random`): the same project and evidence always grade the same.

## The catalogue (`src/exercises/catalogue.ts`)

| Rank | Scenario | Learner starts with | Graded on |
|---|---|---|---|
| 2 | `plc-sbx-startstop` Build a start/stop motor starter | devices placed, nothing wired, placeholder program | PLC powered; START starts; seals in; STOP beats a held START; stays off; idle until commanded |
| 4 | `plc-sbx-find-fault` Find and repair the starter fault | working circuit with a **hidden seeded fault** (`pickSeededFault`) | starter works again; fault gone; circuit/program not rebuilt or bypassed (`layoutSignature`, ignoring positions and wire ids); **multimeter used before any replacement**; **only the faulty part replaced** (`precise`) |
| 5 | `plc-sbx-sorting` Program the sorting conveyor | fully wired line, placeholder program | belt latches and stops; plain parcel accepted; marked parcel rejected; mixed batch sorted |
| 6 | `plc-sbx-tank` Program the tank level control | fully wired tank, placeholder program | fills to HIGH; never overflows and pump never runs on at HIGH (up to 3 scans of I/O lag tolerated); drains until the switch clears; repeats; STOP halts pump and drain |

The seed selects the variant. For the fault scenario, `seed → fault` is deterministic and covers every fault kind the 24V starter supports; every seed 1–60 is proven symptomatic, detectable and fully repairable by replacing its own part.

## Workbench hosting

`SandboxPage` takes an optional `scenario` session (`src/exercises/session.ts`). With it: the starter loads (or the saved attempt resumes after a reload); a **Work order** panel (`src/ui/sandbox/ScenarioPanel.tsx`) shows the brief, objectives, hints and submit; learner actions are recorded as an **evidence trail** (`src/exercises/evidence.ts`; repairs are recorded from the worker's own events, so a rejected repair is never counted); and everything that would hand over the answer is hidden: layout buttons, Import JSON, the wiring-guide text, the one-click Ladder example programs, the ST sample (starters also carry a neutral ST placeholder, not the finished latch), and the instructor inject/reveal/clear controls.

- **Practice** (`/scenario/:id`, listed on `/trade/plc`): live "Check my work" with per-objective reasons, hints, *Start over* (re-rolls the seed for a new variant), progress recorded on the ladder.
- **Assessment** (`/take#a=…`): the employer picks a scenario on `/employer` (grouped as *Sandbox scenarios*); the candidate gets exam conditions: no hints, no live feedback, no restart, progress kept in the browser; the result is the same `AttemptResult` and result code as the v3 exercises, with the employer's assignment echoed back. The employer reviews it with the existing *Review a returned result* box.

## Evidence

- `tests/p6-scenarios.test.ts` — 36 tests: catalogue integrity, starters never already pass, reference solutions score 100%, a different correct solution (Structured Text) also passes, each mistake class is caught (no seal-in, no STOP, motor wired straight to the supply, diverter never/always on, pump ignores the level switch, STOP ignored), every seeded fault is repairable, guess-and-replace and repair-without-measuring fail, an added jumper fails "intact" but a moved device and a re-terminated conductor do not, leftover pressed buttons do not matter, deterministic grading, evidence helpers. **Mutation-checked**: ignoring `required`, making "precise" always pass, removing the stop precondition, ignoring the multimeter cut-off, weakening "intact", removing the tank lag tolerance and removing operator-state normalisation each made at least one test fail, then all passed once restored byte-identical. Two mutations initially survived (weakened "intact", operator-state normalisation) and prompted new tests.
- `scripts/sandbox-p6-scenario-browser.cjs` — real Chrome on the real worker: **A** practice (wire 11 conductors, program in Structured Text, "Check my work", run it for real, submit, recorded on the ladder, frozen and persisted across a reload); **B** employer assignment → candidate exam conditions (asserts no answers, no instructor controls, no hints) → alarm → multimeter diagnosis → replace the proven part → result code → employer review; **C** a guess-and-replace candidate in a fresh browser profile is graded *Not passed* with the exact criteria that fail. It found one real defect (a leftover held STOP failed grading) and one script race (submitting within milliseconds of a repair) before it was trusted.

## Limits — read these before relying on the result

- **Assessment integrity is not enforced.** Everything is frontend-only: evidence and the result code are produced and encoded in the candidate's browser and are **not signed**. A determined candidate can fabricate a code, and the example programs and answer wiring exist in the shipped bundle. This is an honour-system / interview aid, the same as the v3 exercises, until an owner-approved backend exists. Hiding a fault is a UI convention; the project JSON contains it.
- Grades measure behaviour under the checks above, not wiring quality, safety practice or tidy programming. Educational 24V simplification, not safety-rated or certified, and not a workplace certification.
- Four scenarios exist, not a ten-rank catalogue per trade.

## Still open

More scenarios (forward/reverse, protected DOL, E-stop and overload behaviour, analog/numeric ST, multi-fault diagnosis, intermittent faults); CCTV and the other trades on a sandbox of their own; retiring the v3 per-exercise state machines once equivalents exist; the architecture-layout gaps (`exercises/` still sits beside `trades/`); instructor/learner separation beyond a UI convention; owner visual review of the new Work order panel; real-device, Windows Edge and cross-browser acceptance.
