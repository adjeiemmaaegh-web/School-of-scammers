/**
 * One authoritative 50ms PLC scan advances EXACTLY five 10ms substeps.
 * Equipment reads previous settled body/plant state; commands are the mapped PLC
 * output image. No setTimeout, renderer state, Date.now or Math.random.
 */
import type {EquipmentDef,SceneOccluder} from './equipment';
import {ctxOf} from './equipment';
import type {EquipmentPlacement,LiveSignal,World,WorldInputs} from './types';
import {MAX_SCENE_EQUIPMENT,SCAN_MS,SUBSTEP_MS} from './types';
import {advanceBodies} from './physics';
import {q} from './math';

export type EquipmentLibrary=Readonly<Record<string,EquipmentDef>>;
export type SceneRuntime={world:World;signals:Record<string,LiveSignal>};
export const validatePlacements=(placements:readonly EquipmentPlacement[],library:EquipmentLibrary):void=>{
 if(placements.length>MAX_SCENE_EQUIPMENT)throw new RangeError('Too many plant devices');
 const ids=new Set<string>();
 for(const p of placements){
  if(!p||!p.id||!/^[a-z][a-z0-9-]{0,39}$/.test(p.id)||ids.has(p.id)||!library[p.kind])
   throw new Error('Unknown/duplicate plant equipment');
  ids.add(p.id);
  if(![0,90,180,270].includes(p.yawDeg)||!p.originMm||
   Object.values(p.originMm).some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>100000))
   throw new RangeError('Invalid equipment location/orientation');
  const schema=library[p.kind].params;
  for(const [key,value] of Object.entries(p.params??{})){
   const spec=schema.find(s=>s.key===key);
   if(!spec||typeof value!=='number'||!Number.isFinite(value)||value<spec.min||value>spec.max||
      Math.abs(Math.round(value/spec.step)*spec.step-value)>1e-7)
    throw new RangeError('Invalid plant parameter '+key);
  }
 }
};
export const freshRuntime=(world:World,placements:readonly EquipmentPlacement[],library:EquipmentLibrary):SceneRuntime=>{
 validatePlacements(placements,library);
 const model={...world.model};
 for(const item of placements)
  model[item.id]=library[item.kind].fresh(Object.fromEntries(library[item.kind].params.map(spec=>
   [spec.key,item.params[spec.key]??spec.default])));
 const next={...world,model};
 return {world:next,signals:samplePlant(next,placements,library)};
};
export const samplePlant=(world:World,placements:readonly EquipmentPlacement[],library:EquipmentLibrary):Record<string,LiveSignal>=>{
 const signals:Record<string,LiveSignal>={};
 for(const item of placements){
  const def=library[item.kind],state=world.model[item.id]??def.fresh(item.params);
  const actual=def.read(state,world,ctxOf(item));
  for(const channel of def.signals){
   const value=actual[channel.name];
   if(channel.kind==='bool'&&typeof value!=='boolean'||channel.kind==='number'&&
      (typeof value!=='number'||!Number.isFinite(value)))
    throw new TypeError('Plant sensor '+item.id+'.'+channel.name+' has invalid type');
  }
  signals[item.id]=actual;
 }
 return signals;
};
export function stepScene(previous:SceneRuntime,placements:readonly EquipmentPlacement[],
 library:EquipmentLibrary,inputs:WorldInputs={},faults:Readonly<Record<string,string|null>>={}):SceneRuntime{
 validatePlacements(placements,library);
 let world=previous.world;
 // Only explicitly modelled opaque fixed solids cast sight shadows. Belt and
 // roller conveyor envelopes remain non-occluding so mounted sensors work.
 // Footprints come from the authoritative equipment registry, not the renderer.
 const occluders:readonly SceneOccluder[]=placements
  .filter(item=>item.kind==='shelf'||item.kind==='process-tank')
  .map(item=>({id:item.id,originMm:item.originMm,yawDeg:item.yawDeg,
   sizeMm:library[item.kind].footprint}));
 for(let i=0;i<SCAN_MS/SUBSTEP_MS;i++){
  for(const item of placements){
   const def=library[item.kind],ctx=ctxOf(item,occluders);
   const state=world.model[item.id]??def.fresh(item.params);
   const command=inputs[item.id]??{};
   for(const channel of def.commands){
    const value=command[channel.name];
    if(value!==undefined&&(channel.kind==='bool'?typeof value!=='boolean':
      typeof value!=='number'||!Number.isFinite(value)))
      throw new TypeError('Invalid plant command '+item.id+'.'+channel.name);
   }
   const changed=def.step(state,world,command,SUBSTEP_MS,faults[item.id]??null,ctx);
   if(!changed||!changed.state||!changed.world)throw new Error('Equipment step failed '+item.id);
   world={...changed.world,model:{...changed.world.model,[item.id]:changed.state}};
  }
  world=advanceBodies(world,placements,SUBSTEP_MS);
  world={...world,timeMs:q(world.timeMs+SUBSTEP_MS)};
 }
 return {world,signals:samplePlant(world,placements,library)};
}
