/**
 * Deterministic teaching physics: carry, axis-aligned contact/queue, gravity,
 * simplified push and stack. NO unconstrained rigid-body/contact solver.
 */
import type {Body,EquipmentPlacement,EquipmentState,World,Vec3} from './types';
import {G_MM_S2} from './types';
import {clamp,face,footprintOverlap,insideFootprint,q,vec} from './math';
import {addEvent} from './events';
import {newlyContactsStaticSolid} from './solid-geometry';
import {sweptBodyContact} from './swept-contact';

const CARRIERS=new Set(['belt-conveyor','roller-conveyor','turntable','lift','scissor-lift',
 'pick-and-place','palletizer','asrs-crane']);
const BLOCKERS=new Set(['stopper','diverter-gate']);
const clampVelocity=(value:number,target:number,dtMs:number,accel=3500):number=>
 q(value+clamp(target-value,-accel*dtMs/1000,accel*dtMs/1000));
const baseHeight=(item:EquipmentPlacement,state:EquipmentState):number=>
 item.kind==='lift'||item.kind==='scissor-lift'?Math.max(0,state.positionMm):item.originMm.z+120;
/** Equipment length/width are local axes; 90/270 degree yaw swaps world-space footprint. */
const worldFootprint=(item:EquipmentPlacement,length:number,width:number):Vec3=>
 item.yawDeg===90||item.yawDeg===270?vec(width,length,0):vec(length,width,0);
