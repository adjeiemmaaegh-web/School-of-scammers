# Motor load and PLC output integration

The workcell now requires an energized `MOTOR` load on the configurable wiring board whenever such a load is installed. A `relay-contact` with `controlledBy: 'RunLatch'` can switch the motor supply. The motor's final state requires both the existing starter's safety/fault logic and the energized wiring-board load; a short-circuit diagnostic prevents motor activation. Existing boards without a `MOTOR` component retain the earlier teaching behavior.

This is a bounded educational model: it does not represent current, torque, inrush, protection coordination, or motor acceleration. The board does not yet provide contactor coil physics or detailed 3D animation. Backend remains out of scope. Browser acceptance remains deferred.
