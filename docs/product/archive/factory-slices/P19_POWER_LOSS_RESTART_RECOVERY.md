# PLC Skills Lab — P19 Controlled Restart After 24 V PLC and Conveyor Drive Outages

**Defined 2026-11-13.** Engineering baseline: verified P18 exact SHA `1a1e99616be084c6501ec1652aa0421de7803ed5`.  
Source: `engineering/p19-power-loss-restart-interlock-2026-11-13`. Review only: [draft PR #59](https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/59).  
All P8–P18 ancestors remain draft/unmerged. **Production release: NO-GO.**

## Motivation

P18 demonstrated that a physically jammed conveyor requires an explicit post-repair PLC reset. It did not test whether conveyor or PLC power restoration unexpectedly restarts moving workpieces after a supply failure. A controller's Structured Text state can persist across a simulated power interruption even as its powered outputs de-energize, so a restored PLC may issue its previous run coil without a new operator decision. P19 prevents automatic motion in an **opt-in, educational single-controller bottle line** and asks the learner to commission an explicit supervised restart.

## Authentic source-engine behavior

- `src/plant/equipment/transport.ts` adds belt `restartHoldMode` (default 0 = exact inherited behavior, 1 = gated restart), `CMD_resetRestart+` (real 24 V output load), `OUT_restartRequired` (physical feedback signal), and private worker-owned state for the prior controller power, observed LOW acknowledgement, reset edge, and pending restart state.
- `src/sim/orchestrator.ts` forwards the **actual electrical-solver PLC powered state**, not a source-owned or UI-supplied tag, to `src/sim/p3-plant-bridge.ts`; it is made available internally only to the belt model. P19's acceptance explicitly restricts this input to the original **single `plc16` bottle-line**. Behavior for arbitrary multi-controller plant layouts is not qualified.
- A real `wire-open` fault on the **sole physical supply.P24 → PLC.L+ conductor** drops the 24 V controller image. PLC output Qs de-energize because the real solver stops them; the running belt physically stops. Separately, a registered `motor-dead` drive-power failure stops the belt while PLC supply remains on. Both events latch `restartRequired` and zero motor speed.
- Repair of the original conductor or drive *only* restores electrical/drive availability; the same physical cylinder remains stopped. To reset, the belt must see a **healthy powered scan with resetRestart LOW**, then a new energized resetRestart edge while the fault is absent, and must remain independent of P18's separate jam reset latch. A reset stuck HIGH across the outage cannot self-restart, and a jammed belt cannot be bypassed by restart reset.

This is a deterministic teaching interlock, **not a certified industrial start circuit or a machine safety function**. Source loss does not model real brownout waveforms, nonvolatile PLC memory certification, actual motor kinetic inertia, hazardous energy isolation, actual drive STO, human-safe restart zones, or SIL/PL functional safety verification.

## Complete bounded P19 assessment

`src/plant/scenes/matrix-p19.ts` operates only in a private offline simulation Worker, with the original learner source and the real 24 V feedback/drive wires:

- Original Q0.0–Q0.3 drive the feeder, belt, filler and capper. P18 Q0.4 is reserved for **jam reset**, P19 Q0.5 for **restart reset**. Original belt `OUT_jam` powers I0.6; original belt `OUT_restartRequired` powers PLC I1.0 (the ST `In8` field). P19's ephemeral 24 V Start and separate maintenance-acknowledgement input use I0.0 and I0.7 only inside the private assessment Worker.
- The evaluator selects a real original cylinder 1, 2 or 3 **while it is moving on the powered conveyor**, injects either the authentic PLC supply conductor fault or drive motor-dead fault, observes the same body's position and real feedback across 12 powered scan windows, then performs an explicit service repair. It requires a further 12-scan period where supply is restored but motion remains inhibited and `restartRequired` still is true.
- Only then does the evaluator pulse a true electrical 24 V maintenance button. The learner's PLC must command its own fresh reset Q0.5 and resume that original cylinder, fill to at least 500 mL, cap it individually, and complete three genuine originally spawned bodies. No product cloning, bypassed cell, body replacement or direct forced Q values are accepted.
- The campaign covers **six independent positive profiles** (two outage kinds × three first/middle/final bottle positions with independently seeded feeder materials), plus an exact **seventh deterministic replay** of one genuine electrical supply outage.
- A passing result demands 18/18 original physical workpieces completed, real isolated PLC/drive outage observations, restored-power inhibit, fresh output edge, same-body recovery, unique IDs, absence of false idle behavior, intact learner source, and exact replay.
- Deliberately invalid offline test-only controllers with no reset, stuck-ON reset or incorrect Start cannot pass. Disconnected feedback/reset supply or duplicate control-power wiring fails preflight without simulating a false success.
- `src/sim/p12-assessment.worker.ts` exposes `run-power-recovery` as an isolated bounded Worker request. `src/ui/sandbox/SceneMatrixPanel.tsx` displays an opt-in per-original-cell button, explicit terminal configuration, results of every physical/PLC evidence gate, successful product counts, and a deterministic replay marker. All results and private switches are destroyed on project edits or reload; no backend, file upload, storage score or cloud endpoint exists.

## Automated evidence and required gates

Tests are `tests/fixtures/p19-power-programs.ts` (instructor-only offline ST reference, never installed into learner product), `tests/p19-power-restart.test.ts` (machine model, real 24 V and genuine six-product-profile Worker trials, bad-controller and preflight controls), and `scripts/sandbox-p19-power-restart-browser.cjs` (real original unsolved scene → program/wires → private Worker → six outages, replay, source-negative failure and unchanged saved source).

The complete source must pass on the **exact final HEAD**: Linux Node 22 source verification, semantic TypeScript, all Vitest, Vite/offline build and transfer budget; inherited P1–P18 Chromium/PLC/3D authoring regression; new P19 Chromium acceptance; no-WebGL low-resource fallback, automated accessibility and Firefox + Linux WebKit routes; separate hosted native Windows Edge. Neither a previous green commit nor a green partial job establishes P19 accepted.

## Open blockers, deliberate limits, release NO-GO

P19 proves only deterministic original-bottle supply/drive interruptions within a classroom single-PLC model. It does not prove actual safety interlocking, retentive PLC startup parity, physical equipment current, human safeguarding, full 21-scene equivalent automation, persistent multi-shift reliability, realistic line load and friction, industrial event recovery, real vendor communication or calibrated manufacturing throughput.

Owner-run Windows 11 8 GB no-dedicated-GPU/3D WebGL, real PLC and power electronics, instructor/learner manual validation, licensing/legal/security/accessibility review, complete unmerged stacked-PR reconciliation and deployment approval remain **OPEN**.

No external deployment, account features, database, cloud sync, payments or real industrial outputs are authorized. **P19 source-development completion must be recorded independently from production/customer/industrial acceptance.**
