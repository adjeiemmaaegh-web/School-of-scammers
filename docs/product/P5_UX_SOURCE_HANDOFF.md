# P5-UX Industrial Simulation Workspace — Source Development Handoff

**Date:** 9 November 2026  
**Status:** IMPLEMENTED — AUTOMATED SOURCE VALIDATION IN PROGRESS; not owner-accepted, not merged, not released  
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
| `tests/p5-workspace-organization.test.ts` | Unit-level catalog family consistency, filtering, discoverability |
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

- The current **Logical/Wiring** view is the existing keyboard-accessible terminal/connection workbench, not a new node-wire drawing engine. A zoomable, spatial multi-wire schematic is a future task, not a claim of this source.
- Physical and logical tabs change **rendering only**. The authoritative Web Worker still owns the PLC, 24V solver, plant and time; the UI cannot fabricate device state.
- Categories derive from `componentKinds`. P3 PR #32 advanced plant-world and P4 PR #33 three-phase source remain unmerged separate branches; they are not silently imported into P5-UX.
- The lower dock reuses genuine `ProgrammingDock`, `IoMappingPanel`, `LiveMonitor`, `TroubleshootingPanel` and the virtual meter. No independent PLC interpreter or dummy instrument.
- Existing user-authored assessment/scenario guards remain in place; free-sandbox wiring hints remain hidden in scenarios.
- Existing local browser save/export semantics remain truthful. No cloud storage, collaboration, login or physical device connection is implied.
- The device inspector and library remain togglable; the logical terminal patch remains rendered even while Physical/3D is selected, preserving a non-WebGL accessibility path.
- Panels currently **collapse**, but arbitrary pane dragging, persistent per-user dock sizes, schematic pan/zoom, undo of every edit, multi-project management, real-time adjustable playback and richer camera modes are not promised until implemented and tested.
- No field-rated electrical safety, calibrated equipment fidelity or Packet Tracer/Factory I/O feature parity is claimed.

## 4. Verification and developer checklist

### Evidence to run on the *exact combined candidate head*

1. `npm ci` (or existing CI install), `npm run verify:engineering:offline`, `npm test`, `npm run build`.
2. `PLC_BASE_URL=http://127.0.0.1:4173 node scripts/sandbox-p5-workspace-browser.cjs` with an actual Vite preview server and Puppeteer installed.
3. Existing P1/P2/P3/P4/P5 workcell E2E, scenario/assessment flow, Firefox/WebKit smoke, no-WebGL and accessibility/keyboard checks; verify no unique timing/worker regression.
4. Review P5 screenshot outputs in GitHub Actions `plc-release-provenance` artifact under `qa-artifacts/p5-ux` at desktop 1440, laptop 1280 and narrow 390. The runner screenshots are automated, **not** owner physical-device review.
5. Test with poor connectivity, no WebGL, 8 GB low-spec Windows hardware and keyboard-only navigation on real devices during later formal acceptance; those gates remain open.
6. Before integration, compare `SandboxPage.tsx`, `Sandbox3D.tsx`, `registry.ts`, `signals.ts` and `orchestrator.ts` against PR #32/#33 and any subsequent P1/P2 updates. Preserve all worker semantics; do not resolve conflicts by wholesale overwrite.

### Source status register

| Workstream | Source status | Independent acceptance |
|---|---|---|
| A. Compact shell, menus, toolbar, canvas, dock | Implemented | Pending build/browser/owner layout review |
| B. View model, same worker and project | Implemented | Pending exact-head browser state checks |
| C. Library categories and existing inspector | Implemented | Pending category/browser verification |
| D. Status and console organization | Implemented | Pending worker/browser regression |
| E. Existing PLC editors and mapping retained | Implemented | Pending existing program E2E |
| F. Responsive and keyboard operation | Implemented for source scope | Pending visual/screen reader/real-device QA |
| G. Tests and developer handoff | Implemented | Pending CI report, owner sign-off |

**No merge, staging/production deployment, or physical acceptance authorization.** GitHub's existing Vercel integration may create an automatic PR preview; do not equate preview availability with owner release approval.

## 5. Review/signoff

- Code review: **pending**.
- Exact-head source CI: **pending/record later**.
- Owner UI review: **pending**.
- Physical device/browser formal acceptance: **deferred / unverified**.
- Combined P3/P4 source merge and integration: **unverified**.
- Commercial/production readiness: **NOT APPROVED**.

The correct completion phrase before those gates close is **"P5-UX source implemented; acceptance pending."**
