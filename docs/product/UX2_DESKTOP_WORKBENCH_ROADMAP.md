# EFO Skill Lab — UX2 professional engineering workbench roadmap

**Status:** proposed implementation plan only; no application code changed or tested by this document.  
**Reviewed source:** `adjeiemmaaegh-web/School-of-scammers` at `main` commit `4e4d5538b30ea562e0bf249eecf6abab173c97cc`, 2026-11-15.  
**Visual reference:** the owner-approved dark industrial EFO screenshot with orange selected actions, illustrated equipment tiles in the **left** palette, central 3D factory, contextual right inspector, and tabbed lower engineering dock. Cisco Packet Tracer supplies the organizational pattern, **not** source/assets to copy.  
**Product:** EFO Skill Lab, a general-purpose industrial automation **educational** simulator, not a conveyor-specific app.


## Supported devices and viewport policy (owner revision, 2026-11-15)

**In scope:** Windows/macOS/Linux PCs and laptop browsers with mouse/keyboard; tablets in portrait and landscape with touch or optional keyboard. Minimum design target **768 CSS px wide**. Favor desktop-style panels at >=1024px and compact dock/drawer behavior in tablet portrait, while preserving the same application concepts and equipment-thumbnail drag/drop alternatives.

| Target class | Minimum QA viewport | Expected behavior |
| --- | --- | --- |
| Desktop large | 1920×1080 | Full left palette, main canvas, optional right inspector, bottom dock, no outer scroll |
| Laptop/PC | 1366×768 and 1280×720 | Compact bars and resizable panels; no outer scroll |
| Tablet landscape | 1024×768 | Touch-capable, compact panels, no outer scroll |
| Tablet portrait | 768×1024 | Canvas priority; inspector/dock available via tabs/drawers, no outer scroll |
| Phone (<768 CSS px) | Not supported | No dedicated design, testing, or acceptance requirement |

Do not remove core keyboard accessibility or existing non-phone browser behavior merely because phones are unsupported. Keep all existing simulation, safety/assessment, and data-integrity test obligations. When legacy scripts include phone layout checks, migrate UX-specific assertions to tablets or explicitly label unsupported-phone observations without masking failures of unrelated functionality.

## Product outcome / decisions

1. One viewport-filling **PC-and-tablet** engineering workbench, **not** a vertically scrolling webpage. At 1920×1080, 1366×768, 1280×720, 1024×768 (tablet landscape), and 768×1024 (tablet portrait) CSS pixels at 100% browser zoom, the application shell must not need outer-page scrolling. Nested library lists, editor panes, property lists and diagnostics may scroll internally. Tablet layout may collapse inspector/dock into reachable tabs/drawers without hiding commands. **Phone-width layouts (<768 CSS px) are outside the UX2 product scope and acceptance matrix.**
2. Preserve the approved layout: application header and project-save state; compact menu and icon toolbar; Build/Wire/Program/Test workflow modes; 3D Factory / Logical Wiring / 2D Floor Plan view modes; searchable **image-based drag-and-drop equipment palette on the left**; central dominant workspace; optional contextual inspector on the right; resizable tabbed engineering dock at the bottom; compact status bar. Use a left palette by default — **do not silently switch it to the bottom**.
3. Workflows and views are independent: changing Build/Wire/Program/Test must not erase or overwrite 3D/Logical/Plan selection; if a workflow chooses a useful default view, the user can still switch freely. Switching mode never resets a worker, project, selected device, PLC program, or placement.
4. The library uses **actual supported registry kinds** and visually recognizable, original/offline-capable illustrations. Each tile: thumbnail, short equipment name, status/tooltip, drag handle/click-to-place; no text-only acronym as the primary illustration. Original SVG/renderer-derived thumbnails are permitted; do not insert unlicensed vendor product photos or represent an educational mesh as a real manufacturer's firmware. Missing device behavior is never disguised by decorative imagery.
5. Real drag/drop **already exists** (`text/plain` payload `add:<kind>` and scene drop), as do clickable palette placement and no-WebGL keyboard-accessible controls. Preserve their command routing; improve visual affordances and drag preview, not authoritative simulation behavior.
6. Do not replace the real Three.js/React Three Fiber scene, worker, electrical model, PLC scan, saved-project schema, scenario grading, or employer/candidate assessment routes during UX2. The photo-realistic reference is visual aspiration; matching realism is a separate verified 3D graphics workstream, **not a claim about existing renderer fidelity**.
7. No backend, cloud-save, user accounts, live industrial equipment, or new model accuracy claims. Local browser save/export status must remain truthful.

