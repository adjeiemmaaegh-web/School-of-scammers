# Scan Debugger Increment — 2026-10-30

## Delivered
- Read-only ladder power-flow rendering for contacts, series and parallel paths, and output coils.
- Per-contact captured sample, contact polarity, conduction state; rung instruction elapsed milliseconds/counter values.
- First/previous/next/live scan history inspection (last 200 scans). History is local in-memory and is cleared on reset/program edit.
- Three focused regression tests for path tracing and determinism.

## Semantics and limitations
- Scan history is a read-only recorded view, not a reversible machine simulation or a true instruction-level breakpoint engine.
- User actions still advance the live machine; historical inspection does not change the underlying PLC.
- The ladder runtime uses instructional simplified IEC-style semantics, not certified hardware equivalence.
- Formal browser tests, whole-app build, and all Vitest tests remain unverified unless separately run.
- No third-party source code, backend, database, or cloud integration added.
