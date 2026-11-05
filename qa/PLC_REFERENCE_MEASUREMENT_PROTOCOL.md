# Independent PLC reference capture protocol
Date: 5 November 2026

**State: not executed with a physical PLC.** The engineering workbench now accepts external reference CSV traces but cannot verify their authenticity. For a valid independent review, capture original program, controller/vendor/model/firmware, task interval, watchdog settings, I/O sampling time, online monitor/export software and measurement operator's signed observation. Record safety isolation with a qualified engineer before testing.

1. Export the ladder-specific CSV header from the new workbench **External PLC reference trace comparison** panel.
2. On a reference PLC test rig under qualified supervision, map the same BOOL input names and each authored output coil. Capture **every consecutive scan**, the actual elapsed `delta_ms` and each input/output value. No invented or extrapolated values.
3. Cover startup, stop, guard-open/closed, timer boundaries, rising/falling edge, counter reset/load, memory restart and emergency-stop cases where the real system is appropriate. Never use a production safety machine for unreviewed tests.
4. Import the captured CSV into the workbench. Export/screenshot mismatches by scan and coil. Store the original controller log unchanged, along with its independent reviewer’s identity outside this public repository.
5. Compare time semantics and vendor-specific behavior explicitly. **A zero-difference CSV is not PLC equivalence until provenance, calibration, and review are independently checked.**

The importer intentionally supports sequential scan rows and BOOL input/output values for this educational ladder subset, not all PLC trace formats or vendor instructions. No genuine PLC trace is currently attached.
