# University demonstrations (A–F)

Six complete factories, each an ordinary editable project (placed equipment, real 24V wiring, device settings and a Structured
Text program). They are built by `src/plant/demos/*`, listed in the sandbox under **Plant Library → Demonstrations**, and run on
the same worker, wiring solver and plant physics as any learner project. None of them is an animation. Educational simulation
only: not a safety function, not rated, not a real PLC.

| | Demonstration | What it shows | Evidence |
|---|---|---|---|
| A | Automated sorting factory | Mixed metal/carton flow, inductive sensing, PLC-commanded powered transfer unit, side belt, material-specific bins; sensor faults change routing | `tests/demo-sorting-factory.test.ts` |
| B | Machining and assembly cell | Stopper-indexed machining station (raw→machined), assembly station consuming a lid (→assembled), per-part trace, tool-broken fault, worn-tool defects | `tests/demo-machining-assembly.test.ts` |
| C | Pneumatic production cell | Compressor + receiver + regulator + cylinder cycled by a PLC through solenoids and limit switches; leak, low pressure, restrictor, overload | `tests/demo-pneumatic-cell.test.ts` |
| D | Multi-PLC manufacturing factory | Two PLCs, two cells, a belt between them and a 24V handshake wire; downstream stall backs the upstream cell up | `tests/demo-multi-plc-factory.test.ts` |
| E | Industrial process control | Level hysteresis, heater thermostat with agitator, analog inputs, operator drain button, indicator panel with alarms and horn; leak, blocked inlet, open heating element | `tests/demo-process-control.test.ts` |
| F | Human interaction and troubleshooting | Fence, interlocked door, restricted zone, a walking operator physically stopped by the closed door, line stop/restart sequence, welded interlock plus dead zone sensor leaves the line running with a person inside | `tests/demo-human-interaction.test.ts` |

`tests/demo-catalogue.test.ts` validates, reloads (as plain JSON) and powers every demonstration;
`scripts/sandbox-demos-browser.cjs` loads and runs all six in real Chrome (CI).

## Honest limits

- Parts must be held by a stopper to be worked on (no built-in fixtures or robots in demo B).
- The PLC has no analog output, so a program cannot drive a numeric display; displays are driven by digital commands or analog wiring from a powered source.
- The heater and the vessel in demo E are separate first-order models (not thermally coupled), and there is no pipe network, pump curve or hydraulic pressure (R11 stays PARTIAL).
- Demonstration F's person is a single training actor with box-style 3D art; it is not a safety validation tool.
