# Phase P1 — Open Workspace Authoring: Source Handoff

**Source branch:** `engineering/p1-workspace-authoring-source` (branched from `main` at `7a4c38bc8c33341f1957c2ffd72ead7e1fdd43f2`).  
**Status:** SOURCE DEVELOPMENT DELIVERED FOR CO-DEVELOPER REVIEW. Not merged, not formally tested or accepted, and not a production release.  
**Scope:** PRD v4.2 **P1**, the freely authored PLC workspace. This increment does **not** implement the plant-library Phase A–D physics contract; that is a separate P3 workstream.  
**Owner split:** source author implements and self-reviews source and supplies tests; code developer owns full execution, testing, resolving integration conflicts, merge and acceptance. There is no Windows/Mac/GPU/device gate for source development.

## Why this increment exists

The current P1 baseline already runs the learner's actual wired start/stop PLC program through the 50 ms worker scan and renders the result in the 3D scene. The missing **open authoring** experience was that the library was only search-based, only one object could be selected, only destructive actions had one-level undo, and there were no reusable move/snap/copy/paste/rotate operations. This source increment expands the independent simulator workbench, not the employer interview/questionnaire routes.

## Created files (19)

| File | Role |
|---|---|
| `src/workspace/types.ts` | Typed grouped-workspace edit, grid, clipboard and history contracts |
| `src/workspace/geometry.ts` | Pure floor bounds, grid snapping, bounded group translation, exact quarter-turn endpoint transforms |
| `src/workspace/catalogue.ts` | Eight categories backed by the live component registry; multi-token equipment search |
| `src/workspace/selection.ts` | Pure one/multi/toggle/select-all and stale-ID reconciliation |
| `src/workspace/history.ts` | Bounded, immutable 40-edit undo/redo, only from confirmed project changes |
| `src/workspace/keyboard.ts` | Scoped shortcuts, excluding forms/content-editable ST/LD inputs |
| `src/workspace/clipboard.ts` | In-app component/PLC-program/settings/IO map copy, internal wires only |
| `src/workspace/editor.ts` | Pure, bounded, deterministic group translate/rotate/duplicate/delete/paste with fresh IDs |
| `src/ui/sandbox/WorkspaceAuthoringBar.tsx` | Source-backed undo/redo/copy/paste/duplicate/rotate/delete/grid/nudge toolbar |
| `src/ui/sandbox/WorkspaceLibraryFilters.tsx` | Category selector for the existing component palette |
| `src/ui/sandbox/WorkspaceSelectionPanel.tsx` | Accessible touch/keyboard group selection independent of WebGL |
| `src/ui/sandbox/workspace-authoring.css` | Scoped styling for authoring controls |
| `tests/workspace-geometry.test.ts` | Floor, snapping, group-preserving limits, quarter-turn invariants |
| `tests/workspace-catalogue.test.ts` | Complete registry taxonomy/search and multi-selection semantics |
| `tests/workspace-history.test.ts` | Undo/redo, new edits clearing redo, limit and no-op |
| `tests/workspace-keyboard.test.ts` | Shortcuts and non-interference with learner programming editors |
| `tests/workspace-editor.test.ts` | Worker-integrated atomic edits, duplication, PLC program/wire copy, 3D terminals, motor-latch continuity |
| `scripts/sandbox-p1-workspace-browser.cjs` | Browser E2E source recipe: empty workbench → duplicate → undo/redo → rotate → copy/paste → reload |
| `docs/product/P1_WORKSPACE_SOURCE_HANDOFF.md` | This implementation/handoff record |

## Modified existing files (6)

| File | Integration change |
|---|---|
| `src/sim/signals.ts` | Optional persisted `yawDeg`, authoritative `editWorkspace` command and worker reply correlation/previous document |
| `src/sim/orchestrator.ts` | Atomic grouped edit through `validateProject`, paused-only commit, rejection without partial mutation; round-trip orientation validation |
| `src/sim/worker.ts` | Sends real prior project with successful mutations, acknowledges queued edits, leaves worker authoritative |
| `src/app/SandboxPage.tsx` | Connects palette, selection, grouped edits, internal clipboard, grid, undo/redo, keyboard and snap |
| `src/render/Sandbox3D.tsx` | Visually selects groups and draws permitted quarter-turned devices from saved data |
| `src/render/scene-coordinates.ts` | Cable endpoints use the same quarter-turn transform as the 3D device terminals |

## Source-level behavior contract

