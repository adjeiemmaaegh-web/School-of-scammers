# PLC Skills Lab — Factory Composer Engineering Increment
Date: 2026-11-03
Repository: https://github.com/adjeiemmaaegh-web/School-of-scammers
Reviewed engineering source: 1e1f6d8db438176c586f7dfc1fe7389cf3197bce
Evidence: https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/41618485568

## Delivery
A new browser-based offline-first workcell authoring workspace has been added under /workcell-composer. It allows trainees to arrange, label, tag, select, rotate and move 7 device families (conveyor, tank, cylinder, pump, photoeye, control panel, fence) on a 13-by-13 planning grid. The authored positions appear in an optional 3D floor preview. It has a low-resource simplified view, accessible floor-plan interaction, keyboard-operated editing controls, local scene persistence, revision undo/redo, bounded JSON import/export and explicit recovery of corrupt storage without destroying the original damaged bytes.

The editor includes deterministic 100-ms teaching device scans and discrete/numeric I/O feedback. It supports a sample ladder control program plus import of a validated PLC engineering-project file, mapping output coils with the suffix _CMD to virtual devices, and sampling virtual photoeye/panel inputs and feedback. An educational supervisor inhibits virtual actuation when operator E-stop, guard or auto permit is false. This is **not** an electrical safety controller or a hardware-qualified interlock.

## Source changes
- src/engineering/workcell-layout.ts — schema, bounds, authoring, scan, safe storage and recovery
- src/engineering/workcell-plc.ts — ladder/plant adapter and sample PLC program
- src/components/WorkcellComposer.tsx — 3D scene and floorplan editing, I/O and PLC controls, import/export
- src/components/workcell-composer.css — responsive and accessible layout
- src/main.tsx / src/lab-catalog.ts — navigation, lazy loading and training catalogue
- tests/workcell-layout.test.ts and tests/workcell-plc.test.ts — regression tests
- tests/lab-portal.test.ts / scripts/browser-acceptance.cjs — route and Chrome smoke coverage

## Verified gates, GitHub Actions PR run 41618485568
- Offline engineering suite: PASS
- TypeScript semantic checks: PASS
- Vitest: **412/412 passed, 62/62 test files passed**
- Vite production build: PASS
- Chrome local-preview browser smoke: PASS on **10 routes**, including workcell editing, Undo/Redo, a deterministic scan, starter/pneumatic/electrical workflows and 390px mobile checks across six routes. No uncaught browser page exceptions.
- GitHub CI workflow itself: SUCCESS (not merely present).
- Vercel preview deployment must be confirmed READY separately from the successful GitHub build.
- Tests cover educational models, not industrial safety or vendor PLC parity.

## Honest product readiness
- **Development increment:** implemented and verified in the GitHub test runner.
- **Hosted working demo:** proceed with controlled educational evaluation after production deployment verification.
- **Complete industrial platform / formal acceptance:** **NO-GO / INCOMPLETE.**

Outstanding obligations include calibrated multi-physics and generalized electrical netlist simulation; broader IEC 61131-3 / vendor-compatible semantics; industrial 3D asset authoring, realistic scene interactions, connections and collision/process modeling beyond idealized grid placements; representative machinery breadth; cross-browser and low-spec Windows 8GB performance; accessibility and security audits; dependency/asset licensing review; expert industrial reference comparison; and student/instructor pilots. Full physical equipment behavior must not be inferred from this workcell composer.

Frontend-only scope retained: no backend, authentication, database, SaaS or employer management was added. No commercial launch acceptance, hardware equivalence or formal certification is claimed.
