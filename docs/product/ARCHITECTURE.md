# EFO Skill Lab — Architecture (v3)

> Matches PRD v3 (`docs/product/PRD.md`). Supersedes the v2 "frontend simulation" architecture, which was written for the previous PLC-only, simulation-first product. The v2 doc's layer diagram is preserved in git history.

## The idea in one picture

```
                        ┌─────────────────────────────────────────┐
  Experience layer      │  Front door (Student / Employer)         │   src/app/*
  (rebuilt)             │  Trade picker · 1–10 ladder              │   src/ui/*
                        │  ExercisePlayer (brief · objectives ·    │
                        │   evidence · rubric) + sim canvas        │
                        └───────────────┬─────────────────────────┘
                                        │ plays an ExerciseDefinition
                        ┌───────────────▼─────────────────────────┐
  Platform layer        │  exercise-runtime (learning/assessment,  │   src/platform/*
  (new contracts)       │   evidence capture, grading)             │
                        │  types · persistence boundary · config   │
                        └───────────────┬─────────────────────────┘
                                        │ exercises register here
                        ┌───────────────▼─────────────────────────┐
  Trade modules         │  registry → plc (10-rung ladder) …       │   src/trades/*
  (pluggable)           │  each trade: devices, exercises, rubric  │
                        └───────────────┬─────────────────────────┘
                                        │ built on
                        ┌───────────────▼─────────────────────────┐
  Simulation engine     │  deterministic PLC scan kernel, electrical│  src/engine/*
  (salvaged, frozen)    │  netlist, fault models, ladder, ST, …     │  src/core/*
                        │                                           │  src/engineering/*
                        └───────────────────────────────────────────┘
```

The guiding principle: **rebuild everything above the engine; freeze the engine behind a contract.**

## Layers

### 1. Simulation engine (salvaged, kept)
`src/engine/`, `src/core/`, `src/engineering/` — the previous developer's deterministic PLC/electrical/machine engine and its ~536 tests. Treated as a dependency: its logic is an asset, its public functions are the contract the trade modules call. We refactor its *surface* when needed, not its behaviour, and we keep the tests green.

Key entry points used today:
- `engine/simulation.ts` — the conveyor-start fault state machine (`initialMachine`, `transition`, `inputs`, `outputs`).
- `engine/assessment.ts` — `grade()` + rubric.
- `core/plc.ts` — a deterministic scan kernel (`scan`, `validateProgram`) for future ladder-execution exercises.

### 2. Platform layer (new) — `src/platform/`
Cross-trade contracts and the exercise runtime.
- **`types.ts`** — `ExerciseDefinition<S,A>`, `TradeModule`, `LadderRung`, `RubricResult`, `EvidenceEvent`, and the serializable `Assignment` / `AttemptResult`.
- **`exercise-runtime.ts`** — `useExercise(def, mode, seed)`: holds sim state, applies the exercise's pure `reduce`, records an evidence trail, exposes live objectives, and grades on submit. One runtime drives both audiences; `mode` is the only difference.
- **`persistence.ts`** — the storage boundary. v1 encodes `Assignment`/`AttemptResult` into shareable base64 codes + links and keeps local progress. A later backend implements the same functions. **The experience layer never touches storage directly.**
- **`config.ts`** — single-source brand name.

### 3. Trade modules (pluggable) — `src/trades/`
Each trade is a `TradeModule`: its metadata, its built exercises, and its planned (designed-but-unbuilt) rungs. `registry.ts` is the only place trades are registered and is responsible for building the unified 1–10 ladder. Adding CCTV/BMS/etc. = adding a module here; no shell or engine changes.
- `trades/plc/` — flagship. `index.ts` lists the module; `exercises/conveyor-start.tsx` is the rank-1 reference exercise.

### 4. Experience layer (rebuilt) — `src/app/`, `src/ui/`
The two-audience product. `App.tsx` routes:
- `/` front door · `/trades` picker · `/trade/:id` ladder · `/exercise/:id` learner player
- `/employer` build & review assignments · `/take` candidate assessment (reads an assignment from the URL hash)
- `/labs/*` the legacy engine tools, kept reachable so nothing is orphaned

Shared UI: `ExercisePlayer` (generic in-exercise shell) + `RubricReport`, `AppHeader`, `CopyField`, `useTheme`, and the design system (`theme.css` + `app.css`).

## The exercise contract (why it generalizes)

An exercise is pure logic + a view:
```ts
interface ExerciseDefinition<S, A> {
  id; trade; rank; version; title; estMinutes; summary; scenario;
  objectives; hints;
  init(seed): S;                       // initial sim state
  reduce(state, action): { next, event? };   // pure transition + evidence
  objectiveStatus(state): Record<id, boolean>;
  evaluate(state): RubricResult;       // grading
  Play: Component<{ state, mode, dispatch, objectives }>;   // the 2.5D canvas
}
```
Definitions live in code (not serialized). Only `Assignment` (which exercise + mode + seed) and `AttemptResult` (evidence + rubric) cross the wire — both plain JSON. That keeps the employer→candidate flow backend-ready while staying local today.

## Backend boundary (deferred, designed-for)
No backend in v1. When accounts arrive (Supabase is the leading candidate), they implement `persistence.ts` (store assignments/results, auth) behind the existing signatures. Experience-layer flows don't change.

## Rendering
Hybrid 2.5D: exercises render their simulation as inline SVG scenes bound to engine state (see `conveyor-start.tsx`). React Three Fiber/Three.js remains available (used by legacy workcell tools) for targeted true-3D where an exercise earns it. The simulation clock is always authoritative; visuals only render engine truth.

## Validation
Typecheck (`tsc`) → engine unit tests (Vitest, 536) → production build + offline precache → headless interaction check (Playwright) of the playable exercises. CI additionally runs cross-browser/accessibility/transfer-size checks (from the engine era; still valid for the engine subset).

## Conventions
- New code is readable (not the minified single-line style of the salvaged engine).
- One trade = one module under `src/trades/`; register it in `registry.ts`.
- Keep the honest framing: educational simulation, not a safety-rated controller.
