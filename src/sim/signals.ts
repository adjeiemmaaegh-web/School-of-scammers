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
export type FaultKind = 'wire-open' | 'contactor-coil-open' | 'contactor-welded' | 'motor-open-winding' | 'button-stuck' | 'sensor-stuck';
export type FaultSpec = {
  id: string;
  kind: FaultKind;
  /** Component id, or wire id for 'wire-open'. */
  target: string;
  /** 'button-stuck' only: the mechanism is stuck as if pressed (true) or as if released (false). */
  stuckPressed?: boolean;
  /** 'sensor-stuck' only: the electrical output is stuck ON (true) or OFF (false) whatever the
   *  sensor actually detects. The plant's own truth is unaffected, so the sensor lies to the PLC. */
  stuckActive?: boolean;
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
/** The program of one additional PLC. The first PLC's program stays in the legacy top-level fields. */
export type PlcProgram = {
  program: LadderDocument;
  language?: 'ladder' | 'st';
  stSource?: string;
};
/** The five physical input tags a PLC samples (I0.0..I0.4) and its six output coils (Q0.0..Q0.5). */
export type PlcInputs = { Start: boolean; StopOK: boolean; Photoeye: boolean; TankHigh: boolean; ReverseRequest: boolean };
/** Scan state of one additional PLC. The first PLC's scan state lives in the legacy WorldState fields. */
export type PlcRuntime = {
  powered: boolean;
  inputs: PlcInputs;
  /** The sampled input image by tag name, for any I/O map (the classic five-tag `inputs` is derived from it). */
  tagInputs: Record<string, boolean>;
  coils: Record<string, boolean>;
  tagValues: Record<string, STValue>;
  ladderMemory: LadderMemory;
  ladderNumeric: Record<string, number>;
  ladderSteps: LadderStep[];
  stCompiled: STProgram | null;
  stMemory: Record<string, STValue>;
};
/** What the UI may show about any one PLC (first or additional). */
export type PlcIoPoint = { terminal: string; tag: string; on: boolean };
export type PlcView = {
  powered: boolean;
  language: 'ladder' | 'st';
  /** Component kind: `plc` (fixed 5/6 I/O) or `plc16` (16/16 with nameable tags). */
  kind: string;
  /** Every input and output terminal with the tag bound to it and its live state, whatever the I/O map. */
  io: { inputs: PlcIoPoint[]; outputs: PlcIoPoint[] };
  inputs: PlcInputs;
  coils: Record<string, boolean>;
  /** Every output terminal (for example `Q0.0`) -> on. */
  outputs: Record<string, boolean>;
  /** Live variables and rung results of this PLC's last scan, for the programming dock's monitor. */
  tagValues: Record<string, STValue>;
  ladderSteps: LadderStep[];
  ladderMemory: LadderMemory;
};
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
  /** Programs of PLCs beyond the first, keyed by PLC component id. Omitted for single-PLC projects. */
  plcPrograms?: Record<string, PlcProgram>;
  /** Tag names of the configurable (16/16) controllers, by PLC id. Omitted when every name is the default. */
  plcIo?: Record<string, { inputs: Record<string, string>; outputs: Record<string, string> }>;
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
  /** Material-handling state of every conveyor lane, by conveyor id (the legacy `plant` mirrors the first). */
  lanes: Record<string, SortingPlant>;
  /** Process state of every tank, by tank id (the legacy `tank` mirrors the first). */
  vessels: Record<string, TankProcess>;
  /** Trip state of every breaker and overload, by component id (the legacy flags mirror the first of each). */
  tripped: Record<string, boolean>;
  /** Scan state of every PLC after the first, by component id. */
  plcs: Record<string, PlcRuntime>;
  /** Energised state of every contactor, motor and lamp by component id (the legacy booleans mirror the first). */
  deviceOn: Record<string, boolean>;
  /** Shaft angle of every motor by component id (the legacy angle mirrors the first). */
  motorAngles: Record<string, number>;
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
  | { k: 'injectFault'; kind: FaultKind; target: string; stuckPressed?: boolean; stuckActive?: boolean; hidden: boolean }
  /** Deterministically picks one applicable fault from the current project using `seed`. */
  | { k: 'injectSeededFault'; seed: number; hidden: boolean }
  | { k: 'clearFault'; id: string }
  | { k: 'revealFault'; id: string }
  /** Replace a component or re-terminate a wire. Needs the simulation paused (isolated). */
  | { k: 'repair'; target: string }
  /** Delete a device and everything that depended on it (its wires, faults, PLC program). Paused only. */
  | { k: 'remove'; id: string }
  /** Drop in a ready-made, pre-wired start/stop starter panel at a free spot (or `at`). Paused only. */
  | { k: 'addPanel'; template: 'motor-starter'; at?: XY }
  /** `conveyor` names the lane; omitted means the first conveyor (the single-conveyor behaviour). */
  | { k: 'feedParcel'; kind: ParcelKind; conveyor?: string }
  | { k: 'operateProtection'; id: string; action: 'trip' | 'reset' }
  | { k: 'setMeterProbe'; lead: 'positive' | 'negative'; terminal: string | null }
  /** `plc` names the target PLC component; omitted means the first PLC (the legacy single-PLC behaviour). */
  /** Rename the tags of a configurable (16/16) PLC. Refused if it would break that PLC's program. Paused only. */
  | { k: 'configureIo'; plc: string; io: { inputs: Record<string, string>; outputs: Record<string, string> } }
  | { k: 'loadProgram'; program: LadderDocument; plc?: string }
  | { k: 'loadST'; source: string; plc?: string }
  | { k: 'activateLanguage'; language: 'ladder' | 'st'; plc?: string }
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
  /** Every PLC (first and additional) by component id. */
  plcs: Record<string, PlcView>;
  /** Every conveyor lane (parcel and counters) by conveyor id. */
  lanes: Record<string, SortingPlant>;
  /** Every tank by tank id. */
  vessels: Record<string, TankProcess>;
  /** Trip state of every breaker and overload by component id. */
  tripped: Record<string, boolean>;
  /** Energised state of every contactor, motor and lamp by component id. */
  deviceOn: Record<string, boolean>;
  /** Shaft angle of every motor by component id. */
  motorAngles: Record<string, number>;
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
