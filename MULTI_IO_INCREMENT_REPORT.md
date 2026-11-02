# Multi-input and PLC-driven wiring increment

Added configurable multiple discrete PLC input parts, PLC output-controlled contacts, and relay contacts controlled by PLC output tags. Electrical inputs are sampled before ladder execution; output contacts are evaluated after execution. The wiring board now displays output-driven load status and offers controls to add parts. New regression tests cover multiple inputs, PLC output switching, and relay contact switching.

## Limitations
This is an idealized 24 V educational graph model, not a current/thermal/analog solver. Output-driven board loads do not yet mechanically drive the main workcell motor; motor starter behavior remains a separate model. PLC output address labels must match ladder output tag names. The full browser app build and Vitest suite remain unverified. No backend or third-party source integration.
