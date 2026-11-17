# TP and CTD deterministic ladder instruction increment
Date: 2026-11-04
Baseline: aa3fe2a95ab0e54b9b7149bc957d3865ec541241

## Instruction behavior
TP: a rising rung-enable edge starts a fixed-width pulse. The triggering scan counts toward elapsed simulated time, so a 60ms preset with a 20ms scan produces three energized scans. The pulse does not cancel on falling input and cannot retrigger during the pulse; held-high input after expiry does not retrigger. This is an explicit training approximation.

CTD: the required external `loadTag` has priority over counting and loads the positive preset while high. When load is false, separate rung-enable rising edges decrement count toward zero. Q is TRUE exactly when CV equals zero, including on a fresh zero-initialized memory before the first load. The count clamps at zero, and load-release while the count input stays high does not introduce a phantom edge.

## Integration and evidence
The ladder editor offers TP/CTD and relevant preset/load controls. Isolated instruction lessons, sample traces, CSV export, read-only ladder audit, truth-table input detection, mutation testing, post-scan timer/counter breakpoints and Chrome lesson smoke now cover the operations. CTD breakpoints use downward rather than upward crossing, and support zero. All simulations run in-browser and are independent of physical hardware safety.

## Remaining limitations
No vendor implementation parity, IEC 61131-3 conformance, real PLC control, certified safety, hardware performance acceptance or complete device/browser validation. CI must pass before merge; a successful Vite build or Vercel deployment alone is not release approval. The product remains frontend-only with no authentication, database or backend.
