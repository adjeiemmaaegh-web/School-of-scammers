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
- Limits (R08, raised from 32 rungs / 48 tags): **256 rungs**, **512 local tags**, a static scan-cost budget of **2048 elements** (every contact, branch contact and rung instruction is one unit; at most 8 series elements per rung), and for Structured Text **512 declarations**, **5000 statements** (compile-time and per-scan run-time), **40,000 tokens** and **64,000 characters**. The worker measures the real scan cost and shows the simulator load, so an expensive program is visible; declared local tags only; no duplicate coils.

## Structured Text (ST)

- Declarations: `VAR_INPUT`, `VAR_OUTPUT`, `VAR`; types `BOOL`, `INT` (16-bit), `DINT` (32-bit), `REAL`, `LREAL` (finite JavaScript numbers, not IEC float precision); literal initialisers.
- Statements: assignment, `IF/ELSIF/ELSE`, `CASE` (integer/BOOL labels), `FOR` (bounded), `WHILE` (bounded).
- **R07 aggregates and user code:** `ARRAY[lo..hi] OF <scalar>` (1–64 elements, constant or variable index, bounds-checked at compile time for constants and at run time otherwise); `TYPE x : STRUCT … END_STRUCT END_TYPE` (scalar fields, dot notation); `FUNCTION name : TYPE … END_FUNCTION` and `FUNCTION_BLOCK … END_FUNCTION_BLOCK` (declared before the program VAR blocks, inlined with renamed variables, state per instance, may hold standard timers/counters; recursion is refused; function calls are hoisted before their statement and are not allowed in `WHILE` conditions); math `SQRT SIN COS TAN ATAN LN LOG EXP TRUNC` and the analog helper `SCALE(x, inLo, inHi, outLo, outHi)`. Not supported: arrays of structs, nested structs, arrays of function blocks, pointers, strings. All existing execution budgets apply to the expanded program.
- **Analog outputs (R13):** a PLC16 has `AO0`/`AO1` terminals bound to the REAL `VAR_OUTPUT` tags `AnalogOut0`/`AnalogOut1`; wire one to any device numeric command (`SET_openingPct`, `SET_inletPct`, `SET_value`, …) and the device receives the value the program wrote on its previous scan (0 while the PLC is unpowered). Declaring those names as anything but REAL is refused. Combined with `SCALE`, `LIMIT` and the standard `PID` block this gives open- and closed-loop analog control.
- Operators: `NOT AND OR XOR`, `= <> < <= > >=`, `+ - * /`, `MOD`; functions `ABS MIN MAX LIMIT`; comments `(* *)` and `//`.
- **Function blocks (R4):** `TON`, `TOF`, `TP`, `CTU`, `CTD`, `R_TRIG`, `F_TRIG`, and a teaching `PID`, declared in `VAR` (`tm : TON;`), called with named arguments (`tm(IN := Go, PT := T#2s);`), outputs read as `tm.Q`, `tm.ET`, `cnt.CV`. Duration literals `T#500ms`, `T#1m30s`, `T#2h` evaluate to whole milliseconds. `PID` is called as `loop(PV := Level, SP := 50.0, KP := 2.0, KI := 1.5, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);` and read as `loop.OUT` (REAL). KI and KD are per second on the fixed 50 ms scan; omitted gains are 0 and omitted limits are 0 and 100; the output is clamped and the integral stops growing while the output is saturated in the direction of the error (conditional-integration anti-windup); the derivative acts on error and is skipped on the first scan; swapped limits or non-finite inputs fault the program. It is a teaching controller: no auto/manual mode, no derivative filter, no tuning aid, and not a model of any vendor's PID block. Instance state persists across scans in the program's memory under reserved internal names (`tm__Q`), which also appear in the watch table.
- Bounds: 12,000 characters, 3,000 tokens, 200 statements, 128 declarations, 400 executed statements and 400 loop iterations per scan.
- **Unsupported (rejected at compile time):** `REPEAT/UNTIL`, `TIME`/`STRING`/`ARRAY`/`STRUCT` variables, user-defined functions and function blocks, pointers, `RETURN`/`EXIT`, positional function-block arguments, `TIME` arithmetic.

## Function Block Diagram (FBD)

- Nodes: `input`, `constant`, `and`, `or`, `xor`, `not`, `ton`, `tof`, `tp`, `ctu`, `ctd`, `sr`, `rs`, `compare`, `output`; evaluated in dependency order within one scan.

## Not claimed

- No full IEC 61131-3 conformance, no vendor dialect or project import (PLCopen XML is a bounded Ladder subset only), no online change, no multitasking or interrupts, no analog scaling instructions beyond `compare`/arithmetic, no communication blocks.

- **Sequential Function Chart (R07):** authored as a document of steps and transitions (`src/engineering/sfc.ts`, command `loadSFC`) and compiled to ordinary Structured Text, so it runs on the same scan engine with the same timers, forces, watch table and breakpoints. Initial steps, parallel split/join (a transition may list several sources and targets), per-step minimum time (`T_<step>` in conditions), and action qualifiers `N` (held while active), `S` (set on entry, stays set), `R` (reset on entry; wins over a set in the same scan) and `P` (one-scan pulse on entry). Step flags are `SFC_<step>`. Of two enabled transitions from one step the earlier in the document fires. Limits: 32 steps, 48 transitions, 8 actions per step, BOOL outputs only; no macro steps, no `L`/`D` qualifiers, no graphical editor yet (the chart is JSON through the command; it is stored in a header comment of the generated source and can be recovered with `extractSfc`). Not a model of any vendor's SFC runtime.
