/**
 * Scan-level debugger for the isolated PLC instruction bench.
 * Breakpoints inspect the result of a completed deterministic scan; they NEVER
 * force machine I/O, bypass electrical interlocks, or interact with real PLCs.
 */
import {advanceLogicBench,createLogicBench,logicBenchInputTags,setLogicBenchInput,type LogicBench} from './instruction-lab';
import type {LadderDocument} from './ladder';

export type EdgeDirection='rising'|'falling'|'either';
export type DebugBreakpoint =
 | {id:string;enabled:boolean;kind:'scan';scan:number}
 | {id:string;enabled:boolean;kind:'signal';source:'input'|'coil';tag:string;edge:EdgeDirection}
 | {id:string;enabled:boolean;kind:'rung';rungId:string;edge:'rising'|'falling'}
 | {id:string;enabled:boolean;kind:'timer';rungId:string;elapsedMs:number}
 | {id:string;enabled:boolean;kind:'counter';rungId:string;count:number};
export type NewBreakpoint = DebugBreakpoint extends infer B ? B extends DebugBreakpoint ? Omit<B,'id'|'enabled'> : never : never;
export type DebugHit={breakpointId:string;scan:number;timeMs:number;reason:string;observed:string};
export type DebugEvent={kind:'input';tag:string;on:boolean}|{kind:'run';scans:number};
export interface DebugSession {
 readonly bench:LogicBench;
 readonly breakpoints:readonly DebugBreakpoint[];
 readonly hits:readonly DebugHit[];
 readonly actions:readonly DebugEvent[];
 readonly nextBreakpoint:number;
 readonly paused:readonly DebugHit[];
}
export const MAX_DEBUG_BREAKPOINTS=24;
export const MAX_DEBUG_ACTIONS=1000;
export const MAX_DEBUG_HITS=200;

