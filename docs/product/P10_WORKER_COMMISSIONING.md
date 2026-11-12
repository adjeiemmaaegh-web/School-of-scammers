# P10 — Worker-Grounded Scene Commissioning

**Branch:** `engineering/p10-worker-commissioning-2026-11-12` stacked on P9 exact-head verified `36d87fd1171b2662a94b8e5d3f22786d3da8fbeb` (draft PR #49). P8 exact-head Actions remain queued, P9 Linux/Windows CI succeeded. No merge or deployment authorized.

## Bounded engineering scope

- Real PLC power comes solely from the worker's `plcs[id].powered`, not graphics or test fixtures.
- Patch diagnostics check real registered terminals: sensor `OUT_*` → PLC input, actuator `CMD_*+` ← PLC output and numeric `AN_*` → analog PLC input. This is direct-patch evidence, not proof of complete electrical circuit or system safety.
- The original PLC16 placeholder never earns credit for an authored program. Changed Ladder/FBD/ST earns source-edited acknowledgement, not a correct-control conclusion.
- Genuine worker simulation time, actual physical body positions, typed sensor transitions and model actuator changes provide the only dynamic evidence. Missing signals, no motion or just the simulation clock can never earn behavioral credit.
- Evidence is transient, signature-bound to project content and cleared after modification, time reset, scene change or browser restart. There is no account, server or data upload.
- Seven live diagnostic checks: required equipment, PLC power, recommended direct terminal patches, learner-authored source, worker scan progress, worker physical/signal response, outstanding faults or error conditions.
- The matching 21-scene gallery now displays a collapsible read-only commissioning panel. There is no manual force-pass operation and no industrial certification claim.

## Mandatory tests

- `tests/p10-scene-commissioning.test.ts` — original default remains unpowered, patch types checked, true worker 24V PLC power, edited ST, monotonic worker evidence, reset/project revision invalidation, no synthetic success and fault reporting.
- `scripts/sandbox-p10-commissioning-browser.cjs` — actual Chromium worker factory scene, no false credit for unwired default, real 24V PLC/terminal patch after reload, no false PLC program or physical cycle completion.
- Existing full Linux/Windows Edge CI including all P0–P9 regression, Chrome, Firefox, WebKit, no-WebGL, offline and accessibility checks remain mandatory. Software verification requires exact P10 source head green on both workflows.

## Remaining higher-fidelity development/acceptance

- Real chronological scene-specific outcome verification across all 21 workcells, actual input/output sequencing, fault campaigns and multiple valid reference solutions; source-edit acknowledgement is not genuine control correctness.
- Better motor/protection engineering realism, calibrated material handling and 3D robot physics, interoperable external PLC drivers, CAD components and hardware benchmarks.
- Owner-run low-spec 8 GB Windows/GPU-less physical operation, live hardware PLC interoperability, visual approval, safety, license and production release gates.
- P8/P9/P10 remain draft/unmerged pending independent acceptance and owner merge authorization.

This is a bounded educational diagnostic, not an approved production industrial commissioning or safe-stop system.