## Source inventory & migration responsibility (verified in main)

| Existing file/surface | UX2 action | Preserve |
| --- | --- | --- |
| `src/app/SandboxPage.tsx` | Extract a thin coordinator and desktop shell; remove page-scrolling workflow; reorganize menus, toolbar, palette/scene/inspector/dock; retain current props/commands, scenario gates | Worker commands, persisted project, selection, history, scenario constraints |
| `src/app/p5-workspace.css`, `src/app/sandbox.css` | Replace stacked PC/tablet layout with grid/flex min-height:0 panel geometry, scoped tokens, bounded internal scroll; avoid global CSS regressions | Existing 3D, logical canvas, no-WebGL styling and accessible tablet interactions |
| `src/ui/sandbox/workspace-catalog.ts` & `src/components/registry.ts` | Source of truth for category filters and actually supported kinds | Do not invent equipment that cannot be placed/simulated |
| `src/render/Sandbox3D.tsx` | Keep camera, raycast, drop, terminals, scene, worker-snapshot updates; provide robust resize on panel changes | 3D rendering must never compute independent PLC/electrical state |
| `src/ui/sandbox/WorkbenchInspector.tsx` | Inspector Properties/Terminals/Live I/O tabs, hide/show/resizable, selected-device context | Existing real terminal voltages, operations and worker command callbacks |
| `src/ui/sandbox/WorkspaceAuthoringBar.tsx` | Consolidate Undo/Redo/Copy/Paste/Rotate/Snap into icon toolbar with visible/accessible labels | Selection history and edit guards, including running state |
| `src/program/ProgrammingDock.tsx`, `src/program/LiveMonitor.tsx` | PLC logic and live monitoring as bottom-dock tabs; show plant alongside programming | Actual worker-backed programs and I/O |
| `src/ui/sandbox/LogicalWiringCanvas.tsx`, `FloorPlanCanvas.tsx`, `IoMappingPanel.tsx` | Full-height switchable central views and relevant tabs in dock | Real project coordinates, wiring and mapping |
| `src/ui/sandbox/PlantScenePanel.tsx`, `TroubleshootingPanel.tsx`, `ScenarioPanel.tsx`, `AssemblyLibrary.tsx` | Context panels, overlays, and drawers; no long permanently expanded section below the 3D canvas | Available scenes, faults, scenario work order, evidence, assembly editing |
| `src/ui/AppHeader.tsx` | Compact application chrome when route is /sandbox or scenario workbench | Simulator-first Learn/Assess navigation |
| `scripts/sandbox-ux-acceptance.cjs`, `scripts/sandbox-p5-workspace-browser.cjs`, `scripts/sandbox-browser-acceptance.cjs` | Extend for viewport, visual catalog and no-scroll behavior; adapt old intentionally scroll-based checks | Real browser+worker tests, not mocked screenshots |

Known existing pain points: `goToStage` uses `scrollIntoView`; multiple large toolbar/authoring rows compete above the scene; `p5-layout` plus the engineering dock and in-scene scene panels produce a vertically extensive document; `sandbox-device-glyph` currently shows primarily abbreviated text rather than a recognizable thumbnail; testing scripts themselves scroll to controls to make them clickable. These are targeted UX defects, not evidence that the simulation engine is broken.

## Delivery stages and acceptance gates

