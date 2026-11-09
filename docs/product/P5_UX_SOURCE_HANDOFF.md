# P5-UX Industrial Simulation Workspace — Source Development Handoff

**Date:** 9 November 2026  
**Status:** SOURCE DEVELOPMENT COMPLETE (bounded P5-UX scope) — implementation-head CI passed; owner review/integration/formal acceptance remains open; not merged or released  
**Working branch:** `engineering/p5-ux-workspace-organization`  
**Draft PR:** https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/34  
**Base:** `main` at `4b43c77f14a3aa73a7d8df48f2f0aa05fc543b77`  
**Scope identifier:** `PLC-P5-UX-001`; source request based on owner-approved P5 Simulation Workspace Organization Master Plan (9 Nov 2026).  
**Naming:** P5-UX workspace organization does **not** replace existing P5 troubleshooting/fault-source work.

## 1. Delivered code and its purpose

| File | Source-development implementation |
|---|---|
| `src/app/SandboxPage.tsx` | Original six-menu workspace, separate project toolbar, real Logical/Wiring and Physical/3D view selection, catalog filters, library/inspector collapse, dock and worker-state display; menu and tool actions use existing commands |
| `src/app/p5-workspace.css` | Scoped industrial desktop visual hierarchy, dominant central plant region, compact menus, status strip, responsive stacked/narrow behavior, reduced-motion and visible keyboard focus |
| `src/ui/sandbox/workspace-catalog.ts` | Deterministic family taxonomy for supported registry kinds, no fabricated device entries |
| `src/ui/sandbox/LogicalWiringCanvas.tsx` | Original spatial logical view: device cards at actual saved coordinates, neutral SVG wire routing, clickable real terminals and worker-derived device state |
| `src/ui/sandbox/logical-wiring.ts` | Pure positioning and route helpers for terminal-based diagram geometry |
| `tests/p5-workspace-organization.test.ts` | Unit-level catalog family consistency, filtering, discoverability |
| `tests/p5-logical-wiring.test.ts` | Pure diagram geometry/port-spacing and endpoint route tests |
| `scripts/sandbox-p2-browser-acceptance.cjs` | Preserves existing P2 validation while synchronizing the breakpoint test to the worker's reset snapshot before arming it |
| `scripts/sandbox-p5-workspace-browser.cjs` | Chromium acceptance recipe for two-view state, library categories, panel/dock toggles, keyboard shortcuts, responsive entry; emits 1440/1280/390 evidence screenshots |
| `.github/workflows/ci.yml` | Runs the new browser acceptance check in existing source CI, following genuine preview/test server initialization |

**Not changed:** `src/sim/orchestrator.ts`, `src/sim/signals.ts`, project serialization, PLC scan semantics, three-phase domain, WebGL physical truth, backend/authentication or deployment permissions.

## 2. Owner screenshot organization mapping

| Reference # | P5-UX implementation |
|---|---|
| 1 | Compact Project / Edit / View / Simulation / Tools / Help menus |
| 2 | Existing real local project, undo, starter and export controls retained, now compact |
| 3 | Select, Wire terminals, and Measure/diagnose tool entry points; unsupported pan/rotate/annotation toolbar modes intentionally omitted |
| 4 | Logical / Wiring and Physical / 3D Plant switch, same project/worker |
| 5 | Central plant area and keyboard-capable logical terminal patch; the 3D view is visually dominant |
| 6 | Existing Run/Pause/Step/Reset and a visible model-scan/status strip |
| 7 | No region #7 in source screenshot; no invented feature |
| 8 | Categories for supported industrial device families |
| 9 | Searchable model list populated from real registry kinds |
| 10 | Existing PLC program, I/O/measurement, wire, faults and event diagnostics organized into the engineering dock |

## 3. Deliberate boundary decisions

- The **Logical/Wiring** view now includes an original spatial 2D device/wire diagram with worker-backed terminal commands and click-to-select. Its routing is a simple orthogonal display of real project wires, not a professional electrical CAD auto-router, zoom/pan engine or guaranteed clearance-aware layout. The original keyboard-accessible terminal patch remains available as an accessibility fallback.
- Physical and logical tabs change **rendering only**. The authoritative Web Worker still owns the PLC, 24V solver, plant and time; the UI cannot fabricate device state.
- Categories derive from `componentKinds`. P3 PR #32 advanced plant-world and P4 PR #33 three-phase source remain unmerged separate branches; they are not silently imported into P5-UX.
- The lower dock reuses genuine `ProgrammingDock`, `IoMappingPanel`, `LiveMonitor`, `TroubleshootingPanel` and the virtual meter. No independent PLC interpreter or dummy instrument.
- Existing user-authored assessment/scenario guards remain in place; free-sandbox wiring hints remain hidden in scenarios.
- Existing local browser save/export semantics remain truthful. No cloud storage, collaboration, login or physical device connection is implied.
- The device inspector and library remain togglable; the logical terminal patch remains rendered even while Physical/3D is selected, preserving a non-WebGL accessibility path.
- Panels currently **collapse**, but arbitrary pane dragging, persistent per-user dock sizes, schematic pan/zoom, undo of every edit, multi-project management, real-time adjustable playback and richer camera modes are not promised until implemented and tested.
- No field-rated electrical safety, calibrated equipment fidelity or Packet Tracer/Factory I/O feature parity is claimed.

