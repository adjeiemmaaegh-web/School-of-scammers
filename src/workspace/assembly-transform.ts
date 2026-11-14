/**
 * P8 reusable offline assembly quarter-turn transformation.
 * Move an ENTIRE selection in 90-degree increments while preserving every
 * source component ID, internal wire, PLC program and parameter. The worker
 * still owns the authoritative placement/clearance and paste validation.
 * This does not create linked hierarchical CAD assemblies or dynamic parts.
 */
import type {WorkspaceFragment} from './types';
import {ROTATABLE} from './editor';
import {rotateFloorOffset,turn} from './geometry';

export type AssemblyTurns=0|1|2|3;
export function rotateAssemblyFragment(
 fragment:WorkspaceFragment,quarterTurns:AssemblyTurns,
):WorkspaceFragment{
 if(!fragment||fragment.version!==1||!Array.isArray(fragment.components)||
  fragment.components.length<1)throw new TypeError('Invalid assembly fragment');
 if(![0,1,2,3].includes(quarterTurns))
  throw new RangeError('Assembly rotation requires an exact quarter turn');
 if(quarterTurns===0)return fragment;
 if(fragment.components.some(c=>!ROTATABLE.has(c.kind)))
  throw new Error('Assembly contains orientation-locked equipment; insert without rotation');
 const ox=Math.min(...fragment.components.map(c=>c.x));
 const oy=Math.min(...fragment.components.map(c=>c.y));
 if(!Number.isFinite(ox)||!Number.isFinite(oy))
  throw new RangeError('Invalid assembly placement coordinates');
 const rotated=fragment.components.map(c=>{
  const offset=rotateFloorOffset({x:c.x-ox,z:c.y-oy},quarterTurns*90);
  let orientation=c.yawDeg??0;
  for(let i=0;i<quarterTurns;i++)orientation=turn(orientation,1);
  return {component:c,offset,yawDeg:orientation};
 });
 const shiftX=Math.min(...rotated.map(r=>r.offset.x));
 const shiftY=Math.min(...rotated.map(r=>r.offset.z));
 return {...fragment,
  components:rotated.map(({component,offset,yawDeg})=>({
   ...component,x:ox+offset.x-shiftX,y:oy+offset.z-shiftY,yawDeg,
  })),
  // Explicitly clone all nested document data so rotating/placing a template
  // never aliases the saved local shelf (which remains immutable).
  wires:fragment.wires.map(w=>({...w})),
  ...(fragment.params?{params:Object.fromEntries(Object.entries(fragment.params)
    .map(([k,v])=>[k,{...v}]))}:{}),
  ...(fragment.plcPrograms?{plcPrograms:structuredClone(fragment.plcPrograms)}:{}),
  ...(fragment.plcIo?{plcIo:structuredClone(fragment.plcIo)}:{}),
 };
}
