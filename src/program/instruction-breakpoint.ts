/**
 * Worker-only FBD block / Ladder rung debugging predicates.
 * Breaks *after* a committed PLC scan, never alters a physical input or output.
 */
import type { EdgeDirection } from './scan-trace';
import type { LadderStep } from '../engineering/ladder';
import type { FbdStep } from '../engineering/fbd';

export type InstructionBreakpoint = {
  id: string;
  metric: 'edge'|'elapsedMs'|'count';
  edge?: EdgeDirection;
  threshold?: number;
};
export type InstructionValue = { id: string; on: boolean; elapsedMs?: number; count?: number };

export const ladderReadings = (steps: readonly LadderStep[]): InstructionValue[] =>
  steps.map(step=>({id:step.rungId,on:step.result,
    ...(step.elapsedMs===undefined?{}:{elapsedMs:step.elapsedMs}),
    ...(step.count===undefined?{}:{count:step.count})}));
export const fbdReadings = (steps: readonly FbdStep[]): InstructionValue[] =>
  steps.map(step=>({id:step.nodeId,on:step.on,
    ...(step.elapsedMs===undefined?{}:{elapsedMs:step.elapsedMs}),
    ...(step.count===undefined?{}:{count:step.count})}));

export function validateInstructionBreakpoint(
  raw: unknown, available: readonly string[],
): raw is InstructionBreakpoint {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return false;
  const x=raw as Partial<InstructionBreakpoint>;
  if(typeof x.id!=='string'||!available.includes(x.id))return false;
  if(x.metric==='edge')return x.edge==='rising'||x.edge==='falling'||x.edge==='either';
  if(x.metric==='elapsedMs'||x.metric==='count')
    return typeof x.threshold==='number' && Number.isSafeInteger(x.threshold) &&
      x.threshold>=1 && x.threshold<=1_000_000_000;
  return false;
}
export function instructionBreakpointHit(
  breakpoint: InstructionBreakpoint|null,
  before: readonly InstructionValue[], after: readonly InstructionValue[], scan: number,
): string|null {
  if(!breakpoint)return null;
  const current=after.find(v=>v.id===breakpoint.id);
  if(!current)return null;
  const previous=before.find(v=>v.id===breakpoint.id);
  if(breakpoint.metric==='edge'){
    const old=previous?.on??false;
    const edge=old!==current.on && (
      breakpoint.edge==='either' ||
      breakpoint.edge==='rising'&&current.on ||
      breakpoint.edge==='falling'&&!current.on);
    return edge?'Paused at scan '+scan+': instruction '+breakpoint.id+' '+breakpoint.edge+' edge':null;
  }
  const metric=breakpoint.metric;
  const now=current[metric], prior=previous?.[metric]??0;
  if(typeof now!=='number'||!Number.isFinite(now))return null;
  return prior<breakpoint.threshold!&&now>=breakpoint.threshold!
    ?'Paused at scan '+scan+': instruction '+breakpoint.id+' '+metric+' reached '+breakpoint.threshold
    :null;
}
