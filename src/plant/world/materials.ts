/**
 * Industrial material catalogue (R02 / R16). Pure data plus one spawn helper.
 *
 * Every material has physical properties (shape, size, mass, static friction) and sensing properties (conductive for
 * inductive sensors, optical class for photoeyes and light curtains). They reach the simulation through the SAME body
 * tags the sensors already read (`metal`, `transparent`) plus `frictionMu`, which the belt carry model uses to limit how
 * fast a load is accelerated. Educational values: typical orders of magnitude, not measured or calibrated data.
 */
import type {SpawnSpec} from './bodies';
import type {BodyPart,BodyShape,Vec3} from './types';
import {vec} from './math';

export type MaterialCategory='package'|'container'|'pallet'|'workpiece'|'component'|'raw'|'product';
export type MaterialStage='raw'|'machined'|'assembled'|'finished';
export type OpticalClass='opaque'|'transparent'|'reflective';
export type MaterialSpec=Readonly<{
 id:string;label:string;category:MaterialCategory;shape:BodyShape;sizeMm:Vec3;massKg:number;
 /** Static friction coefficient against a belt/roller surface (dimensionless). */
 frictionMu:number;
 conductive:boolean;optical:OpticalClass;stage:MaterialStage;
 /** Extra tags a consumer of this material reads (containers are fillable and cappable). */
 extraTags?:Readonly<Record<string,string|number|boolean>>;
 /** Composite geometry (R02): the body is these parts, not one box. `sizeMm` is their overall envelope. */
 parts?:readonly BodyPart[];
}>;
const m=(s:Omit<MaterialSpec,'sizeMm'>&{sizeMm:readonly [number,number,number]}):MaterialSpec=>
 ({...s,sizeMm:vec(s.sizeMm[0],s.sizeMm[1],s.sizeMm[2])});

/** Order is part of the saved-project contract (feeder `materialId` indexes it, 1-based): append only, never reorder. */
export const MATERIALS:readonly MaterialSpec[]=[
 m({id:'carton',label:'Carton (medium)',category:'package',shape:'box',sizeMm:[300,200,200],massKg:6,frictionMu:.45,conductive:false,optical:'opaque',stage:'finished'}),
 m({id:'carton-small',label:'Carton (small)',category:'package',shape:'box',sizeMm:[160,130,100],massKg:2,frictionMu:.45,conductive:false,optical:'opaque',stage:'finished'}),
 m({id:'bottle-glass',label:'Glass bottle',category:'container',shape:'cylinder',sizeMm:[70,70,250],massKg:.9,frictionMu:.25,conductive:false,optical:'transparent',stage:'raw',
  extraTags:{bottle:true,filledMl:0,capped:false},
  parts:[{dx:0,dy:0,z:0,sx:70,sy:70,sz:190,shape:'cylinder'},{dx:0,dy:0,z:190,sx:28,sy:28,sz:60,shape:'cylinder'}]}),
 m({id:'bottle-pet',label:'PET bottle',category:'container',shape:'cylinder',sizeMm:[65,65,230],massKg:.06,frictionMu:.3,conductive:false,optical:'transparent',stage:'raw',
  extraTags:{bottle:true,filledMl:0,capped:false},
  parts:[{dx:0,dy:0,z:0,sx:65,sy:65,sz:170,shape:'cylinder'},{dx:0,dy:0,z:170,sx:26,sy:26,sz:60,shape:'cylinder'}]}),
 m({id:'pallet',label:'Pallet',category:'pallet',shape:'box',sizeMm:[1200,800,150],massKg:25,frictionMu:.5,conductive:false,optical:'opaque',stage:'finished',
  parts:[{dx:0,dy:0,z:100,sx:1200,sy:800,sz:50},{dx:0,dy:-350,z:0,sx:1200,sy:100,sz:100},{dx:0,dy:0,z:0,sx:1200,sy:100,sz:100},{dx:0,dy:350,z:0,sx:1200,sy:100,sz:100}]}),
 m({id:'metal-workpiece',label:'Metal workpiece',category:'workpiece',shape:'box',sizeMm:[120,80,60],massKg:3,frictionMu:.3,conductive:true,optical:'reflective',stage:'raw'}),
 m({id:'plastic-part',label:'Plastic component',category:'component',shape:'box',sizeMm:[100,60,40],massKg:.2,frictionMu:.35,conductive:false,optical:'opaque',stage:'raw'}),
 m({id:'lid',label:'Lid',category:'component',shape:'cylinder',sizeMm:[80,80,15],massKg:.05,frictionMu:.3,conductive:false,optical:'opaque',stage:'raw'}),
 m({id:'base',label:'Base',category:'component',shape:'box',sizeMm:[100,100,40],massKg:.4,frictionMu:.35,conductive:false,optical:'opaque',stage:'raw'}),
 m({id:'raw-material',label:'Raw material sack',category:'raw',shape:'box',sizeMm:[250,180,120],massKg:12,frictionMu:.6,conductive:false,optical:'opaque',stage:'raw',
  parts:[{dx:0,dy:0,z:0,sx:250,sy:180,sz:70},{dx:-10,dy:0,z:70,sx:190,sy:140,sz:50}]}),
 m({id:'assembled-product',label:'Assembled product',category:'product',shape:'box',sizeMm:[120,120,70],massKg:.6,frictionMu:.35,conductive:false,optical:'opaque',stage:'assembled'}),
 m({id:'crate-irregular',label:'Irregular crate',category:'package',shape:'box',sizeMm:[420,260,180],massKg:15,frictionMu:.5,conductive:false,optical:'opaque',stage:'finished',
  parts:[{dx:0,dy:0,z:0,sx:420,sy:260,sz:100},{dx:110,dy:0,z:100,sx:200,sy:260,sz:80}]}),
 m({id:'bracket-l',label:'L-bracket workpiece',category:'workpiece',shape:'box',sizeMm:[120,80,80],massKg:2.4,frictionMu:.3,conductive:true,optical:'reflective',stage:'raw',
  parts:[{dx:0,dy:0,z:0,sx:120,sy:80,sz:20},{dx:-50,dy:0,z:20,sx:20,sy:80,sz:60}]}),
];
export const MATERIAL_IDS:readonly string[]=MATERIALS.map(x=>x.id);
export const materialById=(id:string):MaterialSpec|undefined=>MATERIALS.find(x=>x.id===id);
/** 1-based index used by saved-project settings; 0 means "legacy random cardboard/metal". */
export const materialByIndex=(index:number):MaterialSpec|undefined=>
 Number.isInteger(index)&&index>=1&&index<=MATERIALS.length?MATERIALS[index-1]:undefined;

