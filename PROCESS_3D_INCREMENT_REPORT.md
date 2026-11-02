# PLC Skills Lab — 3D conveyor integration

The engineering workbench now renders the deterministic conveyor process through a React Three Fiber scene. Product positions in millimetres are mapped to scene metres. Product classification, lane, photoeye, exit sensor, diverter and belt feedback come from the workcell snapshot. Orbit controls allow inspection. No separate rendering clock or physics state is introduced.

Three Vitest regression tests were added but not executed. Full application TypeScript compilation was attempted and blocked by missing `vite/client` type definitions. This is procedural geometry, not high-fidelity industrial equipment. Sensor and diverter behavior remains simplified. No backend work or copied third-party source.