export function createDebugSession(program:LadderDocument,deltaMs=20):DebugSession {
 return {bench:createLogicBench(program,deltaMs),breakpoints:[],hits:[],actions:[],nextBreakpoint:1,paused:[]};
}
function checkBreakpoint(bench:LogicBench,b:NewBreakpoint):void {
 if (!b || typeof b!=='object') throw Error('Breakpoint definition is required');
 switch(b.kind){
 case 'scan': if(!Number.isSafeInteger(b.scan)||b.scan<1||b.scan>1_000_000)throw RangeError('Scan breakpoint must be between 1 and 1000000');return;
 case 'signal': {
  const tags=b.source==='input'?logicBenchInputTags(bench.program):b.source==='coil'?bench.program.rungs.map(r=>r.coil):[];
  if(!tags.includes(b.tag)||!['rising','falling','either'].includes(b.edge))throw Error('Signal breakpoint must refer to an actual input or coil and a valid edge');return;
 }
 case 'rung':
  if(!bench.program.rungs.some(r=>r.id===b.rungId)||!['rising','falling'].includes(b.edge))throw Error('Rung breakpoint must refer to an existing rung and valid edge');return;
 case 'timer': {
  const rung=bench.program.rungs.find(r=>r.id===b.rungId);
  if(!rung||!rung.operation||!['ton','tof','rto'].includes(rung.operation.kind)||!Number.isSafeInteger(b.elapsedMs)||b.elapsedMs<1||b.elapsedMs>(rung.operation as {presetMs:number}).presetMs)throw Error('Timer threshold must match a timer rung and its preset');return;
 }
 case 'counter': {
  const rung=bench.program.rungs.find(r=>r.id===b.rungId);
  if(!rung||rung.operation?.kind!=='ctu'||!Number.isSafeInteger(b.count)||b.count<1||b.count>rung.operation.preset)throw Error('Counter threshold must match a counter rung and its preset');return;
 }
 default: throw Error('Unknown breakpoint kind');
 }
}
export function addDebugBreakpoint(session:DebugSession,definition:NewBreakpoint):DebugSession {
 if(session.breakpoints.length>=MAX_DEBUG_BREAKPOINTS)throw Error('Maximum breakpoint count reached');
 checkBreakpoint(session.bench,definition);
 const breakpoint={...definition,id:`bp-${session.nextBreakpoint}`,enabled:true} as DebugBreakpoint;
 return {...session,breakpoints:[...session.breakpoints,breakpoint],nextBreakpoint:session.nextBreakpoint+1,paused:[]};
}
export function removeDebugBreakpoint(session:DebugSession,id:string):DebugSession {
 if(!session.breakpoints.some(b=>b.id===id))throw Error('Unknown breakpoint');
 return {...session,breakpoints:session.breakpoints.filter(b=>b.id!==id),paused:[]};
}
export function enableDebugBreakpoint(session:DebugSession,id:string,enabled:boolean):DebugSession {
 if(typeof enabled!=='boolean'||!session.breakpoints.some(b=>b.id===id))throw Error('Invalid breakpoint toggle');
 return {...session,breakpoints:session.breakpoints.map(b=>b.id===id?{...b,enabled}:b),paused:[]};
}
export function setDebugInput(session:DebugSession,tag:string,on:boolean):DebugSession {
 if(session.bench.inputs[tag]===on){
  // Preserve the same validation for an unknown tag even when its value appears falsy.
  if(!Object.hasOwn(session.bench.inputs,tag))throw Error('Unknown externally controlled input');
  return session;
 }
 if(session.actions.length>=MAX_DEBUG_ACTIONS)throw Error('Debug action limit reached; export or reset this session');
 return {...session,bench:setLogicBenchInput(session.bench,tag,on),actions:[...session.actions,{kind:'input',tag,on}],paused:[]};
}
const booleanEdge=(before:boolean,after:boolean,edge:EdgeDirection)=>before!==after&&(edge==='either'||(edge==='rising'?after:!after));
const stepRung=(bench:LogicBench,id:string)=>bench.history.at(-1)?.steps.find(s=>s.rungId===id);
function matchBreakpoint(before:LogicBench,after:LogicBench,b:DebugBreakpoint):DebugHit|null {
 if(!b.enabled)return null;
 let matched=false;let observed='';let reason='';
 switch(b.kind){
 case 'scan':matched=after.scan===b.scan;reason=`Reached scan ${b.scan}`;observed=`scan=${after.scan}`;break;
 case 'signal': {
  const first=b.source==='input'?before.history.at(-1)?.inputs[b.tag]===true:before.outputs[b.tag]===true;
  const second=b.source==='input'?after.history.at(-1)?.inputs[b.tag]===true:after.outputs[b.tag]===true;
  matched=booleanEdge(first,second,b.edge);observed=`${b.source}:${b.tag}=${Number(second)}`;reason=`${b.source} ${b.tag} ${second?'rose':'fell'}`;break;
 }
 case 'rung': {
  const first=stepRung(before,b.rungId)?.energized===true;
  const second=stepRung(after,b.rungId)?.energized===true;
  matched=booleanEdge(first,second,b.edge);observed=`${b.rungId} energized=${Number(second)}`;reason=`Rung ${b.rungId} ${second?'energized':'de-energized'}`;break;
 }
 case 'timer': {
  const old=before.memory[b.rungId]?.elapsedMs??0;const current=after.memory[b.rungId]?.elapsedMs??0;
  matched=old<b.elapsedMs&&current>=b.elapsedMs;observed=`${current} ms`;reason=`Timer ${b.rungId} crossed ${b.elapsedMs} ms`;break;
 }
 case 'counter': {
  const old=before.memory[b.rungId]?.count??0;const current=after.memory[b.rungId]?.count??0;
  matched=old<b.count&&current>=b.count;observed=`${current} edges`;reason=`Counter ${b.rungId} reached ${b.count}`;break;
 }
 }
 return matched?{breakpointId:b.id,scan:after.scan,timeMs:after.timeMs,reason,observed}:null;
}
/** Runs no more than requested scans and halts at the first scan with any matching breakpoint. */
export function runDebugScans(session:DebugSession,maximumScans=1):DebugSession {
 if(!Number.isSafeInteger(maximumScans)||maximumScans<1||maximumScans>500)throw RangeError('Request 1..500 scans');
 if(session.actions.length>=MAX_DEBUG_ACTIONS)throw Error('Debug action limit reached; export or reset this session');
 let bench=session.bench;let executed=0;let paused:DebugHit[]=[];const newHits:DebugHit[]=[];
 for(let i=0;i<maximumScans;i++){
  const before=bench;bench=advanceLogicBench(bench,1);executed++;
  paused=session.breakpoints.map(b=>matchBreakpoint(before,bench,b)).filter((hit):hit is DebugHit=>hit!==null);
  if(paused.length){newHits.push(...paused);break;}
 }
 return {...session,bench,paused,hits:[...session.hits,...newHits].slice(-MAX_DEBUG_HITS),actions:[...session.actions,{kind:'run',scans:executed}]};
}
export function resetDebugSession(session:DebugSession):DebugSession {
 return {...session,bench:createLogicBench(session.bench.program,session.bench.deltaMs),hits:[],actions:[],paused:[]};
}
/** Replays the exact recorded input toggles and ACTUAL executed scan counts from time zero. */
export function replayDebugActions(session:DebugSession):LogicBench {
 let bench=createLogicBench(session.bench.program,session.bench.deltaMs);
 if(session.actions.length>MAX_DEBUG_ACTIONS)throw Error('Invalid debug action count');
 for(const event of session.actions){
  if(event.kind==='input')bench=setLogicBenchInput(bench,event.tag,event.on);
  else if(event.kind==='run')bench=advanceLogicBench(bench,event.scans);
  else throw Error('Unknown replay action');
 }
 return bench;
}
export function verifyDebugReplay(session:DebugSession):{passed:boolean;scans:number;actions:number} {
 const replay=replayDebugActions(session);
 const fields=(b:LogicBench)=>JSON.stringify([b.scan,b.timeMs,b.inputs,b.outputs,b.memory,b.history]);
 return {passed:fields(replay)===fields(session.bench),scans:replay.scan,actions:session.actions.length};
}
export function breakpointLabel(b:DebugBreakpoint):string {
 switch(b.kind){
 case 'scan':return `Scan #${b.scan}`;
 case 'signal':return `${b.source} ${b.tag} · ${b.edge} edge`;
 case 'rung':return `Rung ${b.rungId} · ${b.edge} edge`;
 case 'timer':return `Timer ${b.rungId} ≥ ${b.elapsedMs} ms`;
 case 'counter':return `Counter ${b.rungId} ≥ ${b.count}`;
 }
}
const csv=(field:unknown)=>`"${String(field).replaceAll('"','""').replace(/^[\s]*([=+@-])/,'\u0027$&')}\u0022`;
export function debugHitsCsv(session:DebugSession):string {
 return [['breakpoint','scan','simulated_ms','reason','observed'],...session.hits.map(h=>[h.breakpointId,h.scan,h.timeMs,h.reason,h.observed])].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
}
export function exportDebugSessionJson(session:DebugSession):string {
 const replay=verifyDebugReplay(session);
 return JSON.stringify({format:'plc-skills-lab-debug-evidence',schema:1,mode:'isolated-instruction-simulator',program:session.bench.program,deltaMs:session.bench.deltaMs,scans:session.bench.scan,simulatedMs:session.bench.timeMs,inputs:session.bench.inputs,outputs:session.bench.outputs,instructionMemory:session.bench.memory,breakpoints:session.breakpoints,hits:session.hits,actions:session.actions,trace:session.bench.history,replayVerified:replay.passed,limitations:'Simulated scans only; no physical machine control or safety certification.'},null,2);
}
