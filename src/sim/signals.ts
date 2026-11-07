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
/** Component/wire failures that alter what the circuit solver sees (P5). */
export type FaultKind = 'wire-open' | 'contactor-coil-open' | 'contactor-welded' | 'motor-open-winding' | 'button-stuck';
export type FaultSpec = {
  id: string;
  kind: FaultKind;
  /** Component id, or wire id for 'wire-open'. */
  target: string;
  /** 'button-stuck' only: the mechanism is stuck as if pressed (true) or as if released (false). */
  stuckPressed?: boolean;
  /** Hidden faults are not described in learner-facing lists or events until revealed. This is a
   *  UX convention for local practice, not security: exported project JSON still contains them. */
  hidden: boolean;
};
export type AlarmCode = 'START_FAILURE' | 'UNCOMMANDED_RUN';
/** Supervisory alarm: states a symptom only and never names a hidden cause. */
export type AlarmRecord = {
  id: number;
  code: AlarmCode;
  severity: 'warning' | 'fault';
  message: string;
  raisedAtScan: number;
  clearedAtScan: number | null;
};
export type AlarmWatch = { noResponse: number; uncommanded: number; nextId: number };
export type ProjectFile = {
  formatVersion: 1;
  components: PlacedComponent[];
  wires: Wire[];
  program: LadderDocument;
  /** Optional in v1 JSON for backwards compatibility. Defaults to ladder. */
  language?: 'ladder' | 'st';
  stSource?: string;
  /** Optional in v1 JSON for backwards compatibility. Defaults to no faults. */
  faults?: FaultSpec[];
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
  forwardContactorOn: boolean;
  reverseContactorOn: boolean;
  motorDirection: 'stopped' | 'forward' | 'reverse';
  reverseMotorAngleRad: number;
  interlockConflict: boolean;
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
  inputs: { Start: boolean; StopOK: boolean; Photoeye: boolean; TankHigh: boolean; ReverseRequest: boolean };
  voltages: Record<string, number | null>;
  diagnostics: string[];
  lastError: string | null;
  /** Bounded supervisory alarm history (P5). Reset with the world. */
  alarms: AlarmRecord[];
  alarmWatch: AlarmWatch;
};
export type Command =
  | { k: 'place'; id: string; kind: ComponentKind; at: XY }
  | { k: 'move'; id: string; to: XY }
  | { k: 'wire'; id: string; from: string; to: string }
  | { k: 'unwire'; id: string }
  | { k: 'operate'; id: string; pressed: boolean }
  /** Flip a pushbutton/E-stop using the worker's authoritative state. UIs must use this
   *  rather than `operate` with `!pressed` from a snapshot, which is stale between scans. */
  | { k: 'operateToggle'; id: string }
  /** The worker assigns the fault id. Allowed any time: faults can occur while running. */
  | { k: 'injectFault'; kind: FaultKind; target: string; stuckPressed?: boolean; hidden: boolean }
  /** Deterministically picks one applicable fault from the current project using `seed`. */
  | { k: 'injectSeededFault'; seed: number; hidden: boolean }
  | { k: 'clearFault'; id: string }
  | { k: 'revealFault'; id: string }
  /** Replace a component or re-terminate a wire. Needs the simulation paused (isolated). */
  | { k: 'repair'; target: string }
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
  io: { Start: boolean; StopOK: boolean; Photoeye: boolean; TankHigh: boolean; ReverseRequest: boolean;
    Run: boolean; Sort: boolean; Fill: boolean; Drain: boolean; Forward: boolean; Reverse: boolean;
    'Q0.0': boolean; 'Q0.1': boolean; 'Q0.2': boolean; 'Q0.3': boolean; 'Q0.4': boolean; 'Q0.5': boolean; PlcPowered: boolean };
  voltages: Record<string, number | null>;
  contactorOn: boolean;
  motorOn: boolean;
  motorAngleRad: number;
  forwardContactorOn: boolean;
  reverseContactorOn: boolean;
  motorDirection: 'stopped' | 'forward' | 'reverse';
  reverseMotorAngleRad: number;
  interlockConflict: boolean;
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
  alarms: AlarmRecord[];
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
