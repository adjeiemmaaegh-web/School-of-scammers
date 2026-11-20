/**
 * Stage 2 / R3.6: bounded, deterministic Web Worker command ingress.
 *
 * This module has NO timer, browser, renderer or simulation dependency.
 * A packet is validated once when received, then commands are applied in
 * arrival order at the normal 50 ms boundary. Queue rejection never partially
 * inserts commands or leaks unbounded request acknowledgements.
 *
 * Limits cover the working v1 project format (<=1 MB in local storage) while
 * rejecting malformed or runaway command batches. They do not limit the
 * size of the immutable render snapshot sent back to the UI.
 */
import type { Command } from './signals';

export const MAX_WORKER_COMMANDS_PER_PACKET = 128;
export const MAX_WORKER_PACKET_BYTES = 1_250_000;
export const MAX_WORKER_PENDING_COMMANDS = 256;
export const MAX_WORKER_PENDING_BYTES = 2_500_000;
export const MAX_WORKER_PENDING_REQUESTS = 256;

const KINDS: ReadonlySet<Command['k']> = new Set([
  'editWorkspace', 'place', 'move', 'wire', 'unwire', 'operate', 'operateToggle',
  'injectFault', 'injectSeededFault', 'clearFault', 'revealFault', 'repair',
  'remove', 'setWireStyle', 'setParam', 'addPanel', 'feedParcel',
  'setPlantFault', 'setTrainingOperator', 'loadPlantScene', 'operateProtection',
  'setMeterProbe', 'setMeterMode', 'setThreePhasePower', 'configureIo',
  'loadProgram', 'loadST', 'loadFBD', 'activateLanguage', 'breakAtScan',
  'breakOnTag', 'breakOnInstruction', 'forceLocal', 'loadProject',
  'run', 'pause', 'step', 'reset', 'clear',
]);

export type WorkerCommandPacket = {
  readonly commands: Command[];
  readonly bytes: number;
  readonly requestId?: number;
};
export type IngressResult =
  | { readonly ok: true; readonly packet: WorkerCommandPacket }
  | { readonly ok: false; readonly error: string; readonly requestId?: number };

export function parseWorkerIngress(raw: unknown): IngressResult {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : null;
  const requestId = value && typeof value.requestId === 'number' &&
    Number.isSafeInteger(value.requestId) && value.requestId >= 0
    ? value.requestId : undefined;
  const fail = (error: string): IngressResult => ({ ok: false, error, requestId });
  if (!value || value.kind !== 'commands' || !Array.isArray(value.commands))
    return fail('Invalid simulation worker request');
  if (value.commands.length > MAX_WORKER_COMMANDS_PER_PACKET)
    return fail('Too many commands in one simulation request');
  for (const command of value.commands) {
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
        typeof command.k !== 'string' || !KINDS.has(command.k as Command['k']))
      return fail('Unknown or malformed simulation command');
  }
  let json: string;
  try {
    json = JSON.stringify(value.commands);
  } catch {
    return fail('Simulation commands cannot be serialized');
  }
  // Every UTF-8 byte occupies at least as much space as a JS string code
  // unit, so this cheap precheck avoids allocating a huge encoded copy.
  if (json.length > MAX_WORKER_PACKET_BYTES)
    return fail('Simulation command payload exceeds the worker size limit');
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > MAX_WORKER_PACKET_BYTES)
    return fail('Simulation command payload exceeds the worker size limit');
  return { ok: true, packet: { commands: value.commands as Command[], bytes,
    ...(requestId === undefined ? {} : { requestId }) } };
}

/** A FIFO: mutation is confined to the worker; no timers or implicit ticks. */
export class WorkerMailbox {
  private commands: Command[] = [];
  private requestIds: number[] = [];
  private bytes = 0;

  get hasPending(): boolean { return this.commands.length > 0 || this.requestIds.length > 0; }
  get commandCount(): number { return this.commands.length; }
  get pendingBytes(): number { return this.bytes; }

  enqueue(packet: WorkerCommandPacket): string | null {
    if (this.commands.length + packet.commands.length > MAX_WORKER_PENDING_COMMANDS ||
        this.bytes + packet.bytes > MAX_WORKER_PENDING_BYTES ||
        this.requestIds.length + (packet.requestId === undefined ? 0 : 1) > MAX_WORKER_PENDING_REQUESTS)
      return 'Simulation command queue is busy. Wait for the next PLC scan and retry.';
    this.commands.push(...packet.commands);
    this.bytes += packet.bytes;
    if (packet.requestId !== undefined) this.requestIds.push(packet.requestId);
    return null;
  }

  take(): { commands: Command[]; requestIds: number[] } {
    const commands = this.commands, requestIds = this.requestIds;
    this.commands = [];
    this.requestIds = [];
    this.bytes = 0;
    return { commands, requestIds };
  }
}
