# Stage 2 — Simulation Architecture: development handoff

**Date:** 2026-11-20  
**Branch:** `engineering/stage2-simulation-architecture-20261120`  
**Parent development branch:** `engineering/stage1-workspace-completion-20261120`  
**Status:** `DEVELOPMENT_IN_PROGRESS` — the initial increment and additional R3.2/R3.4/R3.5/R3.7 source work are committed; the full R3 scope is **not complete**.

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

## Continued Stage 2 source development (same PR #94)

6. **Per-device isolation (R3.4):** `src/sim/device-state.ts` now uses historical first-instance live flags only for the device that actually owns each legacy mirror. A second motor, PLC, conveyor, lamp, contactor, pump, valve or breaker no longer borrows the first device's state if its own snapshot entry is absent. The special classic-first-PLC legacy path remains, intentionally, for v1 compatibility.
7. **Canonical integration seam (R3.2):** `src/sim/device-contract.ts` joins the existing visual/terminal, parameter and physical-plant definitions by device kind without building another independent registry. New equipment can read the existing integrated signal definitions and fault capability list.
8. **Real typed telemetry in the inspector (R3.5):** `src/sim/device-channels.ts` now supports a selected-device scope and unit metadata taken from the registered physical model, not from heuristics; `WorkbenchInspector.tsx` exposes the snapshot's digital, numeric and disconnected channels with source labels. The list scrolls independently on tablets and desktop. A missing signal stays missing; numeric channels are not treated as 24 V power.
9. **Bounded replay API (R3.7):** `src/sim/replay.ts` offers deterministic command/scan scripting and named snapshot checkpoints, with frame, command and scan limits. It reuses the one authoritative `tick()` implementation, and full serialized snapshots/events can be compared across two independent runs. No wall clock or second simulator was introduced.

10. **PLC fault isolation:** Every PLC runtime-error path in `src/sim/phases/controller-scan.ts` now clears the full legacy output group and prior three-phase display state, rather than leaving Fill/Drain/Forward/Reverse or virtual drive state lingering after an invalid typed ST output. The simulated electrical voltage image is also cleared for invalid output-type faults.

## Further Stage 2 development continuation

11. **Controller failure observability:** `deenergisedPlcs` clears stale output tags as well as coil state, keeping monitoring consistent after a runtime exception while leaving inputs and numeric registers available for diagnostics.
12. **PLC ownership and promotion:** When the first PLC is removed, the next PLC retains its own FBD document alongside its LD/ST program. Program updates now reject non-existent controller IDs rather than creating orphaned code records.
13. **Replay event bounds:** Named replay checkpoints retain at most 512 events each and explicitly report overflow counts; simulation scripts cannot accumulate unlimited debug-event arrays across thousands of scans.
14. **Powered numeric preview:** Paused I/O inspection requires an actual modeled 24 V differential between the sensor's L+ and M terminals, not simply the presence of voltage-map entries. Floating or unpowered wires are not labeled powered.
15. **Signal provenance display:** The inspector now describes digital electrical I/O, numeric process measurements, plant model values and actuator output images by their registered origin and relative scan timing. Unsupported ranges, actual-current equivalents and hidden fault identities remain unspecified.
16. **Pause priority:** A standalone Pause command can bypass a saturated Web Worker edit queue. Pending edits are cancelled with acknowledgements instead of executing after the pause; this is virtual learning-model control, not a safety-rated physical stop.

These changes do not rewrite `tick()`, alter existing 50 ms / 10 ms scheduling, migrate the persisted `formatVersion: 1` schema or authorize any real PLC/hardware control.

**Stage 2 development is still open.** Remaining scope includes deeper first-class PLC runtime consolidation, truthful device-level range/power/fault metadata where the underlying models support it, and full R3 contract/document consolidation. This handoff does **not** claim that the entire Stage 2 or R3 roadmap has been completed.

## Current continuation — Stage 2 source improvements

17. **Plant equipment cleanup:** Removing a device now also removes its keyed `plantFaults` entry. Previously the deleted component could leave an invalid orphan fault in the saved v1 project.
18. **Controller order independence:** The P3 conveyor interlock sees the observed presence of **any** 24 V-powered PLC, not only the first controller. The legacy primary I/O/trace path remains unchanged. This signal is project-wide, **not** a claim of per-belt controller ownership.
19. **Analog status accuracy:** The inspector distinguishes an unpowered PLC's unavailable numeric sample from disconnected wiring and actual numeric readings, without changing the runtime's electrical/analog simulation.
20. **Bounded Worker event stream:** Outbound events are limited to 256 per reply, details are capped at 512 characters, and a deterministic overflow notice records omissions. Replay comparison now identifies mismatches in the final snapshot instead of returning no divergence location.
21. **Canonical lifecycle contract:** [Stage 2 device lifecycle and simulation integration](STAGE2_DEVICE_LIFECYCLE_CONTRACT.md) documents one device identity, canonical source modules, port domains, lifecycle, telemetry and compatibility boundaries. No second registry or simulation authority was added.

