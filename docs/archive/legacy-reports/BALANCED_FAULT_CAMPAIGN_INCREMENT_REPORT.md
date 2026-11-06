# PLC Skills Lab — balanced fault campaign coverage

## Change
- Reordered bounded automated fault campaigns to cycle through every selected input tag before repeating a tag, then cycle across fault modes and time windows.
- Added explicit evaluated-input, omitted-input, and evaluated-mode metadata to the result, CSV export, and Instruction Lab summary. A capped campaign still reports only actually evaluated cases; no omitted scenario is counted as safe or unchanged.
- Added five Vitest regression definitions for tag coverage, truncation, mode spread, CSV metadata, and untruncated behavior.

## Verification
- Engineering module TypeScript no-emit compilation passed.
- Eight native Node runtime assertions passed.
- Full React/Vite build, Vitest suite, browser and physical PLC/hardware tests not run; dependencies are absent in the environment.
- No backend, cloud, deployment, or GitHub change.
