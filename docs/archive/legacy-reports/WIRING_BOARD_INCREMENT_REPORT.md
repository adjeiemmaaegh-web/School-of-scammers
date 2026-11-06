# Configurable electrical wiring board increment — 2026-10-30

Implemented a separate interactive wiring-board panel in `/engineering`, a pure deterministic graph model with user-selectable terminal-to-terminal connections, removable wires, switch/fuse toggles, educational relay coil, load and PLC input representations, and DC voltage probe selection. Electrical editing is disabled when the board supply is on. Five Vitest regression definitions were added.

## Important limits
- Board is a **separate sandbox** and does **not yet drive the existing integrated workcell**. It is not a drag-wire SVG canvas: terminals are connected by selecting endpoints and the resulting wire list is shown.
- Components have idealized binary behavior. No current, resistance, thermal protection, analog sensing, physical safety or vendor-accurate PLC electrical behavior.
- No backend, third-party code, GitHub push, or deployment.
- Isolated TypeScript semantic check of electrical engine and board passed; complete React build and Vitest execution not performed because dependencies are unavailable.
