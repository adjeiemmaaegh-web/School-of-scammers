# PLC Skills Lab — Conveyor physics refinement

## Implemented
- Deterministic product entry clearance and longitudinal separation on the main conveyor.
- Diverter travel takes 300 ms simulated time; 3D rotation follows actual actuator progress.
- Additional isolated fault injection: product jam stops belt feedback and movement.
- Explicit sensor lag teaching fault (latched photoeye reading while fault active).
- Existing PLC, wiring, and rendering integration preserved.

## Verification
Isolated strict TypeScript compilation passed. Four focused Node assertions passed for entry occupancy, deterministic replay, jam response, and actuator travel. Full React/Vite build, Vitest, and browser tests not executed.

## Limitations
This is a discrete kinematic teaching model, not rigid-body collision physics. Product-to-product clearance is one-dimensional; no mass, friction, acceleration, collision impulses, actuator force, or validated industrial sensor timing. The sensor-lag fault intentionally freezes the signal and is not a general delay model. No third-party code copied, no backend added, no GitHub changes.
