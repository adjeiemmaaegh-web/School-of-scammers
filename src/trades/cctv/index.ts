import type { PlannedExercise, TradeModule } from '../../platform/types';
import { cameraCoverage } from './exercises/camera-coverage';
import { cableTermination } from './exercises/cable-termination';
import { ipAddressing } from './exercises/ip-addressing';
import { poeBudget } from './exercises/poe-budget';
import { cameraOffline } from './exercises/camera-offline';

/**
 * CCTV installation — the second trade. A starter ladder (ranks 1–5) proves the
 * multi-trade architecture; ranks 6–10 are designed and authored next.
 */
const planned: PlannedExercise[] = [
  { rank: 6, title: 'Night & IR exposure', summary: 'Configure IR and exposure for a dark scene without wash-out or bloom.', estMinutes: 30 },
  { rank: 7, title: 'Storage & retention sizing', summary: 'Size NVR storage to hit a target retention from camera bitrates.', estMinutes: 35 },
  { rank: 8, title: 'Multi-camera site coverage', summary: 'Lay out cameras across a site with no blind spots and minimal overlap.', estMinutes: 45 },
  { rank: 9, title: 'Bandwidth & stream profiles', summary: 'Tune stream profiles to fit the network link and recording needs.', estMinutes: 45 },
  { rank: 10, title: 'System handover & acceptance', summary: 'Run the CCTV acceptance test, prove coverage and hand the system over.', estMinutes: 55 },
];

export const cctvModule: TradeModule = {
  meta: {
    id: 'cctv',
    name: 'CCTV install',
    blurb: 'Plan coverage, run and terminate cable, address IP cameras, budget PoE and commission an NVR system.',
    status: 'available',
  },
  exercises: [cameraCoverage, cableTermination, ipAddressing, poeBudget, cameraOffline],
  planned,
};
