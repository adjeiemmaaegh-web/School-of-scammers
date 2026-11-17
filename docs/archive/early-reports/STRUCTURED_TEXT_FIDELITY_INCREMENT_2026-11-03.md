# Structured Text fidelity increment — 2026-11-03

## Implemented
- IEC-style case-insensitive names for Structured Text source, sampled inputs and retained outputs, preserving first-assigned output spelling.
- Reject duplicate case-only signal keys and attempts to overwrite sampled inputs through alternate casing.
- Scan-sequence inputs replace earlier spellings of the same tag.
- `MOD` at multiplication precedence, restricted to finite safe integer operands, with explicit rejection of zero, REAL and BOOL cases. Signed remainder uses JavaScript's remainder sign convention as a **teaching simplification**, not a vendor guarantee.
- The tank example resolves `PumpEnable` without regard to the authored spelling.
- Five additional Vitest regressions; pre-existing tests remain active.

## Boundaries
This is a bounded teaching interpreter, not full IEC 61131-3 or vendor conformance. Typed declarations, full instruction/function block libraries, vendor integer overflow and scan behavior, and hardware/industrial acceptance are unverified or unsupported. Full CI checks are required before merge.
