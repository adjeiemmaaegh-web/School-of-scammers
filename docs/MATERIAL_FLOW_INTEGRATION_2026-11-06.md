# Material-flow and geometric sensor teaching simulation — 6 November 2026

## What actually changes
- A tracked object is injected at an unoccupied infeed on a particular conveyor; it receives a stable part ID, type (carton/metal), normalized progress, and a bounded event record.
- The scan clock—not rendering frame rate—advances objects on conveyor drive commands. With the PLC/guard/E-stop run permit false, the parcel remains stationary.
- At the beginning of each PLC scan, the previous material snapshot is used to sample physical sensor positions. Photoeyes see both material kinds; inductive sensors see only the metal training material. An automatically sampled sensor cannot be manually toggled in the workcell UI while that mode is enabled.
- Author-created ladder outputs are committed to equipment after sampling, then actual simulated actuator state and material position advance. The one-scan sampling delay is deliberate and testable.
- The supplied parcel-sorter uses a virtual operator run switch to start the belt, a position-derived optical sensor to command a reject pusher and an indicator, and a bounded idealized pusher encounter. A successful encounter records a diverted object; absent diversion, material exiting the end is counted as completed.
- The 3D scene renders each parcel at its actual simulated world position (accounting for conveyor rotation). Visible text status, material event log, sensor truth flags, counters, and infeed/clear controls remain accessible when WebGL is not available.
- Existing scene JSON, ladder import and manual field-input lessons remain unchanged by default; material mode is explicit opt-in and uses its own resettable ephemeral state.

## Model constraints
The conveyor uses a fixed 2.5-second normalized 2.25-unit transport model. Sensor distances are idealized (1.12 grid units), pusher diversion is an encounter rule based on virtual extension and proximity, and infeed spacing/capacity are bounded (16 parts; last 48 events). This does **not** model mass, collisions, friction, inertia, actual induction physics, acceleration, pneumatic forces or emergency-stop safety certification.

The material state and event list are session-ephemeral; they are not a signed audit trail, permanent manufacturing record, or production-quality OEE accounting. Export the scene and engineering project separately; those exports do not preserve the live material state.

## Verification and remaining gates
Source tests cover geometry sampling, sensor discrimination, injection limits, deterministic replay, timed movement, reject diversion, completion without a pusher, guard/E-stop inhibit and opt-in compatibility. Chrome UI acceptance exercises injected parcel -> PLC sensor -> reject -> evidence and reset. All normal Linux and native Windows/Edge release checks must pass before merge.

Still open: real PLC/camera/device comparisons, collision/continuous conveyor physics, robotic kinematics, safety-rated interlocks, 8 GB physical Windows benchmark, Safari/mobile physical checks, instructor learner trials, security and license signoff. The full industrial release stays NO-GO; the software remains an educational beta.
