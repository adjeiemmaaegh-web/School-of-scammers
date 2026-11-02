# Conveyor process increment

Added a deterministic, scan-time-driven 4 m conveyor with products, two photoelectric sensor signals, optional reject diverter, belt-slip and sensor faults, motor feedback, counters, and a 2D workbench monitor. Connected process stepping to the integrated PLC workcell. Added six regression tests.

## Boundaries and limitations

The conveyor is a discrete teaching model, not rigid-body physics. Reject diverter uses a `Diverter` ladder output if a learner adds that coil. Photoeye and feedback signals are published after each scan and therefore sampled by ladder on the following scan; this scan-boundary timing must be validated against a defined I/O image model. The existing 3D scene has not been integrated with the new process product positions. Formal browser acceptance remains open. No third-party code or backend added.
