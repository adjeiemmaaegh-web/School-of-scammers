import type { TradeModule } from '../../platform/types';
import { conveyorStart } from './exercises/conveyor-start';
import { motorSealin } from './exercises/motor-sealin';
import { sensorWiring } from './exercises/sensor-wiring';
import { timedRunon } from './exercises/timed-runon';
import { batchCount } from './exercises/batch-count';
import { starterDiagnosis } from './exercises/starter-diagnosis';
import { starDelta } from './exercises/star-delta';
import { tankLevel } from './exercises/tank-level';
import { sorterCommission } from './exercises/sorter-commission';
import { factoryAcceptance } from './exercises/factory-acceptance';

/**
 * PLC & industrial automation — the flagship trade.
 * The full 1..10 ranked ladder is built and playable.
 */
export const plcModule: TradeModule = {
  meta: {
    id: 'plc',
    name: 'PLC & automation',
    blurb: 'Program ladder logic, wire 24V control circuits, diagnose faults and commission machines.',
    status: 'available',
  },
  exercises: [
    conveyorStart, // 1
    motorSealin, // 2
    sensorWiring, // 3
    timedRunon, // 4
    batchCount, // 5
    starterDiagnosis, // 6
    starDelta, // 7
    tankLevel, // 8
    sorterCommission, // 9
    factoryAcceptance, // 10
  ],
};