### Stage 0 — Freeze behavior and get a reproducible baseline

- Confirm main SHA, active draft PRs, actual registry kinds, scenario restrictions, UI layouts and responsive breakpoints.
- Capture screenshots and panel geometry at 1920×1080, 1366×768, 1280×720, 1024×768 (tablet landscape), and 768×1024 (tablet portrait); include blank and populated projects, WebGL fallback, a scenario work order, a PLC editor, and active diagnostics. Do not create phone-specific screenshots or QA tasks.
- Map controls to existing worker commands and document what may safely move.
- Record baseline tests and pre-existing failures rather than reporting unrun checks as passes.
- **Gate:** reproducible screenshots, commands/feature inventory, known failures, plan signoff.

### Stage 1 — Fixed-height desktop application shell

- Implement application chrome (project identity + truthful local-save status, compact menus and primary toolbar).
- Main container uses viewport-bounded CSS Grid/Flex with `min-height:0` and nested scroll; three-pane layout (left palette, flexible canvas, right inspector) plus bottom engineering dock and status line.
- Resize, collapse/maximize and panel ratios must not detach the 3D canvas or create document overflow.
- Deliver an accessible **tablet** touch layout with appropriately sized controls, collapsible panels and drag-and-drop alternatives (tap-to-place / keyboard). Do not hide simulator functions to satisfy geometry tests. Do not implement or optimize a phone-specific layout.
- **Gate:** on 1920×1080, 1366×768, 1280×720, 1024×768 and 768×1024, document height <= viewport (+2 px allowance) and width <= viewport; no overlay collisions or inaccessible controls; tablet landscape and portrait both supported.

### Stage 2 — Unified command surfaces and mode/view separation

- Consolidate duplicate Project/Edit/View/Simulation actions, Run/Pause/Step/Reset, Select/Pan/Move/Wire, Undo/Redo/Copy/Paste, grid/snap and viewport tools.
- Keep Build/Wire/Program/Test as modes; independently preserve 3D/Logical/Plan as views. Use short icon+text or icon+tooltip controls, visible selected state, standard keyboard focus and explicit disabled states.
- Remove stage-navigation `scrollIntoView` dependence; route to canvas/dock tabs instead.
- **Gate:** keyboard + pointer tests pass, no two conflicting active tools, no spurious worker command from mode switch, no loss of project/selection/PLC state.

### Stage 3 — Illustrated **drag-and-drop** equipment catalog

- Add original, locally bundled thumbnail assets, grouped by actual registry family (PLCs & I/O; Electrical; Sensors; Motors; Material Handling; Pneumatics/Motion; Process; Indicators).
- Display compact image-first tiles with readable names and title/tooltips, search and category filters. A kind appears only when genuinely in the registered palette.
- Preserve `add:<kind>` payload, raycast placement, canvas snapping where implemented, click-to-place and accessible keyboard alternative; verify disabled while editing is prohibited.
- Make the scene equipment recognizable against the catalog representation; separate thumbnail quality from low-poly runtime fidelity.
- **Gate:** for representative kinds (PLC, supply, start/stop, motor/contactor, photoeye, conveyor, tank, cylinder), drag and click perform real worker-acknowledged placement and survive export/import; no false supported equipment.

### Stage 4 — Dockable engineering, diagnostic, and inspection workflows

- PLC Logic (Ladder/ST/implemented FBD), Electrical/Wiring, Live I/O, Diagnostics, Event Trace and IoMapping (when supported) as switchable/resizable dock panels.
- Selecting equipment reveals Properties/Terminals/Live I/O in the contextual inspector; select two terminals to wire; Faults, voltage meter and console use actual worker snapshots.
- Permit plant visible while editing/watching PLC program, or maximize the editor; store UI layout preferences independently of simulation project.
- Reposition scene gallery, work-order and accessibility patch controls as drawers/tabs rather than always stacking below the workcell.
- **Gate:** at same desktop viewport, edit PLC and observe genuine running plant/I/O without outer-page scroll; no-WebGL accessible wiring/editor path continues to work.

