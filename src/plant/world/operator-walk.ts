/**
 * R24 simulated human movement. The classroom operator (an explicit, ephemeral training actor, never a camera inference) walks
 * toward a goal at walking speed, one 10 ms substep at a time, and is physically stopped by what stops a person: fence panels,
 * closed guard doors, handrails, shelves, tanks, production stations and every stationary machine (robot, palletizer, crane, mixer, heater...). Platforms and stairs (R20) give the floor a height: the operator can only
 * change level where the floor rises gradually (a stair), never by stepping off an edge, so a handrailed platform is reached
 * only through its stairs. Sensing is position dependent because every sensor reads the operator's actual position and
 * height. Pure and deterministic; educational, not a safety function.
 */
import type {EquipmentPlacement,World} from './types';
import {STATIC_SOLID_KINDS,staticSolidSize} from './solid-geometry';
import {guardWalls} from './guard-walls';
import {q} from './math';

export const WALK_SPEED_MM_S=1200, OPERATOR_RADIUS_MM=200, MAX_SLOPE=0.9;
/** Kinds a person cannot walk through (doors only while they are not fully open). */
const PERSON_BLOCKERS=new Set(['safety-fence','guard-door','handrail']);
type Rect={cx:number;cy:number;hx:number;hy:number};
const rectOf=(item:EquipmentPlacement,length:number,width:number):Rect=>{
 const quarter=item.yawDeg===90||item.yawDeg===270;
 return {cx:item.originMm.x,cy:item.originMm.y,hx:(quarter?width:length)/2,hy:(quarter?length:width)/2};
};
const insideRect=(r:Rect,x:number,y:number,pad=0)=>Math.abs(x-r.cx)<=r.hx+pad&&Math.abs(y-r.cy)<=r.hy+pad;
/** Distance from a point to a rectangle (0 inside). */
const distanceTo=(r:Rect,x:number,y:number):number=>{
 const dx=Math.max(Math.abs(x-r.cx)-r.hx,0),dy=Math.max(Math.abs(y-r.cy)-r.hy,0);
 return Math.hypot(dx,dy);
};
const lengthOf=(item:EquipmentPlacement,fallback:number)=>item.params.lengthMm??fallback;
const widthOf=(item:EquipmentPlacement,fallback:number)=>item.params.widthMm??fallback;

/** Obstacle rectangles for the person right now. */
export function personObstacles(items:readonly EquipmentPlacement[],world:World):Rect[]{
 const out:Rect[]=[];
 for(const item of items){
  if(item.kind==='machine-guard'){
   for(const wall of guardWalls(item))out.push({cx:wall.cx,cy:wall.cy,hx:wall.w/2,hy:wall.d/2});   // the cage walls (the open side lets a person in)
  }else if(PERSON_BLOCKERS.has(item.kind)){
   if(item.kind==='guard-door'&&!(world.model[item.id]?.engaged??true))continue;       // fully open: walk through
   out.push(rectOf(item,lengthOf(item,item.kind==='guard-door'?800:1000),widthOf(item,50)));
  }else if(item.kind==='process-station'){
   // A production station is a machine frame: a person cannot walk through it (its footprint is the station's own, unrotated).
   const L=item.params.lengthMm??400,W=item.params.widthMm??400;
   // A station turned to a free heading blocks the bounding box of its rotated frame (conservative for a person).
   const t=((item.yawDeg+(item.headingDeg??0))%360)*Math.PI/180,c=Math.abs(Math.cos(t)),sn=Math.abs(Math.sin(t));
   out.push(item.headingDeg?{cx:item.originMm.x,cy:item.originMm.y,hx:(c*L+sn*W)/2,hy:(sn*L+c*W)/2}:{cx:item.originMm.x,cy:item.originMm.y,hx:L/2,hy:W/2});
  }else if(item.params.blockMaterialFlow===1||item.kind==='shelf'||item.kind==='process-tank'||STATIC_SOLID_KINDS.includes(item.kind)){
   // R24: every stationary machine (robot, palletizer, crane, mixer, heater, filler, capper, valve...) stops a person as well.
   const size=staticSolidSize(item.kind);
   if(size)out.push(rectOf(item,size.x,size.y));
  }
 }
 return out;
}
/** Height of the floor (mm) under a point: 0, a platform top, or a point on a stair ramp. */
export function floorHeightAt(items:readonly EquipmentPlacement[],x:number,y:number):number{
 let height=0;
 for(const item of items){
  if(item.kind==='platform'){
   const r=rectOf(item,lengthOf(item,1200),widthOf(item,1200));
   if(insideRect(r,x,y))height=Math.max(height,item.params.heightMm??900);
  }else if(item.kind==='stairs'){
   const length=lengthOf(item,1800),width=widthOf(item,900),rise=item.params.heightMm??900;
   const r=rectOf(item,length,width);
   if(!insideRect(r,x,y))continue;
   // The stair rises toward its heading end (yaw 0 = +x, 90 = +y, 180 = -x, 270 = -y).
   const along=item.yawDeg===0?x-r.cx:item.yawDeg===90?y-r.cy:item.yawDeg===180?r.cx-x:r.cy-y;
   const t=Math.max(0,Math.min(1,(along+length/2)/length));
   height=Math.max(height,rise*t);
  }
 }
 return height;
}
const blockedAt=(obstacles:readonly Rect[],x:number,y:number)=>obstacles.some(r=>distanceTo(r,x,y)<OPERATOR_RADIUS_MM);

/** Advance the operator one substep toward the goal; returns the world unchanged when there is nothing to do. */
export function advanceOperator(world:World,items:readonly EquipmentPlacement[],dtMs:number):World{
 const person=world.trainingOperator,goal=world.operatorGoal;
 if(!person||!goal)return world;
 const dx=goal.x-person.pos.x,dy=goal.y-person.pos.y,dist=Math.hypot(dx,dy);
 if(dist<5){const {operatorGoal:_g,...rest}=world;return {...rest,trainingOperator:{...person,vel:{x:0,y:0,z:0}}};}
 const step=Math.min(dist,WALK_SPEED_MM_S*dtMs/1000);
 const ux=dx/dist,uy=dy/dist;
 const obstacles=personObstacles(items,world);
 const stuckInside=blockedAt(obstacles,person.pos.x,person.pos.y);                  // already overlapping: allowed to walk out
 const feetNow=person.pos.z;
 const canStand=(x:number,y:number):boolean=>{
  if(!stuckInside&&blockedAt(obstacles,x,y))return false;
  // Level changes only along a gradual rise: |dz| over the horizontal move must stay under the slope limit.
  const dz=floorHeightAt(items,x,y)-feetNow;
  return Math.abs(dz)<=MAX_SLOPE*step+1e-6;
 };
 // Try the straight move, then slide along each axis (walking along a wall instead of stopping dead).
 const tries:[number,number][]=[[ux*step,uy*step],[Math.sign(ux)*step*Math.min(1,Math.abs(ux)*1.5),0],[0,Math.sign(uy)*step*Math.min(1,Math.abs(uy)*1.5)]];
 for(const [mx,my] of tries){
  if(mx===0&&my===0)continue;
  const nx=person.pos.x+mx,ny=person.pos.y+my;
  if(canStand(nx,ny))return {...world,trainingOperator:{...person,pos:{x:q(nx),y:q(ny),z:q(floorHeightAt(items,nx,ny))},vel:{x:q(mx*1000/dtMs),y:q(my*1000/dtMs),z:0}}};
 }
 return {...world,trainingOperator:{...person,vel:{x:0,y:0,z:0}}};
}
