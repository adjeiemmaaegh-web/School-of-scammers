/** Typed, DOM-free equipment plug-in interface used by the integrator. */
import type {ParamSpec} from '../../components/params';
import type {EquipmentCommand,EquipmentDrawing,EquipmentPlacement,EquipmentSignal,EquipmentState,Vec3,World} from './types';
export type Channel={name:string;kind:'bool'|'number';unit?:string};
export type EquipmentContext={id:string;originMm:Vec3;yawDeg:0|90|180|270;params:Record<string,number>};
export type EquipmentDef={
 kind:string;label:string;footprint:Vec3;
 commands:readonly Channel[];signals:readonly Channel[];params:readonly ParamSpec[];
 faults:readonly string[];
 fresh:(params:Record<string,number>)=>EquipmentState;
 /** Called once per 10ms substep; may modify world bodies deterministically. */
 step:(state:EquipmentState,world:World,commands:EquipmentCommand,dtMs:number,fault:string|null,
   ctx:EquipmentContext)=>{state:EquipmentState;world:World};
 read:(state:EquipmentState,world:World,ctx:EquipmentContext)=>Record<string,EquipmentSignal>;
 describe:(state:EquipmentState,ctx:EquipmentContext)=>EquipmentDrawing[];
};
export const ctxOf=(item:EquipmentPlacement):EquipmentContext=>({
 id:item.id,originMm:item.originMm,yawDeg:item.yawDeg,params:item.params,
});
export const flag=(command:EquipmentCommand,key:string):boolean=>command[key]===true;
export const numeric=(command:EquipmentCommand,key:string,fallback:number,min:number,max:number):number=>{
 const value=command[key];
 if(typeof value!=='number')return fallback;
 if(!Number.isFinite(value)||value<min||value>max)throw new RangeError('Invalid numeric '+key);
 return value;
};
export const spec=(key:string,label:string,unit:string,min:number,max:number,step:number,
 defaultValue:number):ParamSpec=>({key,label,unit,min,max,step,default:defaultValue});
export const param=(ctx:EquipmentContext,key:string,fallback:number):number=>
 ctx.params[key]??fallback;
export const initial=(params:Record<string,number>):EquipmentState=>({
 positionMm:0,speedMmS:0,progress:0,count:0,levelMl:0,temperatureC:20,
 value:0,engaged:false,done:false,lastCommand:false,elapsedMs:0,stalled:false,faulted:false,
});
export const draw=(ctx:EquipmentContext,part:string,shape:EquipmentDrawing['shape'],
 size:Vec3,z=0,colour='#618aa0'):EquipmentDrawing=>({
 part,shape,pos:{...ctx.originMm,z:ctx.originMm.z+z},
 size,yawDeg:ctx.yawDeg,colour,
});
