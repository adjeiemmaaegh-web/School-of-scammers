# Workcell typed I/O watch and scan debugging — 2026-11-04

## Scope
A read-only monitor is integrated into the existing Engineering Workbench, using the *actual executed* WorkcellState snapshots and the retained 200-scan history. This does not introduce a second PLC runtime, a backend, hardware interfaces, or new unsanctioned control paths.

- Typed BOOL sampled PLC inputs, PLC coil results, post-scan derived feedback and virtual plant values appear in distinct phase/source rows. Input and output tags such as K1Feedback are not collapsed together.
- Virtual plant observations additionally expose BOOL motor and interlock states, DINT product counters, and REAL diverter travel. Timer/counter rungs expose TIME elapsed milliseconds, DINT count, and BOOL completion from retained instruction memory.
- Educational I/Q address and authored symbol description are shown where defined. An address is a label, not evidence of connection to a physical PLC.
- Transition detection compares *only* consecutive retained executed scans and never invents missing prehistory. Both live and historical selection use the same workcell snapshots; events later than the inspected historical scan are hidden.
- Commands and feedback can differ legitimately because of modeled process phases or interlocks. Read-only diagnostics distinguish those phase boundaries and flag motor running without a RunLatch request as a modeled warning, not proof of real hardware failure.
- A filtered, bounded 240-event CSV export and source/tag search support repeatable investigations. No monitor control mutates the PLC state.
- Existing session imports, replay, source editing and workcell reset retain their prior behavior; the watch is derived from current retained state and therefore resets with its source.

## Verification and acceptance
Run the repository's offline engineering checks, semantic TypeScript, Vitest, Vite build, Chrome interaction test, Firefox, Linux WebKit, accessibility, no-WebGL fallback and compressed size budgets before merge. Added unit tests target phase separation, typed instruction state, transition ordering/bounds, deterministic replay, export, and nonmutation.

**Limits:** Training simulation only; no vendor IEC execution guarantee, physical I/O, independently verified diagnostics, Windows 8 GB/low-spec performance sign-off, safety certification or full-release acceptance. The workcell remains browser-based and frontend-only.
