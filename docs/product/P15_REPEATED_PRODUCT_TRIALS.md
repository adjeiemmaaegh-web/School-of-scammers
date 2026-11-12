# PLC Skills Lab — P15 Repeated Physical Product Trials (Draft)

**Date:** 2026-11-12  
**Source:** Exact P14 CI-green commit 535f303e5f044692aaf42988f4d8fc2c17cf1b7f.  
**Branch:** engineering/p15-multiproduct-process-validation-2026-11-12.  
**Release:** NO-GO. Unmerged review stack, no deployment. P15 is a bounded engineering increment, **not yet full P15 factory-process intelligence**.

## Source implementation

P14 exercised one product per isolated process challenge. P15 adds real 24 V / PLC16 **repeat-production commissioning** in an additional private, ephemeral Worker trial for the same four advanced source scenes. Every test uses exact learner-authored Ladder/FBD/ST logic, genuine powered electrical Q outputs and original worker-owned physical bodies; no fake command writes, body insertion, prefilled result, saved score, backend, DOM/Three.js result or external network action.

| Factory scene | P15 source-model test |
| --- | --- |
| Gantry transfer | Three separate feeder cartons, grip/dispatch/release of each, return-to-home between pickups, distinct IDs and stable outbound positions |
| Palletizing | Eight separate feeder cartons, exact 2×2×2 pattern slots and layer tags, conserved IDs and pattern-done feedback; ninth actual carton refused with no phantom extra placement |
| Robot sort workcell | Three distinct cartons gripped, transported and released with bounded reach; **does not prove material classification or two-lane sorting** |
| Bottle line | Three original physical cylindrical bottles, real slow belt travel, measured at least 500 mL fill and cap-after-fill, distinct IDs and conservation |

Additional model corrections:

- The capper's dwell tracks a specific body ID. A replacement bottle cannot inherit the previous bottle's partially elapsed dwell, even with the output continuously high.
- Palletizer placement is limited to configured rows × columns × layers. Each placement needs a new PLC place rising edge, and tags retain the unique pallet slot and layer.
- Original P14 assessment is retained. The additional repeated-production UI button runs a separate temporary-worker trial. Edits or reloads clear results; private switch fixtures are never saved.

This is **scripted operator-demand PLC commissioning**, not autonomous factory production: temporary training inputs request sequential stages. Do not infer industrial throughput, safety, robotic kinematic accuracy, quality metrology, or equivalence with commercial simulators.

## Tests and negative controls

- Source: tests/p15-multiproduct-process.test.ts exercises all four workcells, stable original IDs, wrong always-on/always-off controllers, missing wiring/faulted sources, capper's per-body timed dwell and pallet capacity.
- Browser: scripts/sandbox-p15-multiproduct-browser.cjs requires real Chromium UI → module Worker → 24 V PLC program → real cylinder feeder/belt/fill/capper for three bottles, rejects a constant-ON program, and verifies no stored assessment.
- Inherited P1–P14 tests, semantic TypeScript, build/offline operation, Chrome/Firefox/WebKit, accessibility/no-WebGL and hosted Windows Edge must pass on the exact final head before source verification can be claimed.

## Explicit remaining P15 work and release blockers

1. Autonomous feedback-controlled PLC production, FIFO, variable products, and multiple independent valid engineering solutions.
2. Actual robot material-classification routing to two physical destinations and measurable rejects.
3. Faults and validated repair/restart during the repeated multi-product trial, rather than only the independent P14 single-product cases.
4. Line-wide throughput/jam/overflow metrics with many interacting carriers; instructor reference trials.
5. Dynamic load support/stack stability and multi-pallet turnover beyond the bounded four-slot teaching pattern.
6. Owner-run 8 GB no-GPU Windows/browser and real PLC testing; industrial safety, security, license/asset reviews and selective reconciliation of stacked unmerged PRs.

P15 remains a **partial engineering milestone, not production-accepted**, until these open items are engineered and verified. No merge, physical industrial I/O, external hosting, SaaS backend/auth/database or payments have been authorized.
