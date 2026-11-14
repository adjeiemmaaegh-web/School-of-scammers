/** P1 source-only workspace edit contracts. Pure data, no React/DOM/worker coupling. */
import type { XY, PlacedComponent, Wire, PlcProgram, ProjectFile } from '../sim/signals';

export type GridStep = 1 | 5 | 10 | 25 | 50;
export type WorkspaceCategory =
  | 'Controllers & I/O' | 'Power & protection' | 'Control gear'
  | 'Sensors' | 'Motors & actuators' | 'Conveyance' | 'Process' | 'Indicators';

export type WorkspaceFragment = {
  version: 1;
  components: PlacedComponent[];
  wires: Wire[];
  params?: ProjectFile['params'];
  plcPrograms?: Record<string, PlcProgram>;
  plcIo?: ProjectFile['plcIo'];
};

/** Discrete, validated edit commands committed by the authoritative simulator worker. */
export type WorkspaceEdit =
  | { kind: 'translate'; ids: string[]; delta: XY; grid: GridStep }
  | { kind: 'rotate'; ids: string[]; quarterTurns: -1 | 1 }
  | { kind: 'duplicate'; ids: string[]; offset: XY; grid: GridStep }
  | { kind: 'delete'; ids: string[] }
  | { kind: 'paste'; fragment: WorkspaceFragment; at: XY; grid: GridStep };

export type WorkspaceHistory = {
  undo: ProjectFile[];
  redo: ProjectFile[];
};
