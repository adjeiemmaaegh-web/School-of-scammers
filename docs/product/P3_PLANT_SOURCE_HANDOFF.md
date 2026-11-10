# P3 Plant and Equipment Simulation — Source Development Handoff

**Source-development status:** **COMPLETED (P3 source scope)** on 9 November 2026. This is a development checkpoint, **not** combined-branch acceptance, industrial equivalence, device certification, merge approval or production release.

- Review: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/32
- Working branch: `engineering/p3-plant-world-source`
- Base: `main` at `7a4c38bc8c33341f1957c2ffd72ead7e1fdd43f2`
- Verified implementation head before this documentation-only commit: `ba7df4347655c96cca5ad8176eb7e47704788e17`
- Division of work: source author delivers source, automated regression tests and handoff; integration/code developer owns combined-branch review, merge decision and formal hardware/browser/device acceptance. No approval to merge or deploy.

## Delivered and connected source

1. **Deterministic authoritative plant world** — `src/plant/world/{types,math,seed,bodies,physics,events,equipment,runner}.ts`. Each 50 ms PLC scan advances five 10 ms substeps. Bounded equipment/body/event capacity, seeded replay, quantitative physical state, body conservation/accounting and typed measurements. The plant's state is computed in simulation code; Three.js only renders worker snapshots.
2. **25 original educational equipment definitions** — `src/plant/equipment/`: belt conveyor, roller conveyor, turntable; stopper, pusher, diverter gate; box feeder; geometry photoeye, inductive proximity, capacitive proximity, light curtain, weigh cell; lift, scissor lift, rotary actuator, pick-and-place, palletizer; shelf, AS/RS crane, robot arm; process tank, mixer, heater, proportional valve, filler and capper. All expose a common bounded definition, state, commands, signals, faults and original primitive 3D drawing descriptions.
3. **Ten original editable starting scenes** — `src/plant/scenes/catalogue.ts`: sorting line, gate accumulation, weigh reject, two-level lift, gantry transfer, palletizing, mini warehouse, robot sorting, mixing tank, bottle filling/capping. Scene loading through `src/sim/p3-scene-import.ts` produces unsolved layouts; it does **not** fabricate connections or execute a hidden reference solution.
4. **Worker, PLC and electrical integration** — `src/sim/p3-plant-bridge.ts`, `src/sim/p3-numeric.ts`, `src/sim/orchestrator.ts`, `src/sim/plc-io.ts`, `src/components/{registry,electrical-defs,params}.ts`. Actual 24V wired PLC outputs energize equipment command loads. Equipment geometry/process sensors feed the real next PLC scan. Engineering-unit numeric measurements use isolated PLC16 AI0/AI1 wiring and never conduct 24V. Invalid wires, missing numeric sources, faults and project imports are checked.
5. **Visible 3D and operator workflow** — `src/render/PlantWorld3D.tsx`, `src/render/Sandbox3D.tsx`, `src/ui/sandbox/PlantScenePanel.tsx`, `src/app/SandboxPage.tsx`. Render-only model, live worker-derived bodies/measurements, scene gallery and pause-gated fault inspector.
6. **Reproducible test sources** — `tests/p3-equipment-contract.test.ts`, `tests/p3-world-physics.test.ts`, `tests/p3-worker-integrated.test.ts`, `tests/p3-numeric-plc.test.ts` (17 P3-specific unit/integration tests total) plus `scripts/sandbox-p3-plant-browser.cjs` (additional optional developer-run browser acceptance recipe, not itself evidenced as executed).

## Verification on implementation head

At `ba7df4347655c96cca5ad8176eb7e47704788e17`:
- GitHub Actions **PLC Skills Lab - Build and Test**, run [42555464316](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42555464316): **success**, 100 test files, **888/888 Vitest tests**, TypeScript and Vite build, and existing automated browser/compatibility smoke steps. The four new P3 test files passed (4+5+4+4).
- GitHub Actions **Windows Edge Hosted Runner**, run [42555464171](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/42555464171): **success**.
- These are CI results on the exact implementation head named above. A documentation commit has a new SHA and does not retrospectively change that evidence. The optional P3-specific browser recipe has **not** been independently signed off as run. Do not equate hosted browser smoke with owner device acceptance.

## Developer integration checklist

1. Review PR #32 and the source ownership; rebase/cherry-pick deliberately with P1/P2 and P4 source changes, preserving the authoritative single simulation clock. Do not resolve `orchestrator.ts`, `signals.ts`, `registry.ts`, `SandboxPage.tsx` or `Sandbox3D.tsx` conflicts by wholesale overwrite.
2. On the combined tree, run dependency install, TypeScript check, Vitest suite, Vite production build, and the project's existing source/browser smoke workflow. Then exercise `scripts/sandbox-p3-plant-browser.cjs` manually in the developer's controlled test environment; its selector/fixture assumptions should be reviewed.
3. Confirm equipment-to-PLC typed I/O, zero-energy/unwired behavior, 24V separation from numeric signal bus, body spawn/despawn conservation, fixed-step replay, scene import/export, fault persistence, and 3D snapshot-only rendering.
4. Validate combined P3/P4 behavior and interaction with P1 workspace orientation/selection and P2 ST/Ladder; create a separate integration acceptance record with exact SHAs.
5. Keep the PR unmerged pending human review. Formal lower-spec-device, physical PLC, electrical accuracy, real machine, accessibility, safety and production release acceptance remain independent.

## Explicit, bounded simulation limitations

- Original educational equipment approximations, not measured machine dynamics or safety-rated industrial control. Determinism, energy-unit sensors and 3D geometry are checked in software, not calibrated against hardware.
- The current project placement bridge fixes yaw to 0 pending P1/P3 orientation integration. Do not claim full authorable 3D orientation in this source-only branch.
- Numeric **sensor outputs** reach PLC16 AI0/AI1; numeric **equipment setpoint inputs** have model-layer support but no general PLC analog-output binding yet. Current worker command bridge uses bounded illustrative defaults; analog-output commissioning/PID belongs to later advanced integration. Do not present arbitrary numeric setpoints as functioning wired PLC outputs.
- Scenes are original unsolved teaching layouts. Ten supplied scene layouts do not establish equivalence to any third-party simulator or all machine movements in a real factory.
- No physical PLC Ethernet traffic, real electrical hazard validation, measured motor/process accuracy, licensed industrial IDE compatibility, deployment or production acceptance is claimed.

**Disposition: P3 source-development deliverable COMPLETE; developer integration and formal acceptance NOT COMPLETE.**