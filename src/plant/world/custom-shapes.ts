/**
 * Learner-authored composite shapes (R02). A learner describes a workpiece as up to 8 solid blocks in their own coordinates
 * (millimetres, corner origin); `composeShape` validates it and turns it into an ordinary MaterialSpec whose parts are
 * re-centred on the envelope, so it spawns, collides, stacks, rotates and is sensed exactly like the catalogue composites.
 * Pure and deterministic. Persisting shapes in the project file and the editor UI are separate work (see the register).
 */
import type {BodyPart,BodyShape} from './types';
import {vec} from './math';
import {MATERIALS} from './materials';
import type {MaterialCategory,MaterialSpec} from './materials';

export type ShapeBlock={x:number;y:number;z:number;w:number;d:number;h:number;shape?:BodyShape};
export type CustomShapeDef={
 id:string;label:string;blocks:readonly ShapeBlock[];massKg:number;frictionMu?:number;
 category?:MaterialCategory;optical?:'opaque'|'transparent'|'reflective';conductive?:boolean;
};
export const MAX_SHAPE_BLOCKS=8;
const finite=(...n:number[]):boolean=>n.every(Number.isFinite);

/** Every reason the definition cannot be used (empty when valid). */
export function shapeErrors(def:CustomShapeDef):string[]{
 const errors:string[]=[];
 if(!/^[a-z0-9][a-z0-9-]{0,31}$/.test(def.id))errors.push('id must be 1-32 lowercase letters, digits or hyphens');
 else if(MATERIALS.some(m=>m.id===def.id))errors.push('id "'+def.id+'" is already a catalogue material');
 if(!def.label||def.label.length>60)errors.push('label must be 1-60 characters');
 if(!Array.isArray(def.blocks)||def.blocks.length<1||def.blocks.length>MAX_SHAPE_BLOCKS)
  errors.push('a shape needs 1-'+MAX_SHAPE_BLOCKS+' blocks');
 else{
  def.blocks.forEach((b,i)=>{
   if(!b||!finite(b.x,b.y,b.z,b.w,b.d,b.h)||b.w<=0||b.d<=0||b.h<=0||b.w>5000||b.d>5000||b.h>5000||Math.abs(b.x)>5000||Math.abs(b.y)>5000||Math.abs(b.z)>5000)
    errors.push('block '+(i+1)+' has a non-finite, non-positive or oversized dimension');
  });
  if(!errors.length&&!connected(def.blocks))errors.push('blocks must touch or overlap so the part is one solid piece');
  if(!errors.length){
   const [lo,hi]=extent(def.blocks);
   if(hi[0]-lo[0]>5000||hi[1]-lo[1]>5000||hi[2]-lo[2]>5000)errors.push('the overall envelope exceeds 5000 mm');
  }
 }
 if(!finite(def.massKg)||def.massKg<0.01||def.massKg>5000)errors.push('mass must be 0.01-5000 kg');
 if(def.frictionMu!==undefined&&(!finite(def.frictionMu)||def.frictionMu<0.05||def.frictionMu>1))errors.push('friction must be 0.05-1');
 return errors;
}
const extent=(blocks:readonly ShapeBlock[]):[number[],number[]]=>[
 [Math.min(...blocks.map(b=>b.x)),Math.min(...blocks.map(b=>b.y)),Math.min(...blocks.map(b=>b.z))],
 [Math.max(...blocks.map(b=>b.x+b.w)),Math.max(...blocks.map(b=>b.y+b.d)),Math.max(...blocks.map(b=>b.z+b.h))]];
/** Blocks are one piece when face contact or overlap links them all (union-find over pairs). */
function connected(blocks:readonly ShapeBlock[]):boolean{
 const parent=blocks.map((_,i)=>i);
 const find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const eps=1e-6;
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  const a=blocks[i],b=blocks[j];
  if(a.x<=b.x+b.w+eps&&b.x<=a.x+a.w+eps&&a.y<=b.y+b.d+eps&&b.y<=a.y+a.d+eps&&a.z<=b.z+b.h+eps&&b.z<=a.z+a.h+eps)parent[find(i)]=find(j);
 }
 return blocks.every((_,i)=>find(i)===find(0));
}
/** The validated shape as a spawnable material. Throws RangeError listing every problem when invalid. */
export function composeShape(def:CustomShapeDef):MaterialSpec{
 const errors=shapeErrors(def);
 if(errors.length)throw new RangeError('Invalid custom shape: '+errors.join('; '));
 const [lo,hi]=extent(def.blocks);
 const cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2;
 const parts:BodyPart[]=def.blocks.map(b=>({dx:b.x+b.w/2-cx,dy:b.y+b.d/2-cy,z:b.z-lo[2],sx:b.w,sy:b.d,sz:b.h,...(b.shape==='cylinder'?{shape:'cylinder' as const}:{})}));
 return {id:def.id,label:def.label,category:def.category??'workpiece',shape:'box',sizeMm:vec(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]),
  massKg:def.massKg,frictionMu:def.frictionMu??.4,conductive:def.conductive??false,optical:def.optical??'opaque',stage:'raw',
  ...(parts.length>1?{parts}:{})};
}
