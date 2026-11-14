/** Pure FBD editor operations. The worker still compiles every saved graph. */
import type { FbdDocument, FbdKind, FbdNode, FbdNames } from '../engineering/fbd';

export const FBD_KINDS: readonly FbdKind[] = [
  'input','constant','and','or','xor','not','ton','tof','tp','ctu','ctd','sr','rs','compare','output',
];
export const FBD_ARITY: Readonly<Record<FbdKind,number>> = {
  input:0,constant:0,and:2,or:2,xor:2,not:1,ton:1,tof:1,tp:1,ctu:2,ctd:2,sr:2,rs:2,compare:0,output:1,
};
export const initialFbdNode = (document: FbdDocument, kind: FbdKind, names: FbdNames): FbdNode => {
  let count = 1;
  while (document.nodes.some(n => n.id === 'block' + count)) count++;
  const earlier = document.nodes.filter(n => n.kind !== 'output');
  const first = earlier[0]?.id ?? '';
  const assigned = new Set(document.nodes.filter(n => n.kind === 'output').map(n => n.tag));
  const output = names.outputs.find(tag => !assigned.has(tag));
  if (kind === 'output' && !output) throw new Error('All mapped output tags are used');
  if (kind === 'compare' && !names.numericInputs?.length)
    throw new Error('Connect and map a numeric PLC input before creating a compare block');
  const index = document.nodes.length;
  const base: FbdNode = { id: 'block' + count, kind,
    x: 50 + Math.floor(index / 5) * 230, y: 50 + (index % 5) * 90 };
  if (kind === 'input') return { ...base,tag:names.inputs[0] };
  if (kind === 'constant') return { ...base,value:false };
  if (kind === 'compare') return { ...base,tag:names.numericInputs![0],comparator:'ge',threshold:0 };
  if (kind === 'output') return { ...base,tag:output,inputs:[first] };
  const inputs = Array.from({ length:FBD_ARITY[kind] }, () => first);
  if (['ton','tof','tp','ctu','ctd'].includes(kind)) return { ...base,inputs,preset:kind==='ctu'||kind==='ctd'?3:500 };
  return { ...base,inputs };
};
export const addFbdNode = (document: FbdDocument, node: FbdNode): FbdDocument =>
  ({ ...document,nodes:[...document.nodes,node] });
export const replaceFbdNode = (document: FbdDocument, node: FbdNode): FbdDocument =>
  ({ ...document,nodes:document.nodes.map(n => n.id===node.id?node:n) });
export const removeFbdNode = (document: FbdDocument, id: string): FbdDocument =>
  ({ ...document,nodes:document.nodes.filter(n => n.id!==id) });
