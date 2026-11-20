/**
 * Composite body geometry (R02). A body may consist of several box/cylinder PARTS (see BodyPart); every contact, stacking and
 * sensing query that matters for shape goes through these helpers. A body without parts is exactly the single box it always
 * was, and every helper then defers to the original single-box code path, so nothing saved or tested earlier changes.
 * Cylinders are treated by their circumscribed square in box tests (as the rest of the teaching physics does) except in the
 * sensor ray casts, which intersect their true circle.
 */
import type {Body,BodyPart,Vec3} from './types';
import {footprintOverlap} from './math';
import {bodyVolumeOverlap,sweptBodyContact,sweptBoxEntry} from './swept-contact';

export type PartBox={center:Vec3;half:Vec3;shape:'box'|'cylinder'};
export const isComposite=(b:Body):boolean=>!!b.parts&&b.parts.length>0;
export const partsOf=(b:Body):readonly BodyPart[]=>
 isComposite(b)?b.parts!:[{dx:0,dy:0,z:0,sx:b.size.x,sy:b.size.y,sz:b.size.z,shape:b.shape}];
const rotate=(dx:number,dy:number,yaw:number):[number,number]=>
 yaw===90?[-dy,dx]:yaw===180?[-dx,-dy]:yaw===270?[dy,-dx]:[dx,dy];
/** Every part as a world-space axis-aligned box (quarter-turn yaw, as elsewhere in the plant model). */
export function partBoxes(b:Body):PartBox[]{
 const quarter=b.yawDeg===90||b.yawDeg===270;
 return partsOf(b).map(p=>{
  const [rx,ry]=rotate(p.dx,p.dy,b.yawDeg);
  return {center:{x:b.pos.x+rx,y:b.pos.y+ry,z:b.pos.z+p.z+p.sz/2},
   half:{x:(quarter?p.sy:p.sx)/2,y:(quarter?p.sx:p.sy)/2,z:p.sz/2},shape:p.shape??'box'};
 });
}
const TOL=1e-8;
const boxesOverlapXY=(a:PartBox,b:PartBox,margin:number):boolean=>
 Math.abs(a.center.x-b.center.x)<a.half.x+b.half.x+margin&&Math.abs(a.center.y-b.center.y)<a.half.y+b.half.y+margin;
const boxesOverlapZ=(a:PartBox,b:PartBox):boolean=>Math.abs(a.center.z-b.center.z)<a.half.z+b.half.z-TOL;

/** Footprint contact: the original rule for plain bodies; part-by-part (footprint AND height) for composites. */
export function bodiesTouch(a:Body,b:Body,margin=0):boolean{
 if(!isComposite(a)&&!isComposite(b))return footprintOverlap(a,b,margin);
 const bs=partBoxes(b);
 return partBoxes(a).some(x=>bs.some(y=>boxesOverlapXY(x,y,-margin)&&boxesOverlapZ(x,y)));
}
/** Full 3D volume overlap, part by part for composites. */
export function volumeOverlap(a:Body,b:Body):boolean{
 if(!isComposite(a)&&!isComposite(b))return bodyVolumeOverlap(a,b);
 const bs=partBoxes(b);
 return partBoxes(a).some(x=>bs.some(y=>Math.abs(x.center.x-y.center.x)<x.half.x+y.half.x-TOL&&
  Math.abs(x.center.y-y.center.y)<x.half.y+y.half.y-TOL&&Math.abs(x.center.z-y.center.z)<x.half.z+y.half.z-TOL));
}
/** Earliest path fraction of full 3D contact when `a` moves by `delta`, part by part for composites. */
export function sweptContact(a:Body,b:Body,delta:Vec3):number|null{
 if(a.id===b.id)return null;
 if(!isComposite(a)&&!isComposite(b))return sweptBodyContact(a,b,delta);
 const bs=partBoxes(b);
 let best:number|null=null;
 for(const x of partBoxes(a))for(const y of bs){
  const t=sweptBoxEntry({center:x.center,half:x.half},{center:y.center,half:y.half},delta);
  if(t!==null&&(best===null||t<best))best=t;
 }
 return best;
}
/**
 * Height of the highest solid under a point of a COMPOSITE body (null where there is nothing: a gap, a notch). Callers use
 * the original single-box rule for plain bodies.
 */
export function supportTopAt(b:Body,x:number,y:number):number|null{
 let top:number|null=null;
 for(const p of partBoxes(b)){
  if(Math.abs(x-p.center.x)<=p.half.x&&Math.abs(y-p.center.y)<=p.half.y){
   const t=p.center.z+p.half.z;
   if(top===null||t>top)top=t;
  }
 }
 return top;
}
