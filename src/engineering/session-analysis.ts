/** Deterministic session analysis. All measurements describe the virtual workcell only. */
import {initialWorkcell,stepWorkcell,type WorkcellAction} from './workcell';
import type {LadderDocument} from './ladder';
import type {Board} from './wiring-board';
import {MAX_SESSION_ACTIONS} from './workcell-session';

export interface SessionTransition {actionIndex:number;scan:number;timeMs:number;action:string;changedOutputs:string[];motor:boolean;powerOn:boolean;guardClosed:boolean;faults:string[];}
export type SessionHazardKind='motor-with-guard-open'|'motor-with-power-isolated'|'motor-without-plc-command';
export interface SessionHazard {scan:number;actionIndex:number;kind:SessionHazardKind;action:string;}
export interface SessionAnalysis {hazardScans:Record<SessionHazardKind,number>;hazardEpisodes:Record<SessionHazardKind,number>;hazards:SessionHazard[];hazardsTruncated:boolean;actions:number;scans:number;motorOnScans:number;powerOffScans:number;guardOpenScans:number;outputTransitions:number;faultActiveScans:number;transitions:SessionTransition[];truncated:boolean;}
const actionName=(a:WorkcellAction)=>typeof a==='string'?a:a.kind;
export function analyzeSession(program:LadderDocument,board:Board,boardMode:boolean,actions:readonly WorkcellAction[],maxRows=300):SessionAnalysis {
 if(actions.length>MAX_SESSION_ACTIONS)throw Error('Session exceeds action limit');
 if(!Number.isInteger(maxRows)||maxRows<1||maxRows>2000)throw Error('Invalid transition evidence limit');
 let state=initialWorkcell();let motorOnScans=0,powerOffScans=0,guardOpenScans=0,outputTransitions=0,faultActiveScans=0;
 const transitions:SessionTransition[]=[];let truncated=false;
 const kinds:SessionHazardKind[]=['motor-with-guard-open','motor-with-power-isolated','motor-without-plc-command'];
 const hazardScans=Object.fromEntries(kinds.map(k=>[k,0])) as Record<SessionHazardKind,number>;
 const hazardEpisodes=Object.fromEntries(kinds.map(k=>[k,0])) as Record<SessionHazardKind,number>;
 const hazards:SessionHazard[]=[];let hazardsTruncated=false;const previousHazards=new Set<SessionHazardKind>();
 for(let i=0;i<actions.length;i++){
  const prev=state;state=stepWorkcell(state,actions[i],20,program,boardMode?board:undefined);
  const changedOutputs=[...new Set([...Object.keys(prev.plcOutputs),...Object.keys(state.plcOutputs)])].filter(k=>Boolean(prev.plcOutputs[k])!==Boolean(state.plcOutputs[k])).sort();
  outputTransitions+=changedOutputs.length;
  const activeHazards=new Set<SessionHazardKind>();
  if(state.motor&&!state.guardClosed)activeHazards.add('motor-with-guard-open');
  if(state.motor&&!state.powerOn)activeHazards.add('motor-with-power-isolated');
  if(state.motor&&!Boolean(state.plcOutputs.RunLatch))activeHazards.add('motor-without-plc-command');
  for(const kind of kinds){if(activeHazards.has(kind)){hazardScans[kind]++;if(!previousHazards.has(kind)){hazardEpisodes[kind]++;if(hazards.length<maxRows)hazards.push({scan:state.scan,actionIndex:i+1,kind,action:actionName(actions[i])});else hazardsTruncated=true;}}}
  previousHazards.clear();for(const kind of activeHazards)previousHazards.add(kind);
  if(state.motor)motorOnScans++;
  if(!state.powerOn)powerOffScans++;
  if(!state.guardClosed)guardOpenScans++;
  const faults=[...Object.entries(state.starter.faults),...Object.entries(state.process.faults)].filter(([,v])=>v===true).map(([k])=>k).sort();
  if(faults.length)faultActiveScans++;
  if(changedOutputs.length||prev.motor!==state.motor||prev.powerOn!==state.powerOn||prev.guardClosed!==state.guardClosed||faults.length||typeof actions[i]!=='string'){
   if(transitions.length<maxRows)transitions.push({actionIndex:i+1,scan:state.scan,timeMs:state.timeMs,action:actionName(actions[i]),changedOutputs,motor:state.motor,powerOn:state.powerOn,guardClosed:state.guardClosed,faults});
   else truncated=true;
  }
 }
 return {hazardScans,hazardEpisodes,hazards,hazardsTruncated,actions:actions.length,scans:state.scan,motorOnScans,powerOffScans,guardOpenScans,outputTransitions,faultActiveScans,transitions,truncated};
}
export function sessionAnalysisCsv(report:SessionAnalysis):string {
 const esc=(s:string|number|boolean)=>'"'+String(s).replace(/"/g,'""')+'"';
 const lines=['action_index,scan,time_ms,action,changed_outputs,motor,power_on,guard_closed,active_faults'];
 for(const r of report.transitions)lines.push([r.actionIndex,r.scan,r.timeMs,r.action,r.changedOutputs.join(';'),r.motor,r.powerOn,r.guardClosed,r.faults.join(';')].map(esc).join(','));
 return lines.join('\r\n')+'\r\n';
}

/** Exports the first occurrence of each hazardous simulated episode; counts are complete even if evidence is capped. */
export function sessionHazardsCsv(report:SessionAnalysis):string {
 const quote=(v:string|number)=>'"'+String(v).replace(/"/g,'""')+'"';
 return ['scan,action_index,hazard,trigger_action',...report.hazards.map(h=>[h.scan,h.actionIndex,h.kind,h.action].map(quote).join(','))].join('\r\n')+'\r\n';
}
