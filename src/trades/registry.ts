/**
 * Trade registry — the one place that knows which trades and exercises exist.
 * Adding a trade is adding a module here (PRD: "trades are pluggable").
 */
import type {
  ExerciseDefinition,
  LadderRung,
  Rank,
  TradeId,
  TradeMeta,
  TradeModule,
} from '../platform/types';
import { plcModule } from './plc';
import { cctvModule } from './cctv';

/** Every trade shown in the picker — available first, then coming-soon. */
const COMING_SOON: TradeMeta[] = [
  { id: 'bms', name: 'BMS controls', blurb: 'Building management: controllers, sensors, actuators and control strategies.', status: 'coming-soon' },
  { id: 'phone-pc', name: 'Phone & PC repair', blurb: 'Diagnose and repair hardware and software faults on phones and computers.', status: 'coming-soon' },
  { id: 'electronics', name: 'Electronics', blurb: 'Build, measure and fault-find analog and digital electronic circuits.', status: 'coming-soon' },
];

const MODULES: Record<string, TradeModule> = {
  [plcModule.meta.id]: plcModule,
  [cctvModule.meta.id]: cctvModule,
};

export function allTrades(): TradeMeta[] {
  const available = Object.values(MODULES).map((m) => m.meta);
  return [...available, ...COMING_SOON];
}

/** Route parameters are untrusted: '__proto__' and 'constructor' are NOT
 * trade modules, even though they resolve on Object.prototype. */
export function getTrade(id: TradeId | string): TradeModule | undefined {
  return Object.hasOwn(MODULES,id) ? MODULES[id] : undefined;
}

export function getExercise(exerciseId: string): ExerciseDefinition | undefined {
  for (const mod of Object.values(MODULES)) {
    const found = mod.exercises.find((e) => e.id === exerciseId);
    if (found) return found;
  }
  return undefined;
}

/** Build the unified 1..10 ladder for a trade (playable + planned rungs). */
export function getLadder(id: TradeId | string): LadderRung[] {
  const mod = getTrade(id);
  if (!mod) return [];
  const rungs: LadderRung[] = [];
  for (let r = 1 as number; r <= 10; r++) {
    const rank = r as Rank;
    const def = mod.exercises.find((e) => e.rank === rank);
    if (def) {
      rungs.push({ rank, title: def.title, summary: def.summary, estMinutes: def.estMinutes, def, status: 'playable' });
      continue;
    }
    const plan = mod.planned?.find((p) => p.rank === rank);
    if (plan) {
      rungs.push({ rank, title: plan.title, summary: plan.summary, estMinutes: plan.estMinutes, status: 'planned' });
    }
  }
  return rungs;
}
