# P4 Electrical Depth — Source Code Handoff

**Review:** https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/33
**Branch:** `engineering/p4-electrical-depth-source`
**Source baseline:** main at `7a4c38bc8c33341f1957c2ffd72ead7e1fdd43f2` (after merged #27)
**Status:** SOURCE DELIVERED FOR CODE-DEVELOPER REVIEW. Draft PR only. Not accepted, merged, deployed or certified.
**Owner division:** the assistant produces code, source tests and handoff; the code developer owns combined validation, integration and physical device/browser compatibility acceptance.

## 1 — Created files

| File | Role |
|---|---|
| `src/electrical/three-phase-types.ts` | Strict isolated 3-phase motor/supply nameplate, winding, control and feedback types |
| `src/electrical/three-phase-netlist.ts` | Validates matching L1/L2/L3/PE source→drive connections, prohibits mixed 24V wiring, multiple supplies and crossed conductors |
| `src/electrical/thermal-protection.ts` | Bounded approximate I²t excess-current overload and cooldown/reset memory |
| `src/electrical/motor-dynamics.ts` | 50ms motor acceleration, current, speed, torque, temperature and energy estimates (not IEC motor equivalent circuit) |
| `src/electrical/wired-star-delta.ts` | Wired MAIN, STAR, DELTA, RESET control with no hidden PLC sequencing, 200ms modeled transfer dead-time and conflict interlock |
| `src/electrical/phase-instruments.ts` | Worker-derived phase voltage and illustrative clamp-current/power readings |
| `src/electrical/panel-templates.ts` | Original educational dual-supply terminal-by-terminal six-device, 14-wire starter template and editable ST example |
| `tests/p4-three-phase-domain.test.ts` | Supply continuity, cross/mixed-domain rejection and missing-phase measurements |
| `tests/p4-wired-starter.test.ts` | Motors run only with valid phase power, star/delta interlock and transfer, thermal trip and replay |
| `tests/p4-worker-threephase.test.ts` | **Actual authoritative worker tick:** real 24V PLC/ST commands, physical three-phase terminals, start/stop, isolation, persistence, replay and invalid-wiring rejection |
| `scripts/sandbox-p4-star-delta-browser.cjs` | Source-only Puppeteer browser acceptance recipe, intentionally not an automatic CI gate |
| `docs/product/P4_ELECTRICAL_SOURCE_HANDOFF.md` | This developer handoff |

## 2 — Modified files

| File | Integration |
|---|---|
| `src/components/registry.ts` | New `three-phase-supply` and `star-delta-drive` with separate typed mains, 24V control, feedback terminals |
| `src/components/electrical-defs.ts` | Four real 24V coil loads (MAIN/STAR/DELTA/RESET) and READY/TRIP/STAR/DELTA switched status outputs |
| `src/sim/faults.ts` | Excludes mains conductors from the 24V solver, keeping voltage domains separate |
| `src/sim/signals.ts` | Typed per-drive state, per-source virtual power isolation, phase meter snapshots and explicit `setThreePhasePower` command |
| `src/sim/orchestrator.ts` | Validates phase wiring on import/edit; reads real 24V coil energization; runs motor only with valid 400V supply; produces worker snapshots/events |
| `src/sim/device-state.ts` | Worker-owned source/drive status reused by 3D/inspector |
| `src/ui/sandbox/WorkbenchInspector.tsx` | Selected source isolation, motor rpm, estimated current and trip indicators |
| `src/render/Sandbox3D.tsx` | Original low-poly three-phase source and contactor/motor assembly |
| `src/app/SandboxPage.tsx` | Actual runtime three-phase panel and virtual source isolator, hidden from scored scenario helpers |

## 3 — Behavioral boundaries and invariants

- **Two separate electrical domains.** The legacy 24V reachability solver still processes PLC coils, buttons, safety-stop teaching circuits and auxiliary feedback. L1/L2/L3/PE are NOT 24V nodes and are excluded from its netlist. The new 400V educational domain has independent virtual source continuity.
- The motor operates ONLY when a correctly wired phase source is enabled and 24V MAIN + exactly one STAR/DELTA coil is energized. Outputs are recomputed from the actual PLC worker image and existing terminal graph, never UI animation flags.
- A wiring error, loss of a phase, or disconnected virtual supply means no 400V motor power. Simultaneous STAR/DELTA commands produce an explicit interlock conflict, not an automatic corrected PLC program.
- STAR→DELTA requires a modeled **200ms non-overlap** after STAR opens; a learner who switches too early sees rejected DELTA until the physical model permits transfer.
- Thermal protection integrates an **illustrative excess I²t** approximation. A brief starting inrush is tolerated; sustained excess current causes a latched overload. Reset requires deenergized coils and cooling. These curves are NOT calibrated protection settings or substitutes for manufacturer data.
- Phase voltage and current/power measurements are **simplified simulated values**. The virtual clamp does not model inrush harmonics, fault clearing, actual PE safety, arc flash, 50/60Hz waveforms or installation standards. Do not recommend field electrical wiring from this simulator.
- The source kit contains 14 reference wires and a PLC16 ST teaching program. It is a **learner-editable example**, not a hidden timer or solved factory screenshot; changing ST/wires changes actual motor behavior.

## 4 — Exact developer next steps

1. Review PR #33 source diff and confirm no missing terminal validation or hidden default energized state.
2. Integrate with PR #28, #29, #30, #31 source branches in this order once code owners approve. Conflicts likely in `registry.ts`, `signals.ts`, `faults.ts`, `orchestrator.ts`, `SandboxPage.tsx` and `Sandbox3D.tsx`. Preserve **numeric signal separation from PR #29**, **P1 workspace orientation/selection** and **P2 FBD/ST/source debugger** alongside three-phase isolation. Do not use wholesale ours/theirs on conflicting files.
3. Run the repository full source checks, unit tests and Vite build on the **merged combination**, not just this PR. The PR includes explicit original worker-integration tests and an optional browser acceptance script `scripts/sandbox-p4-star-delta-browser.cjs`; review selectors before adding it to CI.
4. Verify older 24V DOL, reversing, DC multimeter, breaker and E-stop tests remain unchanged. Specifically test open/miswired L1/L2/L3/PE, a supply toggle while paused/running, relay feedback, star/delta overlaps, genuine power loss and a sustained thermal trip.
5. Review field-style language: ensure all teaching content says **illustrative virtual simulation** and makes no safety-rated/standards compliance claims. Hardware, current calibration, real protection, browser/OS/device acceptance are independent development gates owned by the code developer.
6. Do not merge or deploy without author approval. The current PR is deliberately a draft.

## 5 — Engineering evidence and known limits

Source CI on intermediate heads found overly aggressive thermal tripping, a missing UI snapshot field, and then an integration test missing DELTA after 95 scans. Source fixes adjusted the deliberately illustrative thermal memory to tolerate brief acceleration/transfer while still tripping sustained overload. A subsequent source head obtained passing Linux+Windows checks; **the final head must still be independently verified**, and any later source edit restarts that evidence boundary.

The source scope includes new star/delta physical teaching behavior and original 3D assets. It does **not** expand to 3-phase fault-energy calculations, actual IEC contactor trip thresholds, rated breakers, generic SPICE, real PLC Ethernet or calibrated field measurement.

## Handoff status

P4 source package is ready for **developer code review and integration testing**, not formal release. No OS/Mac/Windows compatibility work was performed as a release task, and production deployment remains unauthorized.
