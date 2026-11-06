# PLC Skills Lab — Virtual terminal strip and voltmeter

This increment adds a selectable 24 V sensor output connection to PLC input terminals I0.0–I0.4, an open-return fault, an incorrect M0 connection diagnostic, and a two-probe virtual DC voltmeter. The existing SensorOK ladder tag now samples the physical model's I0.2 terminal, rather than assuming the sensor automatically appears at the correct PLC address. Rewiring requires simulated power isolation and a stopped motor. Existing legacy sensor-cable control remains for compatibility.

## Scope and limitations

This is a bounded discrete educational model, not a SPICE circuit solver, vendor PLC hardware emulator, electrical safety simulator, or physically validated multimeter. A wire to the wrong input does not remap the ladder tag; it produces the wrong observed input. Short-circuit conditions are diagnostic only and do not model current, protective device tripping, or thermal damage. PLC address assignments in symbol metadata remain descriptive; general user-configurable I/O-to-terminal binding is not implemented.

## Verification

The changed core modules passed isolated TypeScript semantic checking. New Vitest regression definitions are included; full React/Vite build and browser tests are not verified. No third-party code or backend work was added.
