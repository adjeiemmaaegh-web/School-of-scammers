/**
 * P8 offline composite workcells. Flat worker-compatible fragments are the
 * authoritative export format; source templates can themselves be composites.
 * These are immutable SNAPSHOTS, not linked parametric CAD/PLC configurations.
 */
import type {WorkspaceFragment} from './types';
import {MAX_POSITION} from './geometry';

const MAX_TEMPLATES=4;
const MAX_COMPONENTS=60,MAX_WIRES=250;
const owner=(pin:string):string=>{
 const at=pin.indexOf('.');
 if(at<1||at===pin.length-1)throw new Error('Malformed assembly terminal');
 return pin.slice(0,at);
};
function remap(pin:string,ids:Map<string,string>):string{
 const id=owner(pin),mapped=ids.get(id);
 if(!mapped)throw new Error('Composite wire exits its source assembly');
 return mapped+pin.slice(id.length);
}
export function composeAssemblyFragments(
 sources:readonly WorkspaceFragment[],gap=175,
):WorkspaceFragment{
 if(sources.length<2||sources.length>MAX_TEMPLATES)
  throw new RangeError('Compose between two and four saved workcells');
 if(!Number.isSafeInteger(gap)||gap<50||gap>300)
  throw new RangeError('Invalid workcell spacing');
 const components:WorkspaceFragment['components']=[],wires:WorkspaceFragment['wires']=[];
 const params:NonNullable<WorkspaceFragment['params']>={};
 const plcPrograms:NonNullable<WorkspaceFragment['plcPrograms']>={};
 const plcIo:NonNullable<WorkspaceFragment['plcIo']>={};
 let cursor=0;
 for(let i=0;i<sources.length;i++){
  const src=sources[i];
  if(!src||src.version!==1||!Array.isArray(src.components)||!Array.isArray(src.wires)||
   src.components.length<1)throw new TypeError('Invalid source assembly');
  const minX=Math.min(...src.components.map(c=>c.x)),maxX=Math.max(...src.components.map(c=>c.x));
  const minY=Math.min(...src.components.map(c=>c.y)),maxY=Math.max(...src.components.map(c=>c.y));
  if(![minX,maxX,minY,maxY].every(Number.isFinite)||maxY-minY>MAX_POSITION.y)
   throw new RangeError('Source cell exceeds the workbench');
  const ids=new Map<string,string>();
  for(let j=0;j<src.components.length;j++){
   const comp=src.components[j];
   if(ids.has(comp.id))throw new Error('Repeated component ID in source cell');
   const fresh='cell'+(i+1)+'-part'+(j+1);
   ids.set(comp.id,fresh);
   components.push({...comp,id:fresh,x:cursor+comp.x-minX,y:comp.y-minY,pressed:false});
  }
  for(let j=0;j<src.wires.length;j++){
   const wire=src.wires[j];
   wires.push({...wire,id:'cell'+(i+1)+'-wire'+(j+1),
    from:remap(wire.from,ids),to:remap(wire.to,ids)});
  }
  for(const [oldId,newId] of ids){
   if(src.params?.[oldId])params[newId]={...src.params[oldId]};
   if(src.plcPrograms?.[oldId])plcPrograms[newId]=structuredClone(src.plcPrograms[oldId]);
   if(src.plcIo?.[oldId])plcIo[newId]=structuredClone(src.plcIo[oldId]);
  }
  cursor+=maxX-minX+gap;
 }
 if(components.length>MAX_COMPONENTS||wires.length>MAX_WIRES||
   Math.max(...components.map(c=>c.x))>MAX_POSITION.x)
  throw new RangeError('Composite station exceeds this classroom floor');
 return {version:1,components,wires,
  ...(Object.keys(params).length?{params}:{}),
  ...(Object.keys(plcPrograms).length?{plcPrograms}:{}),
  ...(Object.keys(plcIo).length?{plcIo}:{}),
 };
}
