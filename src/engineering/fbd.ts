/** Bounded, deterministic Function Block Diagram engine for the educational PLC.
 * One ordered graph is evaluated per authoritative PLC scan. It is not safety-rated.
 */
import type { STValue } from './structured-text';

export type FbdKind = 'input'|'constant'|'and'|'or'|'xor'|'not'|'ton'|'tof'|'tp'|'ctu'|'ctd'|'sr'|'rs'|'compare'|'output';
export type FbdComparator = 'eq'|'ne'|'lt'|'le'|'gt'|'ge';
export type FbdNode = {
  id: string; kind: FbdKind; inputs?: string[]; tag?: string; value?: boolean;
  preset?: number; comparator?: FbdComparator; threshold?: number; x?: number; y?: number;
};
export type FbdDocument = { id: string; version: string; nodes: FbdNode[] };
export type FbdNames = { inputs: readonly string[]; outputs: readonly string[]; requireRun?: boolean; numericInputs?: readonly string[] };
export type FbdState = { elapsedMs: number; count: number; done: boolean; lastEnable: boolean };
export type FbdMemory = Record<string, FbdState>;
export type FbdStep = { nodeId: string; kind: FbdKind; on: boolean; elapsedMs?: number; count?: number; tag?: string };
export type FbdProgram = { document: FbdDocument; order: readonly FbdNode[]; outputTags: readonly string[] };
export type FbdResult = { outputs: Record<string,boolean>; values: Record<string,boolean>; memory: FbdMemory; steps: FbdStep[] };
export const MAX_FBD_NODES = 64;
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/, TAG = /^[A-Za-z][A-Za-z0-9_.]{0,39}$/;
const ports: Record<FbdKind,number> = {
  input:0,constant:0,and:2,or:2,xor:2,not:1,ton:1,tof:1,tp:1,ctu:2,ctd:2,sr:2,rs:2,compare:0,output:1,
};
const isName = (value: unknown): value is string => typeof value === 'string' && TAG.test(value) &&
  !['__proto__','prototype','constructor'].includes(value.toLowerCase());
const fresh = (): FbdState => ({ elapsedMs:0,count:0,done:false,lastEnable:false });

export function compileFbd(doc: FbdDocument, names: FbdNames): FbdProgram {
  if (!doc || typeof doc !== 'object' || !ID.test(doc.id) || typeof doc.version !== 'string' || !doc.version ||
      !Array.isArray(doc.nodes) || doc.nodes.length < 2 || doc.nodes.length > MAX_FBD_NODES)
    throw new Error('FBD needs 2–64 valid nodes');
  const nodes = new Map<string,FbdNode>();
  const usedOutputs = new Set<string>();
  let connections = 0;
  for (const node of doc.nodes) {
    if (!node || typeof node !== 'object' || !ID.test(node.id) || nodes.has(node.id) ||
        !Object.hasOwn(ports,node.kind)) throw new Error('Invalid or duplicate FBD node');
    if (!Array.isArray(node.inputs ?? []) || (node.inputs ?? []).length !== ports[node.kind] ||
        (node.inputs ?? []).some(id => typeof id !== 'string' || !ID.test(id)))
      throw new Error('FBD ' + node.id + ' requires ' + ports[node.kind] + ' connected input pins');
    connections += (node.inputs ?? []).length;
    if ((node.x !== undefined && (!Number.isInteger(node.x) || node.x < 0 || node.x > 2000)) ||
        (node.y !== undefined && (!Number.isInteger(node.y) || node.y < 0 || node.y > 2000)))
      throw new Error('Invalid FBD visual layout');
    if (node.kind === 'input' && (!isName(node.tag) ||
        ![...names.inputs,...names.outputs].includes(node.tag)))
      throw new Error('FBD input must name a mapped BOOL input or prior output');
    if (node.kind === 'output') {
      if (!isName(node.tag) || !names.outputs.includes(node.tag) || usedOutputs.has(node.tag))
        throw new Error('FBD output tag is unknown or duplicate');
      usedOutputs.add(node.tag);
    }
    if (node.kind === 'constant' && typeof node.value !== 'boolean') throw new Error('FBD constant must be BOOL');
    if (node.kind === 'compare' && (!isName(node.tag) || !(names.numericInputs ?? []).includes(node.tag) ||
        !['eq','ne','lt','le','gt','ge'].includes(node.comparator ?? '') ||
        typeof node.threshold !== 'number' || !Number.isFinite(node.threshold) || Math.abs(node.threshold) > 1e9))
      throw new Error('FBD comparator needs a mapped numeric tag and finite threshold');
    if (['ton','tof','tp','ctu','ctd'].includes(node.kind)) {
      const cap = node.kind === 'ctu' || node.kind === 'ctd' ? 100_000_000 : 86_400_000;
      if (!Number.isSafeInteger(node.preset) || node.preset! < 1 || node.preset! > cap)
        throw new Error('Invalid FBD timer or counter preset');
    }
    nodes.set(node.id,node);
  }
  if (connections > 160) throw new RangeError('FBD connections exceed budget');
  if (!usedOutputs.size || names.requireRun && !usedOutputs.has('Run'))
    throw new Error(names.requireRun ? 'FBD requires Run output' : 'FBD requires a mapped output');
  const status = new Map<string,'active'|'done'>(), order: FbdNode[] = [];
  const visit = (node: FbdNode) => {
    if (status.get(node.id) === 'done') return;
    if (status.get(node.id) === 'active') throw new Error('FBD graph cycle at ' + node.id);
    status.set(node.id,'active');
    for (const pin of node.inputs ?? []) {
      const source = nodes.get(pin);
      if (!source) throw new Error('Missing FBD source: ' + pin);
      if (source.kind === 'output') throw new Error('Output cannot feed FBD pins; use a feedback input tag');
      visit(source);
    }
    status.set(node.id,'done'); order.push(node);
  };
  doc.nodes.forEach(visit);
  return { document:doc,order,outputTags:[...names.outputs] };
}

