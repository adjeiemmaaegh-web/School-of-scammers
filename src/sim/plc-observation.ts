/**
 * Stage 2 / R3.4: one read-only projection for every placed PLC.
 *
 * The classic first controller still executes through the historical
 * WorldState fields for v1 compatibility; PLC16 and all additional PLCs
 * execute through per-ID runtimes. This adapter gathers both into the
 * *same* PlcView map and preserves the prior snapshot field order and
 * per-controller I/O semantics. It never scans, controls or mutates a PLC.
 */
import { sampleAnalogInputs } from './analog';
import { faultsOf } from './faults';
import { ioOf, LEGACY_IO } from './plc-io';
import { legacyPrimaryId, plcComponents, plcView, programOf } from './plcs';
import type { PlcView, WorldState } from './signals';

export function plcObservationImage(world: WorldState): Record<string, PlcView> {
  const legacyId = legacyPrimaryId(world.project);
  const openWireIds = new Set(faultsOf(world.project).filter(f => f.kind === 'wire-open').map(f => f.target));
  return Object.fromEntries(plcComponents(world.project).map(c => {
    const lang = programOf(world.project, c.id).language;
    const idle: Record<string, boolean> = {};
    const rt = world.plcs[c.id];
    const io = ioOf(world.project, c);
    // This is only a display image: while paused the physical connection
    // is inspected, while running the image comes from the preceding PLC scan.
    const analogPoints = io.analogInputs && !world.running
      ? sampleAnalogInputs(world.project, world.vessels, c.id, io, rt?.powered ?? false,
        openWireIds, world.plantWorld, id => {
          const positive = world.voltages[id + '.L+'];
          const negative = world.voltages[id + '.M'];
          return typeof positive === 'number' && typeof negative === 'number' &&
            Math.abs(positive - negative - 24) < 0.001;
        }).points
      : rt?.analogInputs ?? [];
    return [c.id, c.id === legacyId
      ? plcView(c.kind, lang, world.powered, LEGACY_IO, world.inputs, world.coils,
        { tagValues: world.tagValues, ladderSteps: world.ladderSteps, ladderMemory: world.ladderMemory,
          fbdSteps: world.fbdSteps }, [], world.debugForces[c.id] ?? {})
      : plcView(c.kind, lang, rt?.powered ?? false, io, rt?.tagInputs ?? idle, rt?.coils ?? {},
        { tagValues: rt?.tagValues ?? {}, ladderSteps: rt?.ladderSteps ?? [], ladderMemory: rt?.ladderMemory ?? {},
          fbdSteps: rt?.fbdSteps ?? [] }, analogPoints, world.debugForces[c.id] ?? {})];
  }));
}
