# PLC Skills Lab — Scan-Bounded Input Fault Campaign

Added `src/engineering/input-fault-campaign.ts` and Instruction Lab controls for simulated stuck-on, stuck-off and inverted input faults. Faults apply only within the selected scan window; source vectors are not mutated, original checkpoint expectations remain attached, and the tool compares baseline and injected sequence output values at matching checkpoints. Reports distinguish passing assertions from observed output changes. A fault that does not change checkpoint outputs is not proof of fault tolerance; differences between checkpoints may be missed. Fault duration and generated step count are bounded. Includes five Vitest test definitions; full Vitest and browser runs require installed dependencies.

This is deterministic educational simulation, not an electrical failure model, functional-safety verification or physical PLC test.
