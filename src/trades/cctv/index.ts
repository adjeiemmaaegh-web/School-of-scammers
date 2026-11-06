import type { TradeModule } from '../../platform/types';
import { cameraCoverage } from './exercises/camera-coverage';
import { cableTermination } from './exercises/cable-termination';
import { ipAddressing } from './exercises/ip-addressing';
import { poeBudget } from './exercises/poe-budget';
import { cameraOffline } from './exercises/camera-offline';
import { nightIr } from './exercises/night-ir';
import { storageRetention } from './exercises/storage-retention';
import { siteCoverage } from './exercises/site-coverage';
import { bandwidthProfiles } from './exercises/bandwidth-profiles';
import { systemHandover } from './exercises/system-handover';

/**
 * CCTV installation — the second trade. Full 1–10 ladder, all playable.
 */
export const cctvModule: TradeModule = {
  meta: {
    id: 'cctv',
    name: 'CCTV install',
    blurb: 'Plan coverage, run and terminate cable, address IP cameras, budget PoE and commission an NVR system.',
    status: 'available',
  },
  exercises: [
    cameraCoverage, // 1
    cableTermination, // 2
    ipAddressing, // 3
    poeBudget, // 4
    cameraOffline, // 5
    nightIr, // 6
    storageRetention, // 7
    siteCoverage, // 8
    bandwidthProfiles, // 9
    systemHandover, // 10
  ],
};
