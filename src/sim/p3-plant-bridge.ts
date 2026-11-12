/**
 * P3 integration adapter: project components -> fixed-mm equipment placements;
 * real electrical coil loads -> plant command image; plant sensor readings ->
 * next 50ms PLC scan. Pure: never reads Three/React/DOM or wall time.
 */
import type {ProjectFile} from './signals';
import type {EquipmentPlacement,LiveSignal,WorldEvent} from '../plant/world/types';
import type {SceneRuntime} from '../plant/world/runner';
import {freshRuntime,stepScene} from '../plant/world/runner';
import {freshWorld} from '../plant/world/bodies';
import {drainEvents} from '../plant/world/events';
import {PLANT_EQUIPMENT} from '../plant/equipment';
import {paramSpecsOf,paramValue} from '../components/params';

export const isP3Equipment=(kind:string):boolean=>Object.hasOwn(PLANT_EQUIPMENT,kind);
const coordinate=(x:number,y:number):{x:number;y:number;z:number}=>({
 x:Math.round((x+85-540)*10*1e6)/1e6,
 y:Math.round((y+65-290)*10*1e6)/1e6,z:0,
});
export function plantPlacements(project:Pick<ProjectFile,'components'|'params'>):EquipmentPlacement[]{
 return project.components.filter(c=>isP3Equipment(c.kind)).map(c=>({
  id:c.id,kind:c.kind,originMm:{...coordinate(c.x,c.y),z:c.elevationMm??0},
  yawDeg:c.yawDeg ?? 0, // Persisted quarter-turn placement drives plant physics and 3D equally
  params:Object.fromEntries(paramSpecsOf(c.kind).map(spec=>
   [spec.key,paramValue(project.params,c.id,spec)])),
 }));
}
export function validatePlantFaults(raw:unknown,
 project:Pick<ProjectFile,'components'>):Record<string,string>|undefined{
 if(raw===undefined)return undefined;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid plant fault dictionary');
 const entries=Object.entries(raw);
 if(entries.length>8)throw new Error('At most 8 active plant equipment faults');
 const faults:Record<string,string>={};
 for(const [id,code] of entries){
  const comp=project.components.find(c=>c.id===id);
  if(!comp||!isP3Equipment(comp.kind)||typeof code!=='string'||
     !PLANT_EQUIPMENT[comp.kind].faults.includes(code))
   throw new Error('Invalid plant equipment fault '+id);
  faults[id]=code;
 }
 return Object.keys(faults).length?faults:undefined;
}
export function freshProjectPlant(project:Pick<ProjectFile,'components'|'params'>,
 seed=1):SceneRuntime{
 return freshRuntime(freshWorld(seed),plantPlacements(project),PLANT_EQUIPMENT);
}
/** Deterministic no-analog-wire command defaults for the supported P3 models.
 * A missing numeric terminal connection does not mean an arbitrary zero:
 * crane bay 0 is invalid; heater 0°C is below its configured ambient.
 * These values are teaching-model defaults, NOT externally sourced PLC data.
 */
export function defaultUnwiredPlantNumber(
 kind:string,name:string,params:Readonly<Record<string,number>>,
):number{
 if(name==='speed')return params.speedMmS??250;
 if(name==='inletPct')return 100;
 if(name==='bay')return 1;
 if(name==='setpointC')return Math.max(params.ambientC??20,
  Math.min(80,params.maxC??120));
 if(name==='openingPct')return 0;
 return 0;
}

export type PlantTick={runtime:SceneRuntime;events:WorldEvent[]};
export function stepProjectPlant(previous:SceneRuntime,project:ProjectFile,
 energizedLoads:readonly string[],dtMs:number):PlantTick{
 const placements=plantPlacements(project);
 if(!placements.length)return {runtime:previous,events:[]};
 if(dtMs!==50)throw new RangeError('P3 plant world advances by exactly five 10ms substeps per 50ms PLC scan');
 const inputs:Record<string,Record<string,boolean|number>>={};
 const set=new Set(energizedLoads);
 for(const item of placements){
  const def=PLANT_EQUIPMENT[item.kind];
  inputs[item.id]=Object.fromEntries(def.commands.flatMap(ch=>{
   // A missing analogue height channel must remain genuinely ABSENT:
   // the idealized lift models deliberately give explicit discrete UP/DOWN
   // commands precedence only when no numerical height target was supplied.
   // Passing a fabricated numeric zero previously suppressed every UP relay,
   // despite a correctly energized 24V command. This is not an analogue
   // output wiring implementation; PLC AO remains unavailable.
   if(ch.name==='height'&&(item.kind==='lift'||item.kind==='scissor-lift'))
    return [];
   return [[ch.name,ch.kind==='bool'?set.has(item.id+'-CMD_'+ch.name):
    defaultUnwiredPlantNumber(item.kind,ch.name,item.params)]];
  }));
 }
 const updated=stepScene(previous,placements,PLANT_EQUIPMENT,inputs,project.plantFaults??{});
 const drained=drainEvents(updated.world);
 return {runtime:{world:drained.world,signals:updated.signals},events:drained.events};
}
export const sensorImage=(scene:SceneRuntime,componentId:string):LiveSignal=>
 scene.signals[componentId]??{};