/** The body tags a material contributes: the existing sensor tags plus friction, category and processing stage. */
export function materialTags(spec:MaterialSpec):Record<string,string|number|boolean>{
 return {material:spec.id,category:spec.category,stage:spec.stage,frictionMu:spec.frictionMu,
  ...(spec.conductive?{metal:true}:{}),...(spec.optical==='transparent'?{transparent:true}:{}),
  ...(spec.optical==='reflective'?{reflective:true}:{}),...spec.extraTags};
}
/** A ready-to-spawn body of the given material at `pos`. Size and mass can be overridden for mixed-size, mixed-weight loads. */
export function materialSpawn(spec:MaterialSpec,pos:Vec3,over:Partial<Pick<SpawnSpec,'size'|'massKg'|'supportedBy'|'yawDeg'>>&{tags?:Record<string,string|number|boolean>}={}):SpawnSpec{
 return {shape:spec.shape,size:over.size??spec.sizeMm,massKg:over.massKg??spec.massKg,pos,
  ...(over.supportedBy!==undefined?{supportedBy:over.supportedBy}:{}),...(over.yawDeg!==undefined?{yawDeg:over.yawDeg}:{}),
  tags:{...materialTags(spec),...over.tags},
  ...(spec.parts?{parts:scaleParts(spec.parts,spec.sizeMm,over.size??spec.sizeMm)}:{})};
}
/** Parts follow a size override (mixed-size loads keep their shape). */
const scaleParts=(parts:readonly BodyPart[],from:Vec3,to:Vec3):BodyPart[]=>{
 const fx=to.x/from.x,fy=to.y/from.y,fz=to.z/from.z;
 return parts.map(p=>({...p,dx:p.dx*fx,dy:p.dy*fy,z:p.z*fz,sx:p.sx*fx,sy:p.sy*fy,sz:p.sz*fz}));
};
