/**
 * Deterministic teaching physics: carry, axis-aligned contact/queue, gravity,
 * simplified push and stack. NO unconstrained rigid-body/contact solver.
 */
import type {Body,EquipmentPlacement,EquipmentState,World,Vec3} from './types';
import {G_MM_S2} from './types';
import {clamp,face,insideFootprint,q,vec} from './math';
import {addEvent} from './events';
import {newlyContactsStaticSolid,staticSolidSize} from './solid-geometry';
import {bodiesTouch,isComposite,supportTopAt,sweptContact,tipOver,tipSpeed,volumeOverlap} from './geometry';

/**
 * Rigid-body tipping on a sudden stop: a body travelling faster than its tip speed that is stopped dead by a stopper, solid or
 * another body falls over about its leading edge (see geometry.tipSpeed). Mutates the body; returns true when it tipped.
 */
const tipIfFastStop=(body:Body,vx:number,vy:number):boolean=>{
 const speed=Math.hypot(vx,vy);
 if(body.tags.tipped||speed<1)return false;
 const dir={x:vx/speed,y:vy/speed};
 if(speed<=tipSpeed(body,dir))return false;
 Object.assign(body,tipOver(body,dir));
 return true;
};
const frictionOf=(b:Body):number=>typeof b.tags.frictionMu==='number'?b.tags.frictionMu:.4;
const CARRIERS=new Set(['belt-conveyor','roller-conveyor','turntable','lift','scissor-lift',
 'pick-and-place','palletizer','asrs-crane']);
const BLOCKERS=new Set(['stopper','diverter-gate','safety-fence','guard-door']);
const clampVelocity=(value:number,target:number,dtMs:number,accel=3500):number=>
 q(value+clamp(target-value,-accel*dtMs/1000,accel*dtMs/1000));
const baseHeight=(item:EquipmentPlacement,state:EquipmentState):number=>
 item.kind==='lift'||item.kind==='scissor-lift'?Math.max(0,state.positionMm):item.originMm.z+120;
/** Degrees of incline of a belt (0 for everything else): the belt rises toward its heading end. */
const inclineOf=(item:EquipmentPlacement):number=>item.kind==='belt-conveyor'?(item.params.inclineDeg??0):0;
/** Height of the carrying surface under a point: flat for most equipment, a ramp for an inclined belt. */
const surfaceHeight=(item:EquipmentPlacement,state:EquipmentState,pos:Vec3):number=>{
 const base=baseHeight(item,state),deg=inclineOf(item);
 if(!deg)return base;
 const length=item.params.lengthMm??600,dir=face(item.yawDeg);
 const along=clamp((pos.x-item.originMm.x)*dir.x+(pos.y-item.originMm.y)*dir.y+length/2,0,length);
 return base+along*Math.tan(deg*Math.PI/180);
};
/** Equipment length/width are local axes; 90/270 degree yaw swaps world-space footprint. */
const worldFootprint=(item:EquipmentPlacement,length:number,width:number):Vec3=>
 item.yawDeg===90||item.yawDeg===270?vec(width,length,0):vec(length,width,0);
