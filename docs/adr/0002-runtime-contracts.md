# ADR-0002 — Runtime and team boundaries

Scope: browser-only virtual PLC engineering laboratory. Backend, login, cloud persistence, employer accounts and payments belong to a different team. Future integration uses serializable versioned project/attempt DTOs, not direct database access.

Layers: `core` (deterministic PLC scan and signals, no DOM/React/Three); future `electrical` (24 V netlist and instrument measurements); future `plant` (devices and physics); `render` (read-only state-bound 3D); `editor` (user interactions); `assessment` (event evidence and local practice rubric). Trusted recruitment scoring is a backend-team responsibility.

Clock: caller supplies an integer scan interval (1–1000 ms). Each scan snapshots inputs, executes instructions in program order and commits outputs. `TON` is non-retentive; `CTU` counts rising edges. Timers use simulation time, not wall-clock time. Instruction support is intentionally limited and is not IEC 61131-3 certified.

Safety: virtual interlocks are educational only. Do not connect this runtime to physical machinery. No physical safety assurance is implied.
