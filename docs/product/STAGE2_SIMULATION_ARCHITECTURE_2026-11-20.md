# Stage 2 — Simulation Architecture: development handoff

**Date:** 2026-11-20  
**Branch:** `engineering/stage2-simulation-architecture-20261120`  
**Parent development branch:** `engineering/stage1-workspace-completion-20261120`  
**Status:** `IMPLEMENTED_UNVERIFIED` for the scoped increment; **the full R3 roadmap has outstanding work**.

## Scope and intent

The last owner-facing handoff called the next phase **Stage 2 — Simulation Architecture**. The governing `MASTER_ROADMAP.md` calls the kernel consolidation work **R3**, after R2 project durability. This work follows the owner-facing stage name without rewriting that roadmap: existing R2 library/recovery work is preserved, and pending R2 acceptance gates remain pending. No deployment or merge has been authorised.

The engine already had four pure phases (`controller-scan`, `actuators`, `equipment-state`, `fail-closed`) and five golden-tick scenarios. This increment deliberately extends them, rather than substituting a new simulator or changing the 50 ms authoritative tick.

## Implemented source work

1. **Extract three-phase calculation** from `orchestrator.tick()` into `src/sim/phases/three-phase.ts`. It still consumes the existing fault-filtered three-phase netlist, previous equipment state, actual 24 V energized coil demands and exact `dtMs`. Per-drive mode, faults, interlocks, events and next output image are unchanged by design. `orchestrator.ts` continues to own the one authoritative tick, sequencing 10 ms substeps.
2. **Introduce an explicit bounded Worker command ingress** in `src/sim/worker-mailbox.ts`: all 39 current command kinds recognized; at most 128 commands and 1,250,000 UTF-8 JSON bytes per packet; at most 256 queued commands, 2,500,000 queued bytes and 256 pending acknowledgments. Invalid or oversized requests are rejected atomically and the rejected ID is acknowledged with an error snapshot. The FIFO preserves arrival order and coalesced ACK semantics, without extra PLC scans while running.
3. **Make unexpected tick exceptions stop the virtual actuator image** in `src/sim/worker.ts`. The Worker stops its simulated control outputs, publishes a clear error event and returns the affected request ACK instead of silently crashing with edit history stuck. This is an educational fail-closed state; not safety-rated machinery control.
4. **Add a typed read-only signal adapter** (`src/sim/device-channels.ts`) for each PLC's digital I/O, connected/disconnected numeric analog I/O, per-device worker plant sensor readings and per-device actuator states. The adapter preserves units only when the Worker actually supplies them; unknown plant units are not invented. Signal extraction is capped at 512 rows. It changes no persisted project, Web Worker protocol, snapshot output, electrical solver or runtime state.
5. **Author pure regression coverage** in `tests/stage2-simulation-boundary.test.ts` and `tests/stage2-device-channels.test.ts` for ingress limits, malformed commands, FIFO/ACK ordering, overflow, phase absence on blank worlds, per-instance signal identity, analog disconnection and output limits. Tests are authored but not claimed executed here.

## Compatibility promises

- `ProjectFile.formatVersion: 1` remains unchanged. Import/export and IndexedDB project-library schema unchanged.
- `WorkerRequest` and `WorkerResponse` TypeScript shapes unchanged.
- No additional simulated scan is triggered by a user command while Run is active.
- Three-phase and 24 V models remain separate and educational. No claim of real PLC firmware or IEC/safety certification.
- All existing golden digests are left as-is; run exact-head regression verification before merge.
- The signal adapter is a future diagnostic/IDE integration seam, **not a new device runtime and not yet connected to the UI**.

## Source checks performed

- GitHub branch source checked against the original `signals.ts` command union: **39 declared types / 39 recognized / 0 missing / 0 extra**.
- Verified that the orchestrator imports the extracted phase and no longer contains the old inline phase loop.
- **No TypeScript compilation, Vitest, full build, CI, browser simulation or real hardware checks were run in this increment.** Their status is unverified, not passed.

## Next engineering and acceptance work

- Run `npm ci`, `npm run typecheck`, `npm test`, golden tick tests and browser/worker smoke tests on the exact PR head in a connected checkout.
- Verify no regressions in paused/running queue handling, large legacy project loads, multiple PLCs, isolated supplies, all star/delta cases, seeded faults and save/reload.
- R3.4 legacy singleton removal and generalised first-controller assumptions, R3.5 device channel unit/provenance integration beyond this read-only adapter, and R3.7 comprehensive deterministic replay/mutation coverage remain open.
- R2 browser-level crash/quota/migration/offline-update acceptance and owner-device testing remain open.
- PR review and owner approval precede any merge; deployment and hardware connections are out of scope.

**Release status:** NO-GO / NOT ACCEPTED. This is a source-development handoff only.