### Stage 5 — Final visual system, PC/tablet accessibility and polish

- Use dark industrial palette with restrained amber selection, green confirmed *simulated* state and red faults; 8px spacing system; consistent icons and legible density.
- Implement meaningful tooltips, screen-reader names, tab order, focus-visible, drag alternatives, contrast and no-color-only meaning.
- Verify tablet portrait/landscape with touch-target sizing, responsive side panels/drawers, pointer/touch interactions and accessible click-to-place alternatives. The **no outer-scroll requirement applies to tablets and PCs**, not just desktops. Phone widths (<768 CSS px) are explicitly out of scope; do not spend implementation time on smartphone-specific styling or browser QA.
- **Gate:** owner-approved side-by-side screenshots versus reference and actual running workbench at named breakpoints.

### Stage 6 — Full QA and owner acceptance before integration

- Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:full`, and after build `node scripts/check-performance-budgets.cjs`. Browser scripts may need installed Puppeteer and a Vite preview server.
- Retain/extend `scripts/sandbox-ux-acceptance.cjs`, `scripts/sandbox-p5-workspace-browser.cjs`, `scripts/sandbox-browser-acceptance.cjs`, and the relevant current P2–P9 and assessment regressions.
- Add `scripts/sandbox-ux2-workspace-browser.cjs`: check outer document scroll bounds at 1920×1080, 1366×768, 1280×720, 1024×768 and 768×1024; tool visibility; resizing without canvas loss; drag/click/touch-alternative equipment placement, selection, wiring, Ladder edits, live IO, Run/Pause/Step/Reset, diagnostics, export/import and scenario protection. Verify tablet portrait/landscape touch controls and no-WebGL path. **Do not create a 390px mobile fallback acceptance gate.** Existing legacy phone checks may be reported as historical/unsupported, not treated as new product requirements; retain unrelated safety/functional coverage.
- Record exact commit, toolchain, browser, device, screenshots, test pass/fail/skip counts. Real low-spec Windows and actual 3D/graphics performance are separate owner acceptance gates; headless software rendering is not equivalent.
- **Gate:** no lost existing capability; full automated suite passes, actual browser workflow evidence, visual owner signoff, and explicit unresolved limitations. Merge only after authorization.

## Implementation order and guardrails

- **Separate reviewable PRs**, never an untested one-shot overhaul of `main`. Do not create a giant rewrite of `src/app/SandboxPage.tsx` and `src/render/Sandbox3D.tsx` simultaneously.
- Stage 1 and 2 establish geometry and behavior. Stage 3 realizes the owner's central preference: recognizable **image** equipment tiles with real drag/drop. Stage 4–6 finish usability and verify the complete result.
- Keep asset licensing/source provenance; do not copy Cisco/Siemens/Factory I/O photos or proprietary UI code.
- Do not promise 3D photorealism, more device types, protocol support, cloud functionality, physical PLC fidelity, or safety certification as a UX byproduct.
- Current draft PR #71 concerns assessment identity and CSP; reconcile conflicts and preserve scenario protections if it merges during UX work.
- Before any UX source PR: check source head and regenerate exact-head test evidence. Review visual screenshots separately from engine QA.
- **This roadmap/PR is planning only.** No code tests were executed in preparing this document because network/DNS blocked directly cloning the public GitHub repo in the local runtime; connector-only source inspection is not code execution.

## Definition of done

A learner on a **PC or tablet** can open the same general-purpose industrial simulator, choose a **picture of a real supported component** from a categorized left palette, drag it (or tap/click to place) into the center 3D/2D workbench, wire its real terminals, program a PLC, run/step the existing simulation, inspect true live I/O/diagnostics, and save/export — all with the application window staying fixed and without outer-page scrolling. Reviewers repeat this with a motor starter, tank process, pneumatic cylinder and material-handling scene at PC and tablet target resolutions, and verify untouched Learn/Assess routes.