- The user starts from an **empty workspace**. No wizard, selected exercise, answer key, grade, or employer session is required.
- Existing component definitions, electrical netlist, PLC scan and plant logic remain authoritative. The new UI **never commits an optimistic local project**: it sends the worker a single typed `editWorkspace` command; the worker transforms the document, validates the *whole* project, and commits or rejects atomically while paused.
- Group movement applies one uniform snapped delta to all selected objects. The current 1080×580 canvas uses the existing 170×130 device footprint and bounded coordinates.
- Duplication/copy/paste give devices fresh deterministic IDs; copy only wires whose **both** endpoint owners were selected. Copy PLC programs and configurable I/O mappings, copy device params, and intentionally do **not** copy injected faults or a pressed button's runtime condition. Model counts, singleton restrictions and wire caps are rechecked.
- Rotation is a stored 0/90/180/270-degree property for **electrical/control/indicator devices only**. The 3D meshes and their terminal cable endpoints rotate together. P3 conveyors, tanks, sensors, pneumatic actuators, etc. are intentionally orientation-locked because their current physics still assumes fixed geometry. **Do not lift this restriction merely to make a mesh rotate.** P3 must add orientation-aware physics and reference tests first.
- Undo/redo is bounded to 40 accepted document changes and never records a rejected edit. The previous document is supplied by the worker, not guessed by the UI. Running motor state is deliberately reset by a document edit. History is local to the current browser tab/session; saved projects persist but edit history does not.
- The clipboard is **in-app memory**, not the operating-system clipboard or an arbitrary JSON importer. Project import/export retains existing validation and local storage. Original project JSON without `yawDeg` still loads unchanged.
- Existing low-poly 3D orbit/pan/zoom and the non-WebGL terminal patch panel remain available; group selection has keyboard/touch checkbox equivalents. No new runtime dependencies, external assets, network services, authentication or backend.

## Integration developer — next actions

**These are testing and integration responsibilities, not requests to restart P1 implementation.**

1. Review the full diff against PRD `docs/product/PRD.md` §§2, 6.1, 6.2 and 7, and check the source list above for anything omitted.
2. Rebase carefully **after** PR #28 (plant contract/browser reliability) and PR #29 (numeric PLC I/O), if those PRs are merged first. The P1 branch intentionally starts from `main` at PR #27, so concurrent changes in `src/sim/signals.ts`, `src/sim/orchestrator.ts`, and `src/app/SandboxPage.tsx` may conflict. **Preserve the analog input implementation, improved browser assertions and the P1 workspace changes together**; do not accept `ours`/`theirs` wholesale.
3. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:full`. Correct *source regressions* without loosening bounds, stripping checks, or silently downgrading simulator behavior. Source authors have **not** claimed green results for this branch.
4. Run `PLC_BASE_URL=http://127.0.0.1:4173 node scripts/sandbox-p1-workspace-browser.cjs` against a local preview, alongside existing sandbox startup/wiring/PLC/program/browser scenarios. The new browser source recipe is deliberately **not** automatically added to CI until the developer checks it.
5. Give special attention to: worker reply ordering (including queued fault edits), undo/redo after several rapid edits, first/second PLC promotion and program ownership when copying/removing, rotated-terminal cable placement, imported legacy projects, rejected over-cap/invalid grouped edits, no accidental ST editor keyboard interception, and untouched assessment routes.
6. After resolving code defects and recording evidence, decide the PR/merge sequence; merge into `main` **only under the developer's normal review process**. No production deployment or physical-device acceptance is requested from the source author.

## Deliberately outside P1, remaining under P2/P3/P7+

P1 does not create FBD, comprehensive IEC 61131-3 instructions, true 3-phase contactor physics, unrestricted CAD, arbitrary conveyor orientation, a multi-body collision solver, a palletizer/robot arm, 4–20 mA hardware equivalence, or external PLC protocol support. Those capabilities belong to subsequent source development. PR #29's numeric tank bridge and the co-developer's Phase A equipment library remain separate dependent streams.

## Acceptance statement

**P1 source increment is deliverable, not approved/accepted:** no device/platform compatibility claims; no independent qualified technician review; no full automated run reported for this branch. Existing source functionality must not be described as certified electrical or industrial equipment.

## Source review note — 8 November 2026

The initial PR #30 automatic `build-and-test` run (`42441544055`) passed TypeScript, production build and all **890/890 Vitest tests**, but its existing P8 browser check correctly reported a toolbar-height regression at 1440 px. This was caused by placing the new full-width authoring controls **inside** the sticky simulator Run/Pause toolbar. The source fix moves these controls into a dedicated sibling `workspace-editing-strip`, styles the strip independently and retains scenario Undo in the original toolbar. The core Run/Pause toolbar remains visually separate from P1 editing. The subsequent checks were queued when this note was written; the integration developer must not treat the old failing run as a current result, or the new queued run as passed without verification.

Prior Windows Edge CI on the same initial head passed, but device/platform acceptance remains out of source scope.
