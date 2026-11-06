# PLC Skills Lab — Motor starter and protection diagnostics increment

## Delivered
A deterministic educational F1 fuse / OL1 overload / K1 contactor subsystem, with coil-open, auxiliary-stuck-open, and welded-contactor fault injection. The integrated workcell now determines motor power from the starter model, publishes K1Feedback, and displays terminal voltages and diagnostic messages in the engineering workbench. Fault changes are rejected unless simulated supply is isolated and the motor is stopped. Eight new Vitest test cases were added.

## Safety and realism limits
The circuit is discrete 24V educational logic, not a SPICE solver or a validated electrical protection model. A simulated welded contactor can energize the motor despite the PLC command being off, intentionally illustrating a dangerous failure mode. It is not a safe-stop implementation. No real-world wiring, fuse sizing, contactor ratings, protective coordination or safety certifications are implied. No backend or third-party source was introduced.

## Verification
Isolated strict TypeScript semantic check of core modules passed. Full Vite build, Vitest suite and browser testing are pending dependency availability. No GitHub changes.
