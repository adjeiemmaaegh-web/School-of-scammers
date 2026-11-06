import type { PlannedExercise, TradeModule } from '../../platform/types';
import { conveyorStart } from './exercises/conveyor-start';
import { sensorWiring } from './exercises/sensor-wiring';

/**
 * PLC & industrial automation — the flagship trade.
 * Rank 1 is built and playable; ranks 2..10 are designed and authored
 * incrementally (see docs/product/PRD.md Phase 2).
 */
const planned: PlannedExercise[] = [
  { rank: 2, title: 'Motor seal-in & stop interlock', summary: 'Build a latching start/stop rung with a seal-in contact and a stop permissive.', estMinutes: 25 },
  { rank: 4, title: 'Timed conveyor run-on', summary: 'Add an on-delay timer so the belt runs on after the part clears the photoeye.', estMinutes: 30 },
  { rank: 5, title: 'Part counting & batch stop', summary: 'Count parts with a CTU and stop the line when a batch target is reached.', estMinutes: 35 },
  { rank: 6, title: 'Motor starter fault diagnosis', summary: 'Diagnose fuse, overload and contactor faults from I/O and feedback evidence.', estMinutes: 40 },
  { rank: 7, title: 'Star–delta start sequencing', summary: 'Commission a three-contactor starter with dead-time and anti-overlap interlocks.', estMinutes: 45 },
  { rank: 8, title: 'Tank level & pump permissive', summary: 'Control a pump from level inputs with high-level trip and a documented permissive.', estMinutes: 50 },
  { rank: 9, title: 'Sorter commissioning', summary: 'Commission product sensing, belt motion and diverter timing against a sequence.', estMinutes: 55 },
  { rank: 10, title: 'Factory acceptance test', summary: 'Run scripted acceptance procedures with fault injection and export the evidence.', estMinutes: 60 },
];

export const plcModule: TradeModule = {
  meta: {
    id: 'plc',
    name: 'PLC & automation',
    blurb: 'Program ladder logic, wire 24V control circuits, diagnose faults and commission machines.',
    status: 'available',
  },
  exercises: [conveyorStart, sensorWiring],
  planned,
};
