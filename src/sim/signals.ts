import type { LadderDocument, LadderMemory, LadderStep } from '../engineering/ladder';
import type { STProgram, STValue } from '../engineering/structured-text';
import type { ComponentKind } from '../components/registry';
import type { ScanTrace, TagBreakpoint } from '../program/scan-trace';
import type { SortingPlant, ParcelKind } from '../plant/sorting-conveyor';
import type { TankProcess } from '../plant/tank-process';
import type { MeterReading } from '../electrical/panel-meter';

export type XY = { x: number; y: number };
export type PlacedComponent = XY & { id: string; kind: ComponentKind; pressed: boolean };
export type Wire = { id: string; from: string; to: string };
export type ProjectFile = {
  formatVersion: 1;
  components: PlacedComponent[];
  wires: Wire[];
  program: LadderDocument;
  /** Optional in v1 JSON for backwards compatibility. Defaults to ladder. */
  language?: 'ladder' | 'st';
  stSource?: string;
};
export type WorldState = {
  project: ProjectFile;
  running: boolean;
  tick: number;
  coils: Record<string, boolean>;
  ladderMemory: LadderMemory;
  /** Bounded typed numeric registers retained between simulated PLC scans. */
  ladderNumeric: Record<string, number>;
  /** Validated AST cached in authoritative worker state, never persisted in ProjectFile. */
  stCompiled: STProgram | null;
  stMemory: Record<string, STValue>;
  tagValues: Record<string, STValue>;
  ladderSteps: LadderStep[];
  breakpointScan: number | null;
  breakpointHit: string | null;
  breakpointTag: TagBreakpoint | null;
  scanTrace: ScanTrace[];
  contactorOn: boolean;
  motorOn: boolean;
  motorAngleRad: number;
  plant: SortingPlant;
  conveyorOn: boolean;
  diverterOn: boolean;
  tank: TankProcess;
  pumpOn: boolean;
  drainOn: boolean;
  breakerTripped: boolean;
  overloadTripped: boolean;
  lampOn: boolean;
  meter: MeterReading;
  powered: boolean;
  inputs: { Start: boolean; StopOK: boolean; Photoeye: boolean; TankHigh: boolean };
  voltages: Record<string, number | null>;
  diagnostics: string[];
  lastError: string | null;
};
export type Command =
  | { k: 'place'; id: string; kind: ComponentKind; at: XY }
  | { k: 'move'; id: string; to: XY }
  | { k: 'wire'; id: string; from: string; to: string }
  | { k: 'unwire'; id: string }
  | { k: 'operate'; id: string; pressed: boolean }
  | { k: 'feedParcel'; kind: ParcelKind }
  | { k: 'operateProtection'; id: string; action: 'trip' | 'reset' }
  | { k: 'setMeterProbe'; lead: 'positive' | 'negative'; terminal: string | null }
  | { k: 'loadProgram'; program: LadderDocument }
  | { k: 'loadST'; source: string }
  | { k: 'activateLanguage'; language: 'ladder' | 'st' }
  | { k: 'breakAtScan'; scan: number | null }
  | { k: 'breakOnTag'; breakpoint: TagBreakpoint | null }
  | { k: 'loadProject'; project: unknown }
  | { k: 'run' | 'pause' | 'step' | 'reset' | 'clear' };
export type SimEvent = { tick: number; kind: string; detail: string };
export type RenderSnapshot = {
  tick: number;
  running: boolean;
  components: PlacedComponent[];
  wires: Wire[];
  io: { Start: boolean; StopOK: boolean; Photoeye: boolean; TankHigh: boolean;
    Run: boolean; Sort: boolean; Fill: boolean; Drain: boolean;
    'Q0.0': boolean; 'Q0.1': boolean; 'Q0.2': boolean; 'Q0.3': boolean; PlcPowered: boolean };
  voltages: Record<string, number | null>;
  contactorOn: boolean;
  motorOn: boolean;
  motorAngleRad: number;
  plant: SortingPlant;
  conveyorOn: boolean;
  diverterOn: boolean;
  tank: TankProcess;
  pumpOn: boolean;
  drainOn: boolean;
  breakerTripped: boolean;
  overloadTripped: boolean;
  lampOn: boolean;
  meter: MeterReading;
  diagnostics: string[];
  lastError: string | null;
  language: 'ladder' | 'st';
  tagValues: Record<string, STValue>;
  ladderSteps: LadderStep[];
  ladderMemory: LadderMemory;
  breakpointScan: number | null;
  breakpointHit: string | null;
  breakpointTag: TagBreakpoint | null;
  scanTrace: ScanTrace[];
};
export type WorkerRequest = { kind: 'commands'; commands: Command[] };
export type WorkerResponse = { kind: 'snapshot'; snapshot: RenderSnapshot; events: SimEvent[]; project?: ProjectFile };
