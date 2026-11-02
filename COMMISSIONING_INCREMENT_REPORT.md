# Consolidated commissioning exercise increment

Added an integrated six-step work order in the existing engineering workbench. Learners isolate the supply, wire the sensor, verify a real motor start, process a product, safely stop, and review immutable evidence captured from actual workcell snapshots. The capture control never advances the simulation or sets outputs. Progress cannot be manually marked complete. Restart resets both the workcell and the work order. Fault observations use current simulation state.

Scope: frontend/local simulation only; no backend, auth, database, cloud or external deployment. The existing 3D scene and ladder editor remain in place. This is an educational commissioning sequence, not a certified procedure. Test execution and browser acceptance are reported separately.
