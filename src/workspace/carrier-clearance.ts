/**
 * Narrow P7 machine-clearance rule. Deliberately NOT a universal rigid-body
 * collision solver: many genuine conveyor handoffs require overlapping spans,
 * and sensors are designed to mount inside transport footprints.
 *
 * The authoritative worker rejects a NEW near-total superposition of
 * like-kind, same-yaw material carriers. Partial overlap, different machines
 * and historical saved layouts are kept intact for backwards compatibility.
 */
import type {ProjectFile} from '../sim/signals';
import {footprintOf} from './floor-plan';

export type CarrierSuperposition={first:string;second:string;kind:string};
const canonicalPair=(a:string,b:string):string=>[a,b].sort().join('\u0000');

export function superposedCarrierPairs(
 project:Pick<ProjectFile,'components'|'params'>,
):CarrierSuperposition[]{
 const all=project.components.filter(c=>footprintOf(c,project.params).isCarrier);
 const pairs:CarrierSuperposition[]=[];
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j];
  // Crossing and non-identical stations can be intentional. Scope is
  // strictly duplicate same-type/same-direction transport surfaces.
  if(a.kind!==b.kind||(a.yawDeg??0)!==(b.yawDeg??0))continue;
  const aa=footprintOf(a,project.params),bb=footprintOf(b,project.params);
  const overlapX=Math.max(0,(aa.width+bb.width)/2-Math.abs(aa.x-bb.x));
  const overlapY=Math.max(0,(aa.depth+bb.depth)/2-Math.abs(aa.y-bb.y));
  const smallestArea=Math.min(aa.width*aa.depth,bb.width*bb.depth);
  if(smallestArea>0&&overlapX*overlapY/smallestArea>=.98)
   pairs.push({first:a.id,second:b.id,kind:a.kind});
 }
 return pairs;
}
export function firstNewCarrierSuperposition(
 before:Pick<ProjectFile,'components'|'params'>,
 after:Pick<ProjectFile,'components'|'params'>,
):CarrierSuperposition|null{
 const previous=new Set(superposedCarrierPairs(before).map(p=>canonicalPair(p.first,p.second)));
 return superposedCarrierPairs(after).find(p=>!previous.has(canonicalPair(p.first,p.second)))??null;
}
export function carrierSuperpositionError(pair:CarrierSuperposition):string{
 return 'Refused duplicate '+pair.kind+' transport surface: '+pair.first+
  ' and '+pair.second+' nearly coincide. Partial overlaps for handoffs remain allowed.';
}
