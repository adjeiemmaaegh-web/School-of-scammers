# PLC Skills Lab — P17 Seeded Material Lots and Physical Quality Campaign

**Defined:** 2026-11-13, after P16's verified development increment.  
**Starting source:** P16 exact CI-green `5f67a545dcb3a619b05e5caca7e29d5100cd1a1e`.  
**Branch:** `engineering/p17-seeded-material-quality-campaign-2026-11-13`.  
**Review:** independent draft PR, do not merge or deploy. Earlier P8–P16 draft ancestors remain open.  
**Release:** NO-GO.

## Scope and reason

P16 completed first/middle/final equipment-fault trials, but it used only the default deterministic feeder RNG. A learner controller could accidentally be tuned to one material arrival order, especially the P15 robot sorting workcell. P17 makes **material-lot diversity a separate required physical assessment**, without replacing P16.

Three isolated genuine PLC/plant trials run with **feeder seed 1, 42 and 65535**. The feeder produces bodies only when commanded by the actual learner PLC's electrically energized outputs. This is not synthetic test body injection. The only permitted seed change is on an **empty, private in-memory Worker plant world before PLC operation**. An optional materialSeed parameter is integer-validated (1 through 4,294,967,295), and defaults to 1 so every inherited P1–P16 path retains exact behavior. Seed settings, test switches, faults, grades and timestamps are never persisted to the learner's project.

Each seeded material lot uses a different *actual* physical machine-fault position. Fault positions are 1, 2 and 3 in gantry/robot/bottle; 1, 4 and 8 in palletizing. A fourth independent trial repeats seed 42 and the middle-position fault to verify the complete original-body trace, simulated timing, workpiece counts and processing status are deterministic.

| Original workcell | Three real seeded batches | Required physical quality evidence |
| --- | --- | --- |
| Robot material sorting | 3 batches × 3 cartons | Each metal/cardboard class is sensed via actual PLC inputs and physically routed into its matching independently powered conveyor lane. Material sequences: CCM, CMC, MCC. All three lots must contain both classes |
| Gantry transfer | 3 batches × 3 cartons | Original body identity, worker-completed transfer, physical outbound position and released gripper |
| Palletizing | 3 batches × 8 cartons | Eight distinct original body identities and exact pallet slots 0–7, physically placed in configured two-layer 2×2 teaching pattern |
| Bottle fill/cap | 3 batches × 3 cylinders | Original physical cylinder, at least 500 mL filled from the actual process engine and a real per-bottle cap completion tag |

## Source-grounded results

- `src/plant/scenes/p17-product-trace.ts` declares an explicit **original-body quality ledger** derived only from actual final worker `Body` states: ID, material, shape, observed worker position, supported machine, measured training fill volume, cap, pallet slot and pass flag. No renderer geometry or text-only source is accepted as process evidence.
- Both P15 autonomous engines accept optional bounded materialSeed and return the genuine physical body ledger/material sequence, with P16 and older defaults unchanged.
- `src/plant/scenes/matrix-p17.ts` grades three independent lots plus exact middle-lot replay; verifies seed-to-material provenance against the deterministic feeder RNG, unique body IDs and physical trace, non-duplicated products, complete original-source identities, actual process quality and class diversity. The scorer is independent of authored Structured Text style, exact solution name, test fixtures and UI state.
- `src/sim/p12-assessment.worker.ts` runs this audit entirely in its existing dedicated offline Worker.
- `src/ui/sandbox/SceneMatrixPanel.tsx` exposes an additional opt-in P17 button, per-lot statuses, expandable per-body trace, virtual quality yield and explicit model-only throughput. Results are not stored and are invalidated when the learner modifies the source.
- `tests/p17-seeded-material-campaign.test.ts` covers all four workcells, three material orders, physical positive results, exact replay, wrong robot-route controller, missing sensor, bad numeric seeds and no project mutation.
- `scripts/sandbox-p17-material-lots-browser.cjs` tests actual Chromium UI and private Worker against original unsolved robot and bottle scenes: user-equivalent wiring and PLC code, three lots, quality trace, repeatability and bad-program refusal. The existing P16 anti-bypass and prior P1–P15 regressions remain mandatory.

## Testing and non-release gates

Do not report P17 completed until the **exact final head** passes the full Linux CI (TypeScript, Vitest, Vite/offline, mandatory new P17 Chromium, all earlier browser scenarios, accessibility, no-WebGL fallback, Firefox and WebKit), and separately the hosted native Windows Edge workflow.

The new lot-yield and throughput figures are **deterministic educational simulation metrics**, not empirical manufacturing capability, Cpk, reliability, metrological fill accuracy, mechanical safety or an ISO/IEC industrial certification. Three small material lots do not constitute high-volume plant endurance, varied measured physical masses, stochastic timing, complete conveyor jam recovery, realistic human safety or Factory I/O equivalent quality. Those remain open product gaps. Real Windows 8 GB/no-GPU owner testing, physical PLC interoperability, manual cross-browser and accessibility, security/legal/assets, instructor/user acceptance and selective stacked-PR merge remain unverified. No cloud, backend, account, payment, live PLC or external deployment is authorized.

**P17 source development verification and production/customer acceptance are separate gates.**
