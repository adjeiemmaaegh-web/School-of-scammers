# Wiring-to-PLC integration
The configurable 24V board now supplies SensorOK through terminal I0.2 when board mode is enabled. The PLC scan samples the board circuit before executing ladder. Supply control is shared with the workcell; edits reset its scan history. The legacy sensor wiring remains available when board mode is disabled.

Demonstration: isolate power, connect PS.P to I0.IN and PS.M to I0.COM, restore power and scan. SensorOK becomes true. Disconnect a wire while isolated and rescan to observe SensorOK false.

Limitations: idealized discrete 24V graph, not real current, resistance, transients, PLC hardware or safety behavior. Full browser build not verified because dependencies are unavailable. No third-party code or backend changes.
