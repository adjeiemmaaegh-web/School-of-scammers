/** Deterministic bounded virtual material handling, separate from rendering.
 * Simple linear conveyor motion and proximity gates are teaching idealizations,
 * NOT collision, inertia, pneumatic force or industrial safety calculations.
 */
import {validateLayout,type WorkcellLayout,type WorkcellCommands,type WorkcellScan,type Equipment} from './workcell-layout';
export type MaterialKind='carton'|'metal';
export type MaterialUnit={id:string;kind:MaterialKind;conveyorId:string;progress:number};
export type MaterialEvent={kind:'injected'|'completed'|'diverted';unitId:string;timeMs:number;conveyorId:string};
export type MaterialFlowState={nextId:number;units:readonly MaterialUnit[];completed:number;diverted:number;events:readonly MaterialEvent[]};
export const MAX_MATERIAL_UNITS=16;
export const MAX_MATERIAL_EVENTS=48;
const beltLength=2.25, travelMs=2500, gateRadius=1.12;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function initialMaterialFlow():MaterialFlowState{return {nextId:1,units:[],completed:0,diverted:0,events:[]};}
function strict(state:MaterialFlowState):void{
 if(!state||!Number.isSafeInteger(state.nextId)||state.nextId<1||!Array.isArray(state.units)||state.units.length>MAX_MATERIAL_UNITS||!Number.isSafeInteger(state.completed)||state.completed<0||!Number.isSafeInteger(state.diverted)||state.diverted<0||!Array.isArray(state.events)||state.events.length>MAX_MATERIAL_EVENTS)throw new TypeError('Invalid material flow state');
 for(const unit of state.units)if(!unit||typeof unit.id!=='string'||!/^part-[1-9]\d*$/.test(unit.id)||!['carton','metal'].includes(unit.kind)||typeof unit.conveyorId!=='string'||!Number.isFinite(unit.progress)||unit.progress<0||unit.progress>=1)throw new TypeError('Invalid material unit');
}
export function materialWorldPosition(conveyor:Pick<Equipment,'x'|'z'|'rotation'>,progress:number):{x:number;z:number}{
 const angle=conveyor.rotation*Math.PI/2;
 const offset=(progress-0.5)*beltLength;
 return {x:conveyor.x+offset*Math.cos(angle),z:conveyor.z-offset*Math.sin(angle)};
}
export function injectMaterial(layout:WorkcellLayout,state:MaterialFlowState,conveyorId:string,kind:MaterialKind,timeMs:number):MaterialFlowState{
 const valid=validateLayout(layout);strict(state);
 if(!['carton','metal'].includes(kind))throw new RangeError('Unknown material type');
 if(!Number.isSafeInteger(timeMs)||timeMs<0)throw new RangeError('Invalid material clock');
 const conveyor=valid.equipment.find(e=>e.id===conveyorId&&e.kind==='conveyor');
 if(!conveyor)throw new Error('Select an existing conveyor for material injection');
 if(state.units.length>=MAX_MATERIAL_UNITS)throw new RangeError('Material capacity reached (16)');
 if(state.units.some(e=>e.conveyorId===conveyorId&&e.progress<0.22))throw new Error('Virtual infeed occupied; advance conveyor before adding another item');
 if(state.nextId>=Number.MAX_SAFE_INTEGER)throw new RangeError('Material serial number exhausted');
 const id='part-'+state.nextId;
 const event:MaterialEvent={kind:'injected',unitId:id,timeMs,conveyorId};
 return {nextId:state.nextId+1,units:[...state.units,{id,kind,conveyorId,progress:0.05}],completed:state.completed,diverted:state.diverted,events:[...state.events,event].slice(-MAX_MATERIAL_EVENTS)};
}
/** Sample the geometric sensor image *before* the PLC scan, from the prior
 * material state. All sensors on a belt use world coordinates, not device IDs.
 * Inductive proximity detects metal only; optical photoeyes detect either kind.
 */
export function sampleMaterialSensors(layout:WorkcellLayout,state:MaterialFlowState):Readonly<Record<string,boolean>>{
 const valid=validateLayout(layout);strict(state);
 const conveyors=new Map(valid.equipment.filter(e=>e.kind==='conveyor').map(e=>[e.id,e]));
 const sensors=valid.equipment.filter(e=>e.kind==='photoeye'||e.kind==='proximity');
 const values:Record<string,boolean>={};
 for(const sensor of sensors){
  values[sensor.id]=state.units.some(unit=>{
   if(sensor.kind==='proximity'&&unit.kind!=='metal')return false;
   const conveyor=conveyors.get(unit.conveyorId);
   if(!conveyor)return false;
   const where=materialWorldPosition(conveyor,unit.progress);
   const d=Math.hypot(where.x-sensor.x,where.z-sensor.z);
   return d<=gateRadius;
  });
 }
 return values;
}
/** Advance material using the simulated PLC time step and final safe actuator
 * command image. Pusher diversion is an explicit modeled encounter, not a
 * physical collision or claim about actual robotic transfer timing.
 */
export function stepMaterialFlow(layout:WorkcellLayout,previous:MaterialFlowState,plantBefore:WorkcellScan,commands:WorkcellCommands,deltaMs:number):MaterialFlowState{
 const valid=validateLayout(layout);strict(previous);
 if(!Number.isSafeInteger(deltaMs)||deltaMs<10||deltaMs>1000)throw new RangeError('Material scan interval must be 10..1000 ms');
 if(!plantBefore||!Number.isSafeInteger(plantBefore.timeMs)||plantBefore.timeMs<0||plantBefore.timeMs+deltaMs>Number.MAX_SAFE_INTEGER)throw new RangeError('Invalid material simulation clock');
 const conveyors=new Map(valid.equipment.filter(e=>e.kind==='conveyor').map(e=>[e.id,e]));
 const pushers=valid.equipment.filter(e=>e.kind==='pusher'||e.kind==='cylinder');
 const units:MaterialUnit[]=[];
 const events=[...previous.events];
 let completed=previous.completed,diverted=previous.diverted;
 for(const unit of previous.units){
  const conveyor=conveyors.get(unit.conveyorId);
  if(!conveyor){ // Layout can change between scans; fail closed instead of deleting cargo.
   throw new Error('Material refers to a missing conveyor; reset material before changing layout');
  }
  const progress=commands[conveyor.id]===true ? Math.min(1,unit.progress+deltaMs/travelMs) : unit.progress;
  const where=materialWorldPosition(conveyor,Math.min(1,progress));
  const pushed=commands[conveyor.id]===true&&progress>=0.55&&pushers.some(p=>{
   const extended=plantBefore.devices[p.id]?.value??0;
   return extended>=0.3&&Math.hypot(where.x-p.x,where.z-p.z)<=1.65;
  });
  if(pushed||progress>=1){
   if(pushed)diverted++;else completed++;
   events.push({kind:pushed?'diverted':'completed',unitId:unit.id,timeMs:plantBefore.timeMs+deltaMs,conveyorId:unit.conveyorId});
  }else units.push({...unit,progress:Math.round(clamp(progress)*1e6)/1e6});
 }
 if(completed>Number.MAX_SAFE_INTEGER||diverted>Number.MAX_SAFE_INTEGER)throw new RangeError('Material event counter overflow');
 return {nextId:previous.nextId,units,completed,diverted,events:events.slice(-MAX_MATERIAL_EVENTS)};
}
export function materialSignals(state:MaterialFlowState):Readonly<Record<string,number>>{
 strict(state);
 return {PARTS_ON_BELTS:state.units.length,PARTS_COMPLETED:state.completed,PARTS_DIVERTED:state.diverted};
}
