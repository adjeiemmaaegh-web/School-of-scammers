/** Body creation/removal, cap and conservation accounting. */
import type {Body,World,Vec3} from './types';
import {MAX_BODIES} from './types';
import {q,vec} from './math';
import {addEvent} from './events';
export const freshWorld=(seed=1):World=>({
 bodies:[],nextBodyId:1,timeMs:0,rngState:seed===0?0x6d2b79f5:seed>>>0,
 spawnedCount:0,despawnedCount:0,droppedEventCount:0,events:[],model:{},
});
export type SpawnSpec={shape?:'box'|'cylinder';size:Vec3;massKg:number;pos:Vec3;
 yawDeg?:0|90|180|270;tags?:Body['tags'];supportedBy?:string|null};
export function spawnBody(world:World,source:string,spec:SpawnSpec):World{
 if(world.bodies.length>=MAX_BODIES)
  return addEvent(world,{kind:'limit',source,detail:'60-body capacity reached; spawn refused'});
 if(!spec.size||!spec.pos||Object.values(spec.size).some(n=>!Number.isFinite(n)||n<=0||n>5000)||
    Object.values(spec.pos).some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||
    !Number.isFinite(spec.massKg)||spec.massKg<=0||spec.massKg>5000)
  throw new RangeError('Invalid plant body geometry or mass');
 const id='b'+world.nextBodyId;
 const body:Body={id,shape:spec.shape??'box',size:vec(spec.size.x,spec.size.y,spec.size.z),
   massKg:q(spec.massKg),pos:vec(spec.pos.x,spec.pos.y,spec.pos.z),
   yawDeg:spec.yawDeg??0,vel:vec(),supportedBy:spec.supportedBy??null,tags:{...spec.tags}};
 return addEvent({...world,bodies:[...world.bodies,body],nextBodyId:world.nextBodyId+1,
  spawnedCount:world.spawnedCount+1},{kind:'spawn',source,bodyId:id,detail:'Body entered plant'});
}
export function despawnBody(world:World,source:string,id:string):World{
 if(!world.bodies.some(body=>body.id===id))return world;
 return addEvent({...world,bodies:world.bodies.filter(body=>body.id!==id),
  despawnedCount:world.despawnedCount+1},{kind:'despawn',source,bodyId:id,detail:'Body left plant'});
}
export const conserved=(world:World):boolean=>
 world.spawnedCount-world.despawnedCount===world.bodies.length;
