/**
 * Restricted training-only PLC forces.
 * Only DECLARED Ladder-local BOOL/INT/DINT/REAL memory tags may be forced.
 * Physical inputs, outputs, E-stop/guards, device terminals and FBD/ST variables
 * are not forceable through this interface. No change to the 24V netlist.
 */
import type { LadderDocument } from '../engineering/ladder';
export type LocalForceMap = Record<string, boolean|number>;

const forbidden = /(?:estop|e_stop|emergency|guard|safety|interlock|stopok)/i;
export function localForceError(
  document: LadderDocument, tag: string, value: boolean|number|null,
): string|null {
  if(typeof tag!=='string' || !/^[A-Za-z][A-Za-z0-9_.]{0,39}$/.test(tag))
    return 'Force tag name is invalid';
  const def=document.symbols?.[tag];
  if(!def) return 'Only declared Ladder-local memory tags may be forced; physical inputs and outputs are prohibited';
  if(forbidden.test(tag))return 'Safety/guard/interlock-like tags cannot be forced';
  if(value===null)return null;
  const kind=def.type??'BOOL';
  if(kind==='BOOL')return typeof value==='boolean'?null:'BOOL force requires TRUE or FALSE';
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1_000_000_000)
    return 'Numeric force must be finite and within ±1 billion';
  if(kind==='INT'&&(!Number.isInteger(value)||value<-32768||value>32767))
    return 'INT force outside -32768..32767';
  if(kind==='DINT'&&(!Number.isInteger(value)||value<-2147483648||value>2147483647))
    return 'DINT force outside signed 32-bit range';
  return null;
}
export function applyLocalForce(prior:Readonly<LocalForceMap>,document:LadderDocument,
  tag:string,value:boolean|number|null):LocalForceMap {
  const error=localForceError(document,tag,value);
  if(error)throw new Error(error);
  const next={...prior};
  if(value===null)delete next[tag];else next[tag]=value;
  return next;
}