export function executeFbd(program: FbdProgram, sampled: Readonly<Record<string,STValue>>,
  priorOutputs: Readonly<Record<string,boolean>> = {}, priorMemory: Readonly<FbdMemory> = {}, dtMs = 50): FbdResult {
  if (!Number.isSafeInteger(dtMs) || dtMs < 1 || dtMs > 1000) throw new RangeError('Invalid FBD scan interval');
  const values: Record<string,boolean> = Object.create(null), outputs: Record<string,boolean> = Object.create(null);
  const memory: FbdMemory = Object.create(null), steps: FbdStep[] = [];
  for (const node of program.order) {
    const pins = (node.inputs ?? []).map(id => {
      if (!Object.hasOwn(values,id)) throw new Error('Unresolved FBD connection ' + id);
      return values[id];
    });
    const old = priorMemory[node.id] ?? fresh();
    let on = false, elapsedMs = 0, count = 0;
    if (node.kind === 'input') {
      // A feedback tag reads the PREVIOUS output image; at scan zero it is
      // necessarily FALSE. Missing physical inputs still fail closed.
      const v = Object.hasOwn(sampled,node.tag!) ? sampled[node.tag!] :
        Object.hasOwn(priorOutputs,node.tag!) ? priorOutputs[node.tag!] :
        program.outputTags.includes(node.tag!) ? false : undefined;
      if (typeof v !== 'boolean') throw new TypeError('FBD BOOL input unavailable: ' + node.tag);
      on = v;
    } else if (node.kind === 'constant') on = node.value!;
    else if (node.kind === 'and') on = pins[0] && pins[1];
    else if (node.kind === 'or') on = pins[0] || pins[1];
    else if (node.kind === 'xor') on = pins[0] !== pins[1];
    else if (node.kind === 'not') on = !pins[0];
    else if (node.kind === 'compare') {
      const n = sampled[node.tag!];
      if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError('FBD numeric tag unavailable: ' + node.tag);
      const v = node.threshold!;
      on = node.comparator === 'eq' ? n === v : node.comparator === 'ne' ? n !== v :
        node.comparator === 'lt' ? n < v : node.comparator === 'le' ? n <= v :
        node.comparator === 'gt' ? n > v : n >= v;
    } else if (node.kind === 'ton') {
      elapsedMs = pins[0] ? Math.min(node.preset!,old.elapsedMs+dtMs) : 0;
      on = pins[0] && elapsedMs >= node.preset!;
    } else if (node.kind === 'tof') {
      elapsedMs = pins[0] ? 0 : old.lastEnable ? dtMs : Math.min(node.preset!,old.elapsedMs+dtMs);
      on = pins[0] || (old.done && elapsedMs < node.preset!);
    } else if (node.kind === 'tp') {
      const start = pins[0] && !old.lastEnable && !old.done;
      const continuePulse = old.done && old.elapsedMs < node.preset!;
      on = start || continuePulse;
      elapsedMs = on ? Math.min(node.preset!, (start ? 0 : old.elapsedMs) + dtMs) : 0;
    } else if (node.kind === 'ctu' || node.kind === 'ctd') {
      const edge = pins[0] && !old.lastEnable;
      count = pins[1] ? (node.kind === 'ctu' ? 0 : node.preset!) :
        node.kind === 'ctu' ? edge ? Math.min(node.preset!,old.count+1) : old.count :
          edge ? Math.max(0,old.count-1) : old.count;
      on = node.kind === 'ctu' ? count >= node.preset! : count === 0;
    } else if (node.kind === 'sr' || node.kind === 'rs') {
      on = node.kind === 'sr' ? (pins[0] || (old.done && !pins[1])) :
        (!pins[1] && (pins[0] || old.done));
    } else if (node.kind === 'output') {
      on = pins[0]; outputs[node.tag!] = on;
    }
    if (['ton','tof','tp','ctu','ctd','sr','rs'].includes(node.kind)) {
      memory[node.id] = { elapsedMs, count, done:on, lastEnable:pins[0] };
    }
    values[node.id] = on;
    steps.push({ nodeId:node.id,kind:node.kind,on,
      ...(['ton','tof','tp'].includes(node.kind) ? { elapsedMs } : {}),
      ...(['ctu','ctd'].includes(node.kind) ? { count } : {}),
      ...(node.tag ? { tag:node.tag } : {}) });
  }
  return { outputs,values,memory,steps };
}

/** A real 50ms scan motor latch using previous-output feedback, not an animated example. */
export const fbdMotorStarter = (start='Start', stop='StopOK', output='Run'): FbdDocument => ({
  id:'motor-starter',version:'1.0',nodes:[
    { id:'start',kind:'input',tag:start,x:50,y:80 },
    { id:'permit',kind:'input',tag:stop,x:50,y:200 },
    { id:'feedback',kind:'input',tag:output,x:50,y:320 },
    { id:'latch',kind:'or',inputs:['start','feedback'],x:300,y:120 },
    { id:'enable',kind:'and',inputs:['latch','permit'],x:500,y:140 },
    { id:'coil',kind:'output',tag:output,inputs:['enable'],x:700,y:140 },
  ],
});
