# PLC Skills Lab — typed Structured Text teaching increment
Date: 2026-11-04

## Source scope
- Added small IEC-inspired `VAR_INPUT`, `VAR_OUTPUT` and `VAR` declaration blocks, requiring explicit types `BOOL`, `INT` or `REAL`.
- Externally sampled input variables are read-only; declared outputs are exposed; internal `VAR` values are retained separately through explicit scan-memory snapshots.
- Case-insensitive duplicate declaration rejection, undeclared-reference/assignment detection and strict runtime data-type checks.
- INT is simulated as signed 16-bit (-32768..32767), rejects overflow/fractions; REAL is a finite JavaScript numeric teaching approximation.
- Initializers are limited to literal values; uninitialized BOOL defaults FALSE, INT/REAL default zero. Memory is initialized on the first execution and retained across scans.
- Added a typed start/stop scan-counter example in the process control lab, reset controls, and a retained-memory viewer.
- Adapted the tank permissive to keep typed local memory between simulated process scans without bypassing its existing independently modeled high-high trip.
- Added eight regression tests spanning declaration correctness, type enforcement, first-scan defaults, private memory, replay and rejection cases.

## Limitations
The implementation is a **subset**, not IEC 61131-3 compliance: no PROGRAM/FUNCTION_BLOCK wrappers, VAR_IN_OUT, VAR_TEMP, address binding, arrays, casts, standard function blocks, vendor overflow semantics, or certified real PLC timing. The simulator cannot control physical equipment. The repository still has no backend, authentication, accounts or database.

## Verification policy
Perform GitHub CI: engineering checks, semantic TS, Vitest, Vite, size budgets and browser smoke in Chrome/Firefox/Linux WebKit; do not merge if any required gate fails. These checks do not replace industrial reference validation, real 8 GB Windows benchmarks, Safari/Edge device coverage or accessibility sign-off.