## 4. Verification and developer checklist

### Recorded implementation-head verification — successful

Verified source implementation commit: `484fc8e1ce0ea3bf32ba7c7f7082f1332cda029a`.

- [Build and Test run 42623740037](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42623740037): **success** — 98 Vitest files, **877/877 tests passed**; TypeScript and Vite build passed; P5-UX spatial logical/browser regression passed; preserved P1/P2/P3/P4/P5 browser workflows including P2 typed programming and breakpoint, P8 panel edits, P6 scenarios and authored plant; accessibility passed with zero serious/critical automated findings across 21 routes; Firefox and Linux WebKit smoke completed successfully. Generated P5-UX screenshots are available as workflow artifacts. These are automated checks, not field acceptance.
- [Windows Edge Hosted Runner run 42623739926](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42623739926): **success** for the same source implementation head.
- Corrections made during verification: controlled P2 breakpoint test input synchronized to worker reset, Drei 3D HTML label overlays isolated below sticky toolbar, live I/O strip made keyboard-focusable, real logical terminal wire browser coverage. The source check asserts rather than suppresses existing P2/P8 regressions.
- This handoff revision is documentation-only and creates a later commit SHA. Tests above are evidence on the identified implementation commit, **not** a claim that a subsequent documentation-only head was separately retested.

### Developer acceptance on a future combined source tree

1. `npm ci` (or existing CI install), `npm run verify:engineering:offline`, `npm test`, `npm run build`.
2. `PLC_BASE_URL=http://127.0.0.1:4173 node scripts/sandbox-p5-workspace-browser.cjs` with an actual Vite preview server and Puppeteer installed.
3. Existing P1/P2/P3/P4/P5 workcell E2E, scenario/assessment flow, Firefox/WebKit smoke, no-WebGL and accessibility/keyboard checks; verify no unique timing/worker regression.
4. Review P5 screenshot outputs in GitHub Actions `plc-release-provenance` artifact under `qa-artifacts/p5-ux` at desktop 1440, laptop 1280 and narrow 390. The runner screenshots are automated, **not** owner physical-device review.
5. Test with poor connectivity, no WebGL, 8 GB low-spec Windows hardware and keyboard-only navigation on real devices during later formal acceptance; those gates remain open.
6. Before integration, compare `SandboxPage.tsx`, `Sandbox3D.tsx`, `registry.ts`, `signals.ts` and `orchestrator.ts` against PR #32/#33 and any subsequent P1/P2 updates. Preserve all worker semantics; do not resolve conflicts by wholesale overwrite.

### Source status register

| Workstream | Source status | Independent acceptance |
|---|---|---|
| A. Compact shell, menus, toolbar, canvas, dock | Implemented, automated CI passed | Owner visual review pending |
| B. View model, same worker and project | Implemented, browser E2E passed | Combined-tree acceptance pending |
| C. Library categories and existing inspector | Implemented, unit/browser tests passed | Combined-tree acceptance pending |
| D. Status and console organization | Implemented, source regression passed | Owner review pending |
| E. Existing PLC editors and mapping retained | Implemented, P2 browser E2E passed | Combined P3/P4 integration pending |
| F. Responsive and keyboard operation | Implemented, automated accessibility/browser checks passed | Screen reader/real-device QA pending |
| G. Tests and developer handoff | Implemented, CI evidence recorded | Code-owner/owner sign-off pending |

**No merge, staging/production deployment, or physical acceptance authorization.** GitHub's existing Vercel integration may create an automatic PR preview; do not equate preview availability with owner release approval.

## 5. Review/signoff

- Code review: **pending**.
- Source implementation-head CI: **passed** (run 42623740037; Windows run 42623739926).
- Owner UI review: **pending**.
- Physical device/browser formal acceptance: **deferred / unverified**.
- Combined P3/P4 source merge and integration: **unverified**.
- Commercial/production readiness: **NOT APPROVED**.

The correct completion phrase before those gates close is **"P5-UX source implemented; acceptance pending."**
