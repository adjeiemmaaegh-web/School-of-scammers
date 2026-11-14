/**
 * Strictly separated 3-phase domain: physical reference must come from an actual
 * 3-phase source wired phase-to-like-phase to a drive; mixed 24V is rejected.
 * Graph connectivity, not Kirchhoff/SPICE/motor-electromagnetic equations.
 */
import type {Phase,ThreePhaseConnection} from './three-phase-types';
import type {Wire} from '../sim/signals';
const PHASES:readonly Phase[]=['L1','L2','L3','PE'];
const phaseNames=new Set<string>(PHASES);
const split=(terminal:string):{id:string;pin:string}|null=>{
 const dot=terminal.indexOf('.');
 return dot>0?{id:terminal.slice(0,dot),pin:terminal.slice(dot+1)}:null;
};
export const isThreePhasePin=(pin:string):boolean=>phaseNames.has(pin);
export const isThreePhaseWire=(wire:Pick<Wire,'from'|'to'>):boolean=>{
 const a=split(wire.from),b=split(wire.to);
 return !!(a&&b&&(isThreePhasePin(a.pin)||isThreePhasePin(b.pin)));
};
export function threePhaseWireError(a:string,b:string,
  kinds:Readonly<Record<string,string>>):string|null{
 const left=split(a),right=split(b);
 if(!left||!right)return 'Malformed terminal identifier';
 const lp=isThreePhasePin(left.pin),rp=isThreePhasePin(right.pin);
 if(!lp&&!rp)return null;
 if(!lp||!rp)return '3-phase terminals cannot connect to 24V, PLC, sensor or other domains';
 const ownerA=kinds[left.id],ownerB=kinds[right.id];
 if(!['three-phase-supply','star-delta-drive'].includes(ownerA)||
    !['three-phase-supply','star-delta-drive'].includes(ownerB))
  return '3-phase conductors require dedicated 3-phase source/drive terminals';
 if(left.pin!==right.pin)return 'Phase crossings are prohibited: connect matching L1/L2/L3/PE only';
 if(ownerA===ownerB||left.id===right.id)return '3-phase conductor must connect supply to drive';
 return null;
}
export function threePhaseConnections(components:readonly {id:string;kind:string}[],
 wires:readonly Pick<Wire,'from'|'to'>[]):Record<string,ThreePhaseConnection>{
 const owners=Object.fromEntries(components.map(c=>[c.id,c.kind]));
 const supplies=components.filter(c=>c.kind==='three-phase-supply');
 const drives=components.filter(c=>c.kind==='star-delta-drive');
 const result:Record<string,ThreePhaseConnection>={};
 for(const drive of drives){
  const map:Record<string,string>={};
  const diagnostics:string[]=[];
  let crossed=false,shorted=false;
  for(const w of wires){
   const a=split(w.from),b=split(w.to);
   if(!a||!b||a.id!==drive.id&&b.id!==drive.id)continue;
   const local=a.id===drive.id?a:b,remote=a.id===drive.id?b:a;
   if(!isThreePhasePin(local.pin)&&!isThreePhasePin(remote.pin))continue;
   const error=threePhaseWireError(w.from,w.to,owners);
   if(error){crossed=true;diagnostics.push(error);continue;}
   if(map[local.pin]&&map[local.pin]!==remote.id){shorted=true;diagnostics.push('Two mains sources feed one drive');}
   map[local.pin]=remote.id;
  }
  const found=Object.values(map).filter(id=>supplies.some(s=>s.id===id));
  const source=found[0]??'';
  const opposed=found.some(id=>id!==source);
  if(opposed){shorted=true;diagnostics.push('Mixed three-phase sources cannot feed one motor');}
  const has=(pin:Phase)=>!!source&&map[pin]===source;
  if(!has('L1')||!has('L2')||!has('L3'))diagnostics.push('One or more motor supply phases missing');
  if(!has('PE'))diagnostics.push('Training PE reference not connected (not an electrical safety verification)');
  result[drive.id]={supplyId:source,driveId:drive.id,hasL1:has('L1'),
    hasL2:has('L2'),hasL3:has('L3'),hasPE:has('PE'),
    crossed,shorted,diagnostics};
 }
 return result;
}
