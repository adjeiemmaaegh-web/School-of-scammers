# Supported PLC programming subset (roadmap R4.2)

An educational teaching subset inspired by IEC 61131-3. It is **not** full IEC compliance, not a vendor runtime, and not safety-rated. This page lists what the three editors run today (verified against the code and `tests/st-function-blocks.test.ts` on 2026-11-17). Anything not listed is unsupported and fails closed with an error message rather than being ignored.

## Scan model

- One program per PLC; fixed **50 ms scan**; inputs are sampled at the start of a scan, outputs are written at the end, and the wiring/solver sees them on the next scan.
- Timers advance by the scan period (50 ms); a preset below one scan behaves as one scan.
- Programs are bounded: deterministic, no wall clock, no dynamic memory.

## Ladder (LD)

- Contacts (NO/NC), series and parallel branches; coils and `SET`/`RESET`; rising/falling edge (`osr`/`osf`).
- Timers `TON`, `TOF`, `RTO` (retentive), `TP`; counters `CTU` (with reset), `CTD` (with load).
- Numeric: `compare` (`= <> < <= > >=`), `move`, `+ - * /` on literals or tags.
- Limits: **32 rungs**, **48 local tags** per program (raised from 8 and 16 in R4); declared local tags only; no duplicate coils.

## Structured Text (ST)

- Declarations: `VAR_INPUT`, `VAR_OUTPUT`, `VAR`; types `BOOL`, `INT` (16-bit), `DINT` (32-bit), `REAL`, `LREAL` (finite JavaScript numbers, not IEC float precision); literal initialisers.
- Statements: assignment, `IF/ELSIF/ELSE`, `CASE` (integer/BOOL labels), `FOR` (bounded), `WHILE` (bounded).
- Operators: `NOT AND OR XOR`, `= <> < <= > >=`, `+ - * /`, `MOD`; functions `ABS MIN MAX LIMIT`; comments `(* *)` and `//`.
- **Function blocks (R4):** `TON`, `TOF`, `TP`, `CTU`, `CTD`, `R_TRIG`, `F_TRIG`, and a teaching `PID`, declared in `VAR` (`tm : TON;`), called with named arguments (`tm(IN := Go, PT := T#2s);`), outputs read as `tm.Q`, `tm.ET`, `cnt.CV`. Duration literals `T#500ms`, `T#1m30s`, `T#2h` evaluate to whole milliseconds. `PID` is called as `loop(PV := Level, SP := 50.0, KP := 2.0, KI := 1.5, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);` and read as `loop.OUT` (REAL). KI and KD are per second on the fixed 50 ms scan; omitted gains are 0 and omitted limits are 0 and 100; the output is clamped and the integral stops growing while the output is saturated in the direction of the error (conditional-integration anti-windup); the derivative acts on error and is skipped on the first scan; swapped limits or non-finite inputs fault the program. It is a teaching controller: no auto/manual mode, no derivative filter, no tuning aid, and not a model of any vendor's PID block. Instance state persists across scans in the program's memory under reserved internal names (`tm__Q`), which also appear in the watch table.
- Bounds: 12,000 characters, 3,000 tokens, 200 statements, 128 declarations, 400 executed statements and 400 loop iterations per scan.
- **Unsupported (rejected at compile time):** `REPEAT/UNTIL`, `TIME`/`STRING`/`ARRAY`/`STRUCT` variables, user-defined functions and function blocks, pointers, `RETURN`/`EXIT`, positional function-block arguments, `TIME` arithmetic.

## Function Block Diagram (FBD)

- Nodes: `input`, `constant`, `and`, `or`, `xor`, `not`, `ton`, `tof`, `tp`, `ctu`, `ctd`, `sr`, `rs`, `compare`, `output`; evaluated in dependency order within one scan.

## Not claimed

- No full IEC 61131-3 conformance, no vendor dialect or project import (PLCopen XML is a bounded Ladder subset only), no online change, no multitasking or interrupts, no analog scaling instructions beyond `compare`/arithmetic, no communication blocks.
