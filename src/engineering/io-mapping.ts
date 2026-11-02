/** Educational discrete PLC terminal mapping. This is not a vendor address dialect. */
import type { LadderDocument } from './ladder';
export type IoDirection = 'input' | 'output' | 'memory';
export interface IoPoint { tag: string; address: string; direction: IoDirection; description: string; value: boolean }
export const WORKCELL_INPUTS = Object.freeze({PowerOK:'I0.0',GuardClosed:'I0.1',SensorOK:'I0.2',Start:'I0.3',Stop:'I0.4'});
export const WORKCELL_OUTPUTS = Object.freeze({RunLatch:'Q0.0',MotorContactor:'Q0.1'});
const addressPattern = /^([IQM])(\d+)\.(\d+)$/;
export function parseDiscreteAddress(address: string): {direction: IoDirection; byte: number; bit: number; canonical: string} | null {
 const match = addressPattern.exec(address.toUpperCase());
 if (!match) return null;
 const byte = Number(match[2]), bit = Number(match[3]);
 if (!Number.isSafeInteger(byte) || byte > 65535 || bit > 7) return null;
 return {direction:match[1]==='I'?'input':match[1]==='Q'?'output':'memory',byte,bit,canonical:`${match[1]}${byte}.${bit}`};
}
export function validateIoMapping(doc: LadderDocument): string[] {
 const errors: string[] = [], used = new Map<string,string>();
 const coilTags = new Set(doc.rungs.map(r=>r.coil));
 for (const [tag, symbol] of Object.entries(doc.symbols ?? {})) {
  if (!symbol.address) continue;
  const parsed = parseDiscreteAddress(symbol.address);
  if (!parsed) {errors.push(`${tag}: expected discrete address I/Q/M<byte>.<bit 0..7>`);continue;}
  const other = used.get(parsed.canonical);
  if (other && other !== tag) errors.push(`${tag}: ${parsed.canonical} already assigned to ${other}`);
  used.set(parsed.canonical,tag);
  if (coilTags.has(tag) && parsed.direction==='input') errors.push(`${tag}: coil cannot write to an input terminal`);
  if (!coilTags.has(tag) && parsed.direction==='output') errors.push(`${tag}: output address requires a coil`);
 }
 return errors;
}
/** Symbol overrides change terminal labels only; electrical sampling remains authoritative. */
export function resolveIoPoints(doc: LadderDocument, inputs: Readonly<Record<string,boolean>>, outputs: Readonly<Record<string,boolean>>): IoPoint[] {
 const tags = new Set([...Object.keys(inputs),...Object.keys(outputs),...Object.keys(doc.symbols ?? {})]);
 const coils = new Set(doc.rungs.map(r=>r.coil));
 return [...tags].sort().map(tag=>{
  const fallback = (WORKCELL_INPUTS as Record<string,string>)[tag] ?? (WORKCELL_OUTPUTS as Record<string,string>)[tag];
  const address = doc.symbols?.[tag]?.address ?? fallback ?? '';
  const parsed = address ? parseDiscreteAddress(address) : null;
  const direction = parsed?.direction ?? (coils.has(tag)||tag in outputs?'output':'input');
  return {tag,address:parsed?.canonical??address,direction,description:doc.symbols?.[tag]?.description??'',value:direction==='input'?inputs[tag]===true:outputs[tag]===true};
 });
}
