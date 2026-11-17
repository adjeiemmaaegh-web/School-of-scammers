# PLC Skills Lab — Accessibility, Browser Coverage & Low-Resource Engineering Increment
Date: 2026-11-03
Repository: https://github.com/adjeiemmaaegh-web/School-of-scammers
Review PR: https://github.com/adjeiemmaaegh-web/School-of-scammers/pull/3
Verified CI run: https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/41628054318
Verified source commit: 07ab50ab455291e4f2fe61180e1cc40347a49bb7

## Engineering changes
- Changed the 169-cell factory floor plan from invalid ARIA grid semantics to a labelled group of native keyboard-focusable buttons.
- Corrected descriptive roles for the conveyor positions graphic and ladder power-flow region.
- Made the horizontally scrollable star–delta commissioning table keyboard-focusable and descriptively labelled.
- Added a first-tab "Skip to main content" link, focusable main landmark, route focus update, page title update and visual focus indicators.
- Added reduced-motion behavior and marked decorative navigation icons as hidden from assistive technologies.
- Added a headless axe-core high-severity WCAG 2/2.1 A/AA audit across 16 routes (automated coverage only).
- Added CPU-throttled / no-WebGL browser acceptance to verify that the factory grid and virtual scan controls remain operational without rendering 3D.
- Added reproducible gzip bundle budgets to CI.
- Added Linux WebKit browser smoke alongside the existing Chrome and Firefox suites.

## Evidence from GitHub Actions run 41628054318 (PR commit)
- Offline engineering checks: PASS.
- Semantic TypeScript: PASS.
- Vitest: **435/435 passed**, **63/63 test files passed**.
- Vite production build: PASS.
- Chrome E2E: PASS, 11 routes, machine/electrical/assessment interactions and 390px mobile checks.
- axe-core: PASS on 16 routes with **0 detected serious or critical** and 0 moderate findings for the selected WCAG tags at initial page state.
- Keyboard skip-navigation: PASS.
- CPU fallback: PASS with simulated 4x CPU throttling, disabled WebGL, dynamic 3D loading on landing page, factory equipment editing and deterministic PLC scan.
- Firefox E2E: PASS, 11 routes, DC circuit/workcell interactions and 390px mobile checks.
- Linux WebKit E2E: PASS, 11 routes, DC circuit/workcell interactions and 390px mobile checks.

### Deterministic compressed transfer-size evidence
| Metric | Measured gzip bytes | Enforced limit bytes |
|---|---:|---:|
| Landing JS entry | 66,167 | 122,880 |
| Optional large 3D chunk | 224,608 | 291,840 |
| All JavaScript chunks | 441,355 | 808,960 |
| All CSS assets | 8,351 | 112,640 |

These are compressed file-size proxies, **not** load-time, FPS or hardware performance benchmarks. No 8 GB Windows computer was tested in CI.

## Open release acceptance
- Linux WebKit is not a genuine Safari test on macOS/iOS.
- Axe rule scans do not prove WCAG compliance. Manual screen-reader (NVDA/VoiceOver), keyboard in all interactive states, zoom, contrast and touch targets remain to be audited.
- No verified Microsoft Edge on Windows 11, macOS Safari, Android or iOS browser acceptance.
- No real 8 GB CPU-only PC FPS, RAM/VRAM, 3D interaction or battery/power benchmark.
- Educational simulated controls, no industrial hardware functional parity or certified safety claims.
- Broader vendor-accurate IEC programming, industrial electrical/physics behavior and expert reference review remain incomplete.
- Dependency provenance, accessibility sign-off and third-party asset/license review remain separate release workstreams.
- No backend, login, employer accounts or database have been added.

## Decision
- **Development increment:** verified by GitHub CI.
- **Browser-hosted educational demo:** continue controlled evaluation.
- **Complete production-grade industrial training platform:** **NO-GO / INCOMPLETE**.