function chooseCarrier(body:Body,items:readonly EquipmentPlacement[],states:World['model']):EquipmentPlacement|undefined{
 return items.find(item=>CARRIERS.has(item.kind)&&insideFootprint(body.pos,item.originMm,
  worldFootprint(item,item.params.lengthMm??600,item.params.widthMm??300)) &&
  Math.abs(body.pos.z-baseHeight(item,states[item.id]))<150);
}
function collide(body:Body,candidates:readonly Body[],move:Vec3,
 swept3D=false):{delta:Vec3;blocked:boolean}{
 let x=move.x,y=move.y,blocked=false;
 for(const other of candidates){
  if(other.id===body.id)continue;
  const shifted={...body,pos:{...body.pos,x:q(body.pos.x+x),y:q(body.pos.y+y)}};
  if(swept3D){
   // Broad-phase swept 3D bounds account for quarter-turn footprint and
   // actual vertical separation. Already-overlapping legacy starts are
   // handled by the old endpoint queue test to avoid drawing cargo through.
   const contact=sweptBodyContact(body,other,vec(x,y,0));
   const initial=sweptBodyContact(body,other,vec(0,0,0));
   if(contact===null&&initial===null&&
      !(Math.abs(other.pos.z-body.pos.z)<Math.min(body.size.z,other.size.z)&&
        footprintOverlap(shifted,other)))continue;
  }else{
   if(Math.abs(other.pos.z-body.pos.z)>Math.min(body.size.z,other.size.z))continue;
   if(!footprintOverlap(shifted,other))continue;
  }
  // The cheaper/simpler contact solver keeps previous motion axis if another body occupies its destination.
  x=0;y=0;blocked=true;break;
 }
 return {delta:vec(x,y,move.z),blocked};
}
/** One 10ms integration step; stable body ID order prevents nondeterministic contact resolution. */
export function advanceBodies(world:World,items:readonly EquipmentPlacement[],dtMs=10):World{
 if(dtMs!==10)throw new RangeError('Plant physics must use 10ms substeps');
 const sorted=[...world.bodies].sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
 const next:Body[]=[];
 let changed:World=world;
 for(const original of sorted){
  const prior=original;
  let body={...prior,pos:{...prior.pos},vel:{...prior.vel}};
  let carrier=body.supportedBy?items.find(item=>item.id===body.supportedBy):undefined;
  if(!carrier||!CARRIERS.has(carrier.kind))carrier=chooseCarrier(body,items,world.model);
  const state=carrier?world.model[carrier.id]:undefined;
  if(carrier&&state){
   // Turning a loaded turntable changes the carried body's velocity direction
   // after the real modeled transfer, not merely the appearance of its mesh.
   const travelYaw=carrier.kind==='turntable'&&state.done
     ? (carrier.yawDeg+90)%360 : carrier.yawDeg;
   const direction=face(travelYaw);
   const speed=state.engaged?state.speedMmS:0;
   const targetX=direction.x*speed,targetY=direction.y*speed;
   body.vel.x=clampVelocity(body.vel.x,targetX,dtMs);
   body.vel.y=clampVelocity(body.vel.y,targetY,dtMs);
   body.vel.z=0;
   body.supportedBy=carrier.id;
   body.pos.z=q(baseHeight(carrier,state));
   // A locked gate or extended stopper obstructs travel rather than teleporting cargo.
   const proposed=vec(body.vel.x*dtMs/1000,body.vel.y*dtMs/1000,0);
   const blocked=items.some(item=>BLOCKERS.has(item.kind)&&world.model[item.id]?.engaged&&
    insideFootprint({x:body.pos.x+proposed.x,y:body.pos.y+proposed.y,z:body.pos.z},
     item.originMm,worldFootprint(item,Math.max(50,item.params.lengthMm??80),
      Math.max(50,item.params.widthMm??200))));
   const moved={...body,pos:vec(body.pos.x+proposed.x,body.pos.y+proposed.y,body.pos.z)};
   const solidBlocked=newlyContactsStaticSolid(body,moved,items);
   if(blocked||solidBlocked){
    body.vel.x=0;body.vel.y=0;body.tags={...body.tags,jammed:true};
    if(!prior.tags.jammed)changed=addEvent(changed,{kind:'jam',source:carrier.id,bodyId:body.id,
     detail:solidBlocked?'Body contacted a fixed solid':'Body blocked by a gate'});
   }else{
    const contact=collide(body,[...next,...sorted.filter(o=>Number(o.id.slice(1))>Number(body.id.slice(1)))],proposed,
      carrier.params.contactMode===1);
    if(contact.blocked){
     body.vel.x=0;body.vel.y=0;body.tags={...body.tags,jammed:true};
     if(!prior.tags.jammed)changed=addEvent(changed,{kind:'jam',source:carrier.id,bodyId:body.id,detail:'Body accumulated behind another body'});
    }else{
     body.pos.x=q(body.pos.x+contact.delta.x);body.pos.y=q(body.pos.y+contact.delta.y);
     if(prior.tags.jammed){const tags={...body.tags};delete tags.jammed;body.tags=tags;}
    }
   }
   if(!insideFootprint(body.pos,carrier.originMm,
     worldFootprint(carrier,carrier.params.lengthMm??600,carrier.params.widthMm??300))){
    body.supportedBy=null;body.vel.z=0;
   }
  }else{
   body.supportedBy=null;
   body.vel.z=q(Math.max(-2000,body.vel.z-G_MM_S2*dtMs/1000));
   body.pos=qPosition({...body.pos,x:body.pos.x+body.vel.x*dtMs/1000,
    y:body.pos.y+body.vel.y*dtMs/1000,z:Math.max(0,body.pos.z+body.vel.z*dtMs/1000)});
   if(body.pos.z===0)body.vel.z=0;
  }
  // Simple vertical stack: a body can rest on another with 60% overlap and
  // approximate centre-of-mass support; otherwise it falls, never floats.
  if(!body.supportedBy&&body.pos.z>0){
   const support=[...next,...sorted.filter(o=>o.id!==body.id)].find(other=>
    other.id!==body.id&&Math.abs(other.pos.z+other.size.z-body.pos.z)<15&&
    Math.abs(other.pos.x-body.pos.x)<=other.size.x*.30&&
    Math.abs(other.pos.y-body.pos.y)<=other.size.y*.30);
   if(support){body.supportedBy=support.id;body.pos.z=q(support.pos.z+support.size.z);body.vel.z=0;}
  }
  body.pos=qPosition(body.pos);
  next.push(body);
 }
 return {...changed,bodies:next};
}
const qPosition=(v:Vec3):Vec3=>vec(v.x,v.y,v.z);