function chooseCarrier(body:Body,items:readonly EquipmentPlacement[],states:World['model']):EquipmentPlacement|undefined{
 return items.find(item=>CARRIERS.has(item.kind)&&insideFootprint(body.pos,item.originMm,
  worldFootprint(item,item.params.lengthMm??600,item.params.widthMm??300)) &&
  Math.abs(body.pos.z-surfaceHeight(item,states[item.id],body.pos))<150);
}
function collide(body:Body,candidates:readonly Body[],move:Vec3,
 swept3D=false):{delta:Vec3;blocked:boolean;blockedByBodyId:string|null}{
 let x=move.x,y=move.y,blocked=false,blockedByBodyId:string|null=null;
 for(const other of candidates){
  if(other.id===body.id)continue;
  const shifted={...body,pos:{...body.pos,x:q(body.pos.x+x),y:q(body.pos.y+y)}};
  if(swept3D){
   // Broad-phase swept 3D bounds account for quarter-turn footprint and
   // actual vertical separation. Already-overlapping legacy starts are
   // handled by the old endpoint queue test to avoid drawing cargo through.
   const contact=sweptContact(body,other,vec(x,y,0));
   if(contact===null&&!volumeOverlap(shifted,other))continue;
  }else{
   if(Math.abs(other.pos.z-body.pos.z)>Math.min(body.size.z,other.size.z))continue;
   if(!bodiesTouch(shifted,other))continue;
  }
  // The cheaper/simpler contact solver keeps previous motion axis if another body occupies its destination.
  x=0;y=0;blocked=true;blockedByBodyId=other.id;break;
 }
 return {delta:vec(x,y,move.z),blocked,blockedByBodyId};
}
/** Test hook (R10): disabling the broad phase restores the brute-force candidate list, the reference that differential tests compare against. */
export const PHYSICS_DEBUG={broadPhase:true};
/** One 10ms integration step; stable body ID order prevents nondeterministic contact resolution. */
export function advanceBodies(world:World,items:readonly EquipmentPlacement[],dtMs=10):World{
 if(dtMs!==10)throw new RangeError('Plant physics must use 10ms substeps');
 const sorted=[...world.bodies].sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
 const next:Body[]=[];
 let changed:World=world;
 // Per-substep lookups built once (R10): first match wins, exactly like the linear searches they replace.
 const itemById=new Map<string,EquipmentPlacement>();
 for(const item of items)if(!itemById.has(item.id))itemById.set(item.id,item);
 const blockers=items.filter(item=>BLOCKERS.has(item.kind));
 const solids=items.filter(item=>item.params.blockMaterialFlow===1&&staticSolidSize(item.kind)!==null);
 // Uniform-grid broad phase. Only bodies within one grid cell (cell >= largest body dimension + a movement margin) can touch,
 // so far-away bodies are skipped; candidates are still visited in the original order, so contact results are unchanged.
 let maxExtent=0;
 for(const b of sorted)maxExtent=Math.max(maxExtent,b.size.x,b.size.y,b.size.z);
 const cell=Math.max(200,maxExtent+100);
 const cellKey=(x:number,y:number)=>Math.floor(x/cell)+','+Math.floor(y/cell);
 const grid=new Map<string,number[]>();
 sorted.forEach((b,index)=>{const k=cellKey(b.pos.x,b.pos.y);const list=grid.get(k);if(list)list.push(index);else grid.set(k,[index]);});
 const nearby=(body:Body,self:number):Body[]=>{
  if(!PHYSICS_DEBUG.broadPhase)return [...next,...sorted.slice(self+1)];
  const cx=Math.floor(body.pos.x/cell),cy=Math.floor(body.pos.y/cell);
  const indices:number[]=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   const list=grid.get((cx+dx)+','+(cy+dy));
   if(list)for(const index of list)if(index!==self)indices.push(index);
  }
  indices.sort((a,b)=>a-b);
  // Bodies already stepped this substep are read from `next`, the rest from `sorted`: the same order as before.
  return indices.map(index=>index<self?next[index]:sorted[index]);
 };
 for(let cur=0;cur<sorted.length;cur++){
  const original=sorted[cur];
  const prior=original;
  let body={...prior,pos:{...prior.pos},vel:{...prior.vel}};
  // The gantry, arm and palletizer have already advanced a *gripped*
  // physical body in their own worker-owned model step. Treat that body as
  // positively restrained; conveyor-gravity integration must not overwrite
  // its XYZ position, detach it, or snap it to the 120 mm carrier surface.
  // A release immediately disables this exception on the next substep.
  const grip=body.supportedBy?itemById.get(body.supportedBy):undefined;
  // The bounded pallet-pattern model represents an already-placed package as
  // supported by the palletizer's stable pallet/stack frame. Do not reclassify
  // it as an ordinary moving conveyor load or let gravity erase its counted
  // layer. Its original spawn ID and conservation accounting are unchanged.
  if(grip?.kind==='palletizer'&&body.tags.palletized===true){
   body.vel=vec();next.push(body);continue;
  }
  if(grip&&['pick-and-place','robot-arm','palletizer'].includes(grip.kind)&&
   world.model[grip.id]?.heldBodyId===body.id){
   body.vel=vec();
   next.push(body);
   continue;
  }
  let carrier=body.supportedBy?itemById.get(body.supportedBy):undefined;
  if(!carrier||!CARRIERS.has(carrier.kind))carrier=chooseCarrier(body,items,world.model);
  const state=carrier?world.model[carrier.id]:undefined;
  if(carrier&&state){
   // Turning a loaded turntable changes the carried body's velocity direction
   // after the real modeled transfer, not merely the appearance of its mesh.
   const travelYaw=carrier.kind==='turntable'&&state.done
     ? (carrier.yawDeg+90)%360 : carrier.yawDeg;
   const direction=face(travelYaw);
   // During P8 worker-timed table indexing, carried parcels rotate about
   // the fixed turntable centre; translation is temporarily locked. Prior
   // projects without the explicit opt-in retain legacy conveying behavior.
   const turning=carrier.kind==='turntable'&&carrier.params.rotateCargo===1&&
    state.progress>0&&!state.done;
   const speed=state.engaged&&!turning?state.speedMmS:0;
   const targetX=direction.x*speed,targetY=direction.y*speed;
   // Once a P20 physical obstruction has tripped its source belt, actual
   // carrier velocity is zero, not merely a gradually easing UI animation.
   const mechanicallyStopped=carrier.kind==='belt-conveyor'&&
    state.stalled&&(carrier.params.obstructionTripMode===1||
    carrier.params.accumulationTripMode===1);
   // Catalogue materials carry a static friction coefficient: the belt can accelerate a load by at most mu x g, so a
   // slippery glass bottle takes longer to reach belt speed than a carton. Legacy bodies (no frictionMu) keep 3500 mm/s2.
   const mu=body.tags.frictionMu;
   let pull=typeof mu==='number'&&mu>0?mu*G_MM_S2:undefined;
   let aimX=targetX,aimY=targetY;
   const slope=inclineOf(carrier);
   if(slope>0){
    // Inclined belt: friction must overcome the slope. Climbing accelerates at g(mu cos - sin); if that is not positive
    // the load slides back down regardless of belt motion (a slippery bottle slides where a carton climbs).
    const theta=slope*Math.PI/180,muEff=typeof mu==='number'&&mu>0?mu:3500/G_MM_S2;
    const uphill=state.speedMmS>=0;
    const net=G_MM_S2*(uphill?muEff*Math.cos(theta)-Math.sin(theta):muEff*Math.cos(theta)+Math.sin(theta));
    if(net>0)pull=net;
    else{
     pull=G_MM_S2*(Math.sin(theta)-muEff*Math.cos(theta));
     aimX=-direction.x*400;aimY=-direction.y*400;
    }
   }
   body.vel.x=mechanicallyStopped?0:clampVelocity(body.vel.x,aimX,dtMs,pull);
   body.vel.y=mechanicallyStopped?0:clampVelocity(body.vel.y,aimY,dtMs,pull);
   body.vel.z=0;
   body.supportedBy=carrier.id;
   body.pos.z=q(surfaceHeight(carrier,state,body.pos));
   // A locked gate or extended stopper obstructs travel rather than teleporting cargo.
   const proposed=vec(body.vel.x*dtMs/1000,body.vel.y*dtMs/1000,0);
   const blockingGate=blockers.find(item=>world.model[item.id]?.engaged&&
    insideFootprint({x:body.pos.x+proposed.x,y:body.pos.y+proposed.y,z:body.pos.z},
     item.originMm,worldFootprint(item,Math.max(50,item.params.lengthMm??80),
      Math.max(50,item.params.widthMm??200))));
   const blocked=!!blockingGate;
   const moved={...body,pos:vec(body.pos.x+proposed.x,body.pos.y+proposed.y,body.pos.z)};
   const solidBlocked=newlyContactsStaticSolid(body,moved,solids);
   // A P20 gate trip has ALREADY been witnessed by the worker physics and
   // latched by the source belt on the prior substep. While the belt is
   // physically stopped at the contact boundary, proposed travel is zero;
   // testing only this zero-length move would falsely clear the original
   // jam provenance and make sensor/body evidence inconsistent. Preserve the
   // real original contact ID until an authenticated post-clearance reset
   // restarts motion; then normal collision physics removes the tags.
   if(mechanicallyStopped&&state.obstructionBodyId===body.id&&
      typeof state.obstructionGateId==='string'){
    body.vel.x=0;body.vel.y=0;
    body.tags={...body.tags,jammed:true,
     jammedByGate:state.obstructionGateId};
   }else if(mechanicallyStopped&&state.accumulationBlockingBodyId===body.id&&
      typeof prior.tags.jammedByGate==='string'&&
      world.model[prior.tags.jammedByGate]?.engaged===true){
    // Original lead carton stays physically against its original STOPPER
    // during a following body's accumulated drive-trip. Do not delete this
    // provenance solely because a stopped belt proposes zero translation.
    body.vel.x=0;body.vel.y=0;
    body.tags={...body.tags,jammed:true,
     jammedByGate:prior.tags.jammedByGate};
   }else if(mechanicallyStopped&&state.accumulationBodyId===body.id&&
      typeof state.accumulationBlockingBodyId==='string'){
    // The original queued body/leader pair is a physical contact witness.
    // A stopped carrier proposes zero travel; do not erase that witness
    // until the leader is moved off the lane and a fresh PLC reset is issued.
    body.vel.x=0;body.vel.y=0;
    body.tags={...body.tags,jammed:true,
     jammedByBody:state.accumulationBlockingBodyId};
   }else if(blocked||solidBlocked){
    const tipped=tipIfFastStop(body,body.vel.x,body.vel.y);
    body.vel.x=0;body.vel.y=0;
    const tags:Body['tags']={...body.tags,jammed:true};
    if(tipped)changed=addEvent(changed,{kind:'contact',source:carrier.id,bodyId:body.id,detail:'Body tipped over on sudden stop'});
    if(blockingGate)tags.jammedByGate=blockingGate.id;
    else delete tags.jammedByGate;
    delete tags.jammedByBody;
    body.tags=tags;
    if(!prior.tags.jammed)changed=addEvent(changed,{kind:'jam',source:carrier.id,bodyId:body.id,
     detail:solidBlocked?'Body contacted a fixed solid':
      'Body '+body.id+' physically blocked by extended gate '+(blockingGate?.id??'unknown')});
   }else{
    const contact=collide(body,nearby(body,cur),proposed,
      carrier.params.contactMode===1);
    if(contact.blocked){
     const tipped=tipIfFastStop(body,body.vel.x,body.vel.y);
     if(tipped)changed=addEvent(changed,{kind:'contact',source:carrier.id,bodyId:body.id,detail:'Body tipped over on sudden stop'});
     body.vel.x=0;body.vel.y=0;const tags:Body['tags']={...body.tags,jammed:true};
     delete tags.jammedByGate;
     if(contact.blockedByBodyId)tags.jammedByBody=contact.blockedByBodyId;
     else delete tags.jammedByBody;
     body.tags=tags;
     if(!prior.tags.jammed)changed=addEvent(changed,{kind:'jam',source:carrier.id,bodyId:body.id,detail:'Body accumulated behind another body'});
    }else{
     body.pos.x=q(body.pos.x+contact.delta.x);body.pos.y=q(body.pos.y+contact.delta.y);
     if(prior.tags.jammed){const tags={...body.tags};
      delete tags.jammed;delete tags.jammedByGate;
      delete tags.jammedByBody;body.tags=tags;}
    }
   }
   if(!insideFootprint(body.pos,carrier.originMm,
     worldFootprint(carrier,carrier.params.lengthMm??600,carrier.params.widthMm??300))){
    body.supportedBy=null;body.vel.z=0;
   }
  }else{
   body.supportedBy=null;
   const onFloor=body.pos.z===0&&body.vel.z===0;
   body.vel.z=q(Math.max(-2000,body.vel.z-G_MM_S2*dtMs/1000));
   let moveX=body.vel.x*dtMs/1000,moveY=body.vel.y*dtMs/1000;
   if(onFloor&&body.tags.floorDynamics===true&&(body.vel.x!==0||body.vel.y!==0)){
    // Opt-in (tag floorDynamics): a legacy body leaving a belt keeps coasting to its collector exactly as before. A body sliding on the floor: Coulomb friction brings it to rest, and it pushes what it meets (inelastic impact: the two
    // share momentum along the line of travel). Bodies at rest or carried by equipment never reach this code.
    const speed=Math.hypot(body.vel.x,body.vel.y);
    const slowed=Math.max(0,speed-frictionOf(body)*G_MM_S2*dtMs/1000),k=speed>0?slowed/speed:0;
    body.vel.x=q(body.vel.x*k);body.vel.y=q(body.vel.y*k);
    if(slowed<1){body.vel.x=0;body.vel.y=0;}
    moveX=body.vel.x*dtMs/1000;moveY=body.vel.y*dtMs/1000;
    if(moveX!==0||moveY!==0){
     const hit=collide(body,nearby(body,cur),vec(moveX,moveY,0),true);
     if(hit.blocked&&hit.blockedByBodyId){
      const idx=sorted.findIndex(o=>o.id===hit.blockedByBodyId);
      const other=idx<cur?next[idx]:sorted[idx];
      if(other&&!other.supportedBy&&other.pos.z===body.pos.z&&!(other.tags.palletized)){
       const m1=body.massKg,m2=other.massKg,common={x:(m1*body.vel.x+m2*other.vel.x)/(m1+m2),y:(m1*body.vel.y+m2*other.vel.y)/(m1+m2)};
       const pushed={...other,vel:vec(q(common.x),q(common.y),0)};
       if(idx<cur)next[idx]=pushed;else sorted[idx]=pushed;
       body.vel.x=q(common.x);body.vel.y=q(common.y);
       changed=addEvent(changed,{kind:'contact',source:body.id,bodyId:other.id,detail:'Sliding body pushed '+other.id});
      }else{body.vel.x=0;body.vel.y=0;}
      moveX=0;moveY=0;
     }
    }
   }
   body.pos=qPosition({...body.pos,x:body.pos.x+moveX,y:body.pos.y+moveY,z:Math.max(0,body.pos.z+body.vel.z*dtMs/1000)});
   if(body.pos.z===0)body.vel.z=0;
  }
  // Simple vertical stack: a body can rest on another with 60% overlap and
  // approximate centre-of-mass support; otherwise it falls, never floats.
  if(!body.supportedBy&&body.pos.z>0){
   // Plain bodies keep the original rule (a body resting within 30% of the centre of the one below). A COMPOSITE body
   // supports only where it actually has material under the point: its pallet deck, its low arm, its tower, never a gap.
   let supportTop=0;
   const support=[...next,...sorted.filter(o=>o.id!==body.id)].find(other=>{
    if(other.id===body.id)return false;
    if(isComposite(other)){
     const top=supportTopAt(other,body.pos.x,body.pos.y);
     if(top===null||Math.abs(top-body.pos.z)>=15)return false;
     supportTop=top;return true;
    }
    if(Math.abs(other.pos.z+other.size.z-body.pos.z)<15&&
     Math.abs(other.pos.x-body.pos.x)<=other.size.x*.30&&
     Math.abs(other.pos.y-body.pos.y)<=other.size.y*.30){supportTop=other.pos.z+other.size.z;return true;}
    return false;
   });
   if(support){body.supportedBy=support.id;body.pos.z=q(supportTop);body.vel.z=0;}
  }
  body.pos=qPosition(body.pos);
  next.push(body);
 }
 return {...changed,bodies:next};
}
const qPosition=(v:Vec3):Vec3=>vec(v.x,v.y,v.z);
