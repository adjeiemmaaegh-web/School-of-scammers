# Stage 1 — Engineering Workspace: development handoff

**Date:** 20 November 2026  
**Scope:** Frontend development only. No simulation-engine rewrite, project schema change, testing programme, hardware validation, or deployment.

## Completed development capabilities

The current mainline already provides the canvas-first 3D / 2D / logical workbench, registered illustrated equipment library with search and family filters, independent Components and Assemblies lists, device placement with drag on mouse/pen and tap on tablets, selection and multi-selection, clipboard/duplicate/align/rotate/nudge, panel visibility, view navigation, and canvas maximize/restore.

This Stage 1 increment closes workspace interaction gaps without copying or replacing those existing systems:

- Direct **library width**, **inspector width** (on wide desktops), and **engineering dock height** resize handles. Mouse, touch and pen use pointer capture; keyboard separators support arrow keys, Shift+arrow accelerated changes, Home and End.
- Width/height limits and persistence reuse the existing browser-local workbench layout preferences; resizing never changes project content, PLC runtime, device placement, or electrical signals.
- **Alt+L**, **Alt+I**, **Alt+D** reveal/hide the library, inspector and dock, while **Alt+Enter** retains the existing canvas focus flow.
- A one-action **Restore default workspace layout** restores panel sizes and visibility, without resetting the PLC or discarding the project.
- Keyboard-focusable component scrolling, containing overscroll within the component library. Changing search text or device family resets the component grid scroll to the top, and an empty filter has a **Clear filters** recovery action.
- Tablet layout continues to reserve meaningful canvas width; the inspector remains an overlay on smaller tablets instead of claiming a nonfunctional inline resizing handle.

## Key files

- `src/app/SandboxPage.tsx` — pointer/keyboard view controls, accessible separator handles, filter navigation, resets.
- `src/app/stage1-workspace.css` — responsive handles, independent scroll containment, tablet/desktop sizing.
- Existing `src/app/ux2-workbench.css`, `ux4-canvas-focus.css`, `ux6-workbench.css`, and `ux7-reference-layout.css` remain the established layout implementation.

## Intentional limitations

- This stage targets desktop/tablet workspaces at >=768 CSS px width and >=720 CSS px height for full-height resizers. Narrow or short browser viewports retain the existing compact/scrollable layout rather than pretending the direct resizers function there.
- On 768–1099px screens, the inspector is an overlay with a fixed responsive width, so its direct resize handle is not shown; the Tools slider remains available as an existing preference but is not represented as a live inline resize in that overlay layout.
- Canvas placement, 3D camera controls, and multi-selection continue using their existing, real worker-backed commands. More advanced geometry and simulation additions are scheduled in later development stages.

**Development handoff:** Stage 1 implementation is present on this feature branch. Merge and any later acceptance/release activities are separate decisions; this document does not claim they have occurred.
