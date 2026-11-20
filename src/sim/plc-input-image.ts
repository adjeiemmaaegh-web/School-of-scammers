/**
 * Stage 2 / R3.4 — one terminal-level digital input sampler for all PLCs.
 *
 * The worker-owned, settled 24 V netlist is the authority. This adapter
 * translates each controller's I/O map into Boolean program tags; it does
 * not scan the program or synthesize plant sensor states. The classic first
 * PLC has the fixed LEGACY_IO map, while configurable PLCs supply their
 * independently owned maps.
 */
import type { PlcIoMap } from './plc-io';

type Differential24V = {
  reads24: (terminal: string, reference: string) => boolean;
};
export type PoweredSensorImage = Readonly<{
  photoeye: boolean;
  levelprobe: boolean;
}>;

/**
 * Sample only the requested controller's wired input terminals against ITS
 * OWN M return. The historic Photoeye/TankHigh guard also requires a
 * powered physical sensor of that kind, regardless of which PLC is reading.
 * Output follows the I/O map insertion order, as prior scans did.
 */
export function samplePlcDigitalInputs(
  plcId: string,
  io: PlcIoMap,
  powered: boolean,
  circuit: Differential24V,
  sensors: PoweredSensorImage,
): Record<string, boolean> {
  return Object.fromEntries(Object.entries(io.inputs).map(([pin, tag]) => [
    tag,
    powered &&
      (tag !== 'Photoeye' || sensors.photoeye) &&
      (tag !== 'TankHigh' || sensors.levelprobe) &&
      circuit.reads24(plcId + '.' + pin, plcId + '.M'),
  ]));
}
