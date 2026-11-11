# P8 Industrial Simulation Realism — engineering increment (DRAFT)

**Status:** Development started 2026-11-11; P8 is NOT complete or accepted. Do not merge/deploy.
**Baseline:** P7 PR #47 verified commit `adb7cd53a3ba8e85d576d4968874924b03822110`.
**Branch:** `engineering/p8-industrial-simulation-realism-2026-11-11`.
**Architecture:** original 3D-first browser training simulator, fixed deterministic 50 ms PLC scan / five 10 ms plant steps, authored equipment and the same worker-owned physics/sensors. Offline-capable, no backend/cloud/auth/payments.

## Implemented software slice: opt-in static line-of-sight occlusion

A new worker-owned `occlusionMode=1` option for directional photoeye, inductive and capacitive proximity sensor families checks if a placed body centre is hidden by an explicitly modelled **opaque storage shelf or process vessel** between sensor and target. The mathematical test intersects a three-dimensional line segment with the obstacle's yaw-oriented footprint and vertical extent. Obstacles are supplied by the authoritative worker scene registry, not copied from Three.js decoration. The view remains read-only. The default `occlusionMode=0` and historic `beamMode=0` keep their existing behavior. This is an educational model of static line-of-sight visibility only; no claim of physical optics equivalence, calibrated diffuse retroreflection, all-object occlusion, transparent materials or safety-rated presence detection.

Focused automated tests: `tests/p8-optical-occlusion.test.ts`; must pass with all existing P7 and earlier 3D/PLC regressions.

## Implemented software slice: opt-in fixed-solid material-flow contacts

A `blockMaterialFlow=1` setting on the original shelf and process vessel makes their 3D upright solid envelopes an obstacle to **conveyor-carried** parcels. The worker resolves a new contact, stops the material, records a real `jam` event, and exposes conveyor jam telemetry through the existing PLC signal path. World yaw 90/270 rotates equipment footprint, and the material's 3D height is checked. The solids use the same bounded static dimensions as their equipment registry. Already-overlapping historic bodies are not trapped. With the default `blockMaterialFlow=0`, historical scenes behave as before.

This is limited new-contact handling against two explicit fixed equipment kinds. It does **not** claim collision completeness, angular dynamics, moving barrier sweeps, friction, body deformation, or general rigid-body physics.

Focused automated tests: `tests/p8-fixed-solid-collisions.test.ts`.

## Integrated PLC and mandatory browser commissioning

- `tests/p8-worker-plc-integration.test.ts` constructs genuine wired supply, PLC16 Structured Text, powered box feeder, directional photoeye, yaw-rotated opaque rack and lamp. It asserts the real worker-generated body is hidden when opt-in occlusion is active and detected when the compatibility option is off, including actual PLC input/output and lamp telemetry.
- `scripts/sandbox-p8-optical-browser.cjs` is wired into `.github/workflows/ci.yml` immediately after the P7 browser acceptance steps. It imports the same authentic project, checks actual spawned worker bodies and live browser sensor readings for both blocked and unblocked modes, and confirms saved options/wires.
- These checks are P8 software verification only, not external device acceptance.

## Full P8 work still open

- Broader body-to-body/general 3D solids contact and continuous-angle mechanics, realistic machine/material transfers and deadlocks beyond the two new opt-in stationary solids.
- Body silhouette/beam volume or ray bundle, moving occluders, reflective and refractive surfaces, calibrated sensing/false triggers, explicit sensor fault phenomenology.
- First-person avatar mechanics and sensor interaction, accessible editing ergonomics, hierarchy/prefab deep edit and richer original 3D machine art.
- Broader interactive 3D browser commissioning that places/configures these sensors from an empty workspace and measures full user editing, plus dedicated static-solid jam browser acceptance.
- Full Linux CI, Windows native Edge, accessibility, Firefox/WebKit and no-WebGL fallback for the **exact new head**.
- Owner device testing on actual 8 GB Windows hardware, and real PLC/safety/legal/UX acceptance: deferred and **not proved by hosted-runner checks**.

## Exit contract

P8 full completion requires an agreed bounded acceptance matrix for its realism scope, implemented/tested worker behavior, browser commissioning E2E, no legacy regressions, exact-head Linux+Windows CI, and explicit tracking of physical-device and release signoffs. A green unit-test-only source slice does not close P8. Do not merge into `main` or deploy without owner authorization.
