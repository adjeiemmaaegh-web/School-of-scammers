import type { LadderDocument, LadderMemory, LadderStep } from '../engineering/ladder';
import type { STValue } from '../engineering/structured-text';
import type { ComponentKind } from '../components/registry';

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
  stMemory: Record<string, STValue>;
  tagValues: Record<string, STValue>;
  ladderSteps: LadderStep[];
  breakpointScan: number | null;
  breakpointHit: string | null;
  contactorOn: boolean;
  motorOn: boolean;
  motorAngleRad: number;
  powered: boolean;
  inputs: { Start: boolean; StopOK: boolean };
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
  | { k: 'loadProgram'; program: LadderDocument }
  | { k: 'loadST'; source: string }
  | { k: 'activateLanguage'; language: 'ladder' | 'st' }
  | { k: 'breakAtScan'; scan: number | null }
  | { k: 'loadProject'; project: unknown }
  | { k: 'run' | 'pause' | 'step' | 'reset' | 'clear' };
export type SimEvent = { tick: number; kind: string; detail: string };
export type RenderSnapshot = {
  tick: number;
  running: boolean;
  components: PlacedComponent[];
  wires: Wire[];
  io: { Start: boolean; StopOK: boolean; Run: boolean; 'Q0.0': boolean; PlcPowered: boolean };
  voltages: Record<string, number | null>;
  contactorOn: boolean;
  motorOn: boolean;
  motorAngleRad: number;
  diagnostics: string[];
  lastError: string | null;
  language: 'ladder' | 'st';
  tagValues: Record<string, STValue>;
  ladderSteps: LadderStep[];
  ladderMemory: LadderMemory;
  breakpointScan: number | null;
  breakpointHit: string | null;
};
export type WorkerRequest = { kind: 'commands'; commands: Command[] };
export type WorkerResponse = { kind: 'snapshot'; snapshot: RenderSnapshot; events: SimEvent[]; project?: ProjectFile };
