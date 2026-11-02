/** Portable, offline PLC engineering project. Deliberately excludes live machine state and assessment results. */
import {validateLadder,type LadderDocument} from './ladder';
import {validateIoMapping} from './io-mapping';
import {terminals,type Board,type PartKind} from './wiring-board';
export interface EngineeringProject {format:'plc-skills-lab-project';schemaVersion:1;name:string;program:LadderDocument;board:Board;boardMode:boolean}
const kinds:readonly PartKind[]=['supply','fuse','switch','relay','load','plc-input','plc-output','relay-contact'];
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeText=(x:unknown,max:number)=>typeof x==='string'&&x.length>0&&x.length<=max&&/^[\w .:/()-]+$/.test(x);
export function validateProject(input:unknown):EngineeringProject {
 if(!object(input)||input.format!=='plc-skills-lab-project'||input.schemaVersion!==1||!safeText(input.name,80)||typeof input.boardMode!=='boolean')throw Error('Unsupported or malformed project header');
 const program=input.program as LadderDocument;
 if(!object(program)||!Array.isArray(program.rungs)||program.rungs.length>200||JSON.stringify(program).length>150000)throw Error('Invalid program size');
 const issues=[...validateLadder(program),...validateIoMapping(program)];
 if(issues.length)throw Error(`Invalid PLC program: ${issues.slice(0,4).join('; ')}`);
 const board=input.board;
 if(!object(board)||!Array.isArray(board.parts)||!Array.isArray(board.wires)||board.parts.length>100||board.wires.length>300)throw Error('Invalid wiring board size');
 const parts=board.parts as unknown[];const wires=board.wires as unknown[];
 const ids=new Set<string>();let supplies=0;
 for(const part of parts){
  if(!object(part)||!safeText(part.id,32)||!safeText(part.label,80)||!kinds.includes(part.kind as PartKind)||typeof part.x!=='number'||!Number.isFinite(part.x)||Math.abs(part.x)>10000||typeof part.y!=='number'||!Number.isFinite(part.y)||Math.abs(part.y)>10000||part.closed!==undefined&&typeof part.closed!=='boolean'||part.controlledBy!==undefined&&!safeText(part.controlledBy,80))throw Error('Invalid wiring component');
  if(ids.has(part.id as string))throw Error('Duplicate component ID');ids.add(part.id as string);
  if(part.kind==='supply')supplies++;
 }
 if(supplies!==1)throw Error('Board must contain exactly one supply');
 const terminalsAvailable=new Set(parts.flatMap(p=>terminals(p as unknown as Board['parts'][number])));
 const wireIds=new Set<string>();const edges=new Set<string>();
 for(const wire of wires){
  if(!object(wire)||!safeText(wire.id,32)||typeof wire.from!=='string'||typeof wire.to!=='string'||!terminalsAvailable.has(wire.from)||!terminalsAvailable.has(wire.to)||wire.from===wire.to)throw Error('Invalid wire terminals');
  const edge=[wire.from,wire.to].sort().join('|');
  if(wireIds.has(wire.id as string)||edges.has(edge))throw Error('Duplicate wire');
  wireIds.add(wire.id as string);edges.add(edge);
 }
 // Reconstruct known fields only; do not propagate untrusted extra keys.
 return {format:'plc-skills-lab-project',schemaVersion:1,name:input.name as string,program:structuredClone(program),board:{parts:parts.map(p=>({id:(p as any).id,kind:(p as any).kind,label:(p as any).label,x:(p as any).x,y:(p as any).y,...((p as any).closed!==undefined?{closed:(p as any).closed}:{}),...((p as any).controlledBy!==undefined?{controlledBy:(p as any).controlledBy}:{})})),wires:wires.map(w=>({id:(w as any).id,from:(w as any).from,to:(w as any).to}))},boardMode:input.boardMode};
}
export function parseProject(text:string):EngineeringProject {if(text.length>250000)throw Error('Project file exceeds 250 KB');let value:unknown;try{value=JSON.parse(text)}catch{throw Error('Project is not valid JSON')}return validateProject(value)}
export function serializeProject(project:EngineeringProject):string{return JSON.stringify(validateProject(project),null,2)}