**Remaining development:** The classic first-controller execution path still differs from generic runtime controllers; per-belt controller attribution and fully defined signal ranges/power/fault metadata need source-backed designs; the full R3 kernel consolidation is not finished. Earlier performance and acceptance work remains outside this owner-requested development-only continuation.

## Further Stage 2 progress — PLC observation consolidation

22. **Unified PLC snapshot projection (R3.4):** `src/sim/plc-observation.ts` now builds every read-only `plcs[id]` snapshot through one canonical function. The classic first PLC still reads its historical scan fields; independent PLC16 and secondary controllers read per-instance runtimes. All snapshots retain the existing layout and PLC scan ownership.
23. **Shared PLC power image (R3.4):** `src/sim/plc-power.ts` reads each PLC's own L+/M terminals from the one solved 24 V circuit. The same per-ID readings now drive the primary PLC power image, subsequent PLC scans and the virtual plant's project-wide PLC presence. No extra PLC scan, shadow engine or persisted field is introduced.
24. **Electrical fault boundary:** The present solver globally inhibits loads when any supply short is detected; the stage preserves that legacy global-short behavior. Real per-supply short isolation, per-belt PLC ownership and a fully generalized first-controller execution engine are **not implemented** by these additions.

25. **Canonical wired digital input image (R3.4):** `src/sim/plc-input-image.ts` now samples the fixed classic PLC input mapping and all configurable PLC digital inputs through a single pure, per-controller reference-relative electrical adapter. Sensor-specific powered-photoeye and tank-probe gates remain in force. The original global five-tag mirror still follows the first controller's **physical** I0.0–I0.4 positions, while a first PLC16's generic program uses its configurable map. The classic first controller's execution engine and `formatVersion:1` project persistence are unchanged.
26. **Canonical virtual failure stop (R3.3/R3.4):** `src/sim/phases/fail-closed.ts` now owns the stopped-world projection used by three PLC failure branches and the Worker exception boundary. All previously cleared six outputs, per-PLC output tags, drive/actuator states and terminal-voltage images have one common implementation. Historical exception diagnostic messages and the Worker's 30-entry limit remain.
27. **Authored, unexecuted regressions:** `tests/stage2-plc-input-and-fail-closed.test.ts` specifies fixed input naming, sensor power guards, controller-reference isolation, renamed I/O, deenergized independent PLCs and diagnostic limits. **This is source authoring only; tests/build/physical acceptance have not been executed or established.**

**What remains:** full first-controller execution-path unification, justified physical metadata and per-device PLC-to-plant associations remain open. These changes consolidate integration boundaries without creating another scan, changing the 50 ms / 10 ms timing contract or claiming complete Stage 2 development.

## Current continuation — canonical PLC execution unification

28. **Shared PLC language execution (R3.4):** The first classic PLC now invokes the same `src/sim/plcs.ts:scanPlc()` execution path as later classic PLCs and PLC16s for Ladder, Structured Text and Function Block Diagram. The shared executor exposes a transient result callback used only to populate historical breakpoint and scan-trace data without running the interpreter twice. The first PLC's program remains in legacy v1 `ProjectFile` fields; its runtime remains mirrored in historical `WorldState` fields to avoid migration.
29. **Compatibility specifics:** Fixed first-PLC electrical tag positions, output-key ordering, legacy LD/ST/FBD memory stores, and the distinct legacy invalid-ST-output error message are retained by design. Generic configurable PLC16 tagging remains independent. The one 50 ms tick and 10 ms plant substeps remain unchanged.
30. **Regression specifications added:** `tests/stage2-unified-plc-execution.test.ts` defines direct-versus-worker classic Ladder equivalence, per-language single execution capture, unpowered no-execution and PLC16 isolation; original `tests/r3-golden-tick.test.ts` was not modified. No test execution, semantic typecheck, browser acceptance or build has been verified for this refactor.

**Remaining development:** The first PLC's persisted-program and runtime **storage** mirrors are intentionally not converted into `plcs[id]`, as that is a separate migration risk. The wider R3 source consolidation also still has missing fully specified signal ranges/power attribution and further scene-body/worker profiling. R3 development and release acceptance therefore remain **open**.

**Limitations:** This continuation was performed through live GitHub source commits rather than a complete local checkout. No compile, test suite, browser acceptance, hardware work, merge or deployment is claimed. Replay comparison is an implemented utility, not independently established determinism for every scenario.

## Next engineering and acceptance work

- Run `npm ci`, `npm run typecheck`, `npm test`, golden tick tests and browser/worker smoke tests on the exact PR head in a connected checkout.
- Verify no regressions in paused/running queue handling, large legacy project loads, multiple PLCs, isolated supplies, all star/delta cases, seeded faults and save/reload.
- R3.4 remaining internal first-controller/singleton assumptions, R3.5 full channel timing/range/power-reference and fault-observability metadata, and R3.7 comprehensive scenario coverage remain open. The first-instance UI fallback and inspector integration described above are done.
- R2 browser-level crash/quota/migration/offline-update acceptance and owner-device testing remain open.
- PR review and owner approval precede any merge; deployment and hardware connections are out of scope.

**Release status:** NO-GO / NOT ACCEPTED. This is a source-development handoff only.
