/**
 * P17 body-grounded batch quality trace. Created ONLY from actual worker-owned
 * bodies after physical PLC operations; never from a display frame or fixture.
 * Simulated positions, process tags and support names are training-model facts,
 * not certified sensor measurements or calibrated quality inspection.
 */
import type {Body} from '../world/types';
export type P17MaterialTrace={
 bodyId:string;material:'metal'|'cardboard'|'unknown';
 shape:'box'|'cylinder';supportedBy:string|null;
 xMm:number;yMm:number;qualityPassed:boolean;
 filledMl:number|null;capped:boolean;palletSlot:number|null;
};
export function p17MaterialTrace(body:Body,qualityPassed:boolean):P17MaterialTrace{
 const mat=body.tags.material;
 return {
  bodyId:body.id,material:mat==='metal'||mat==='cardboard'?mat:'unknown',
  shape:body.shape,supportedBy:body.supportedBy,
  xMm:body.pos.x,yMm:body.pos.y,qualityPassed,
  filledMl:typeof body.tags.filledMl==='number'?body.tags.filledMl:null,
  capped:body.tags.capped===true,
  palletSlot:typeof body.tags.palletSlot==='number'?body.tags.palletSlot:null,
 };
}
export const materialCode=(trace:readonly P17MaterialTrace[]):string=>
 trace.map(b=>b.material==='metal'?'M':b.material==='cardboard'?'C':'?').join('');
