# P8 Industrial Simulation Realism — engineering increment (DRAFT)

**Status:** Development started 2026-11-11; P8 is NOT complete or accepted. Do not merge/deploy.
**Baseline:** P7 PR #47 verified commit `adb7cd53a3ba8e85d576d4968874924b03822110`.
**Branch:** `engineering/p8-industrial-simulation-realism-2026-11-11`.
**Architecture:** original 3D-first browser training simulator, fixed deterministic 50 ms PLC scan / five 10 ms plant steps, authored equipment and the same worker-owned physics/sensors. Offline-capable, no backend/cloud/auth/payments.

## Implemented software slice: opt-in static line-of-sight occlusion

A new worker-owned `occlusionMode=1` option for directional photoeye, inductive and capacitive proximity sensor families checks if a placed body centre is hidden by an explicitly modelled **opaque storage shelf or process vessel** between sensor and target. The mathematical test intersects a three-dimensional line segment with the obstacle's yaw-oriented footprint and vertical extent. Obstacles are supplied by the authoritative worker scene registry, not copied from Three.js decoration. The view remains read-only. The default `occlusionMode=0` and historic `beamMode=0` keep their existing behavior. This is an educational model of static line-of-sight visibility only; no claim of physical optics equivalence, calibrated diffuse retroreflection, all-object occlusion, transparent materials or safety-rated presence detection.

Focused automated tests: `tests/p8-optical-occlusion.test.ts`; must pass with all existing P7 and earlier 3D/PLC regressions.

## Full P8 work still open

- Broader body-to-body/3D solids contact and continuous-angle mechanics, realistic machine/material transfers and deadlocks.
- Body silhouette/beam volume or ray bundle, moving occluders, reflective and refractive surfaces, calibrated sensing/false triggers, explicit sensor fault phenomenology.
- First-person avatar mechanics and sensor interaction, accessible editing ergonomics, hierarchy/prefab deep edit and richer original 3D machine art.
- An integrated 3D browser E2E confirming occlusion affects a genuinely programmed/wired PLC signal as well as source-level deterministic unit tests.
- Full Linux CI, Windows native Edge, accessibility, Firefox/WebKit and no-WebGL fallback for the **exact new head**.
- Owner device testing on actual 8 GB Windows hardware, and real PLC/safety/legal/UX acceptance: deferred and **not proved by hosted-runner checks**.

## Exit contract

P8 full completion requires an agreed bounded acceptance matrix for its realism scope, implemented/tested worker behavior, browser commissioning E2E, no legacy regressions, exact-head Linux+Windows CI, and explicit tracking of physical-device and release signoffs. A green unit-test-only source slice does not close P8. Do not merge into `main` or deploy without owner authorization.
