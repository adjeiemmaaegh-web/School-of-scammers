/** Portable, deterministic workcell session. Simulation evidence, not physical-machine evidence. */
import {initialWorkcell,stepWorkcell,FORCEABLE_WORKCELL_INPUTS,type WorkcellAction,type WorkcellState} from './workcell';
import {type LadderDocument} from './ladder';
import {validateProject} from './project-file';
import {type Board} from './wiring-board';

export const MAX_SESSION_ACTIONS=2000;
export interface WorkcellSession {format:'plc-skills-lab-session';version:1;name:string;program:LadderDocument;board:Board;boardMode:boolean;actions:WorkcellAction[];fingerprint:string;checkpoints?:SessionCheckpoint[];}
export interface SessionCheckpoint {scan:number;fingerprint:string;}
export const SESSION_CHECKPOINT_INTERVAL=50;
function fingerprint(state:WorkcellState):string {
 // Stable, noncryptographic integrity marker for accidental corruption detection only.
 const evidence=JSON.stringify({scan:state.scan,timeMs:state.timeMs,motor:state.motor,runLatch:state.runLatch,inputs:state.plcInputs,outputs:state.plcOutputs,memory:state.ladderMemory,terminal:state.terminalWiring,starter:state.starter,process:state.process,...(Object.keys(state.inputForces).length?{simulationForces:state.inputForces,unforcedInputs:state.rawPlcInputs}:{})});
 let hash=2166136261;for(let i=0;i<evidence.length;i++){hash^=evidence.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');
}
export function replaySession(program:LadderDocument,board:Board,boardMode:boolean,actions:readonly WorkcellAction[]):WorkcellState {
 if(actions.length>MAX_SESSION_ACTIONS)throw Error('Session exceeds 2000 actions');
 return actions.reduce((state,action)=>stepWorkcell(state,action,20,program,boardMode?board:undefined),initialWorkcell());
}
export function makeSession(name:string,program:LadderDocument,board:Board,boardMode:boolean,actions:readonly WorkcellAction[]):WorkcellSession {
 if(!name.trim()||name.length>80)throw Error('Session name must be 1–80 characters');
 if(actions.length>MAX_SESSION_ACTIONS)throw Error('Session exceeds 2000 actions');
 const validated=validateProject({format:'plc-skills-lab-project',schemaVersion:1,name,program,board,boardMode});
 const snapshot=JSON.parse(JSON.stringify({program:validated.program,board:validated.board,actions})) as {program:LadderDocument;board:Board;actions:WorkcellAction[]};
 const checkpoints:SessionCheckpoint[]=[];let state=initialWorkcell();
 for(let i=0;i<snapshot.actions.length;i++){state=stepWorkcell(state,snapshot.actions[i],20,snapshot.program,boardMode?snapshot.board:undefined);if((i+1)%SESSION_CHECKPOINT_INTERVAL===0||i===snapshot.actions.length-1)checkpoints.push({scan:i+1,fingerprint:fingerprint(state)});}
 const final=state;
 return {format:'plc-skills-lab-session',version:1,name:name.trim(),...snapshot,boardMode,fingerprint:fingerprint(final),checkpoints};
}
export function parseSession(text:string):{session:WorkcellSession;final:WorkcellState} {
 if(text.length>500000)throw Error('Session exceeds 500 KB');
 const raw:unknown=JSON.parse(text);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid session object');
 const s=raw as Partial<WorkcellSession>;
 if(s.format!=='plc-skills-lab-session'||s.version!==1||typeof s.name!=='string'||typeof s.boardMode!=='boolean'||typeof s.fingerprint!=='string'||!Array.isArray(s.actions)||!s.program||!s.board)throw Error('Unsupported session format');
 if(s.actions.length>MAX_SESSION_ACTIONS)throw Error('Session exceeds action limit');
 // Reject malformed actions rather than letting unknown object shapes silently become wiring edits.
 const allowed=new Set(['press-start','release-start','press-stop','release-stop','open-guard','close-guard','disconnect-sensor','connect-sensor','isolate-power','restore-power','press-reset-count','release-reset-count','press-reset-timer','release-reset-timer','tick']);
 const starter=new Set(['fuseOpen','overloadTripped','coilOpen','auxiliaryStuckOpen','contactorWelded']);
 const process=new Set(['photoeyeBlocked','photoeyeOpen','diverterJammed','beltSlipping']);
 const terminals=new Set(['UNCONNECTED','I0.0','I0.1','I0.2','I0.3','I0.4','M0']);
 for(const action of s.actions){if(typeof action==='string'){if(!allowed.has(action))throw Error('Unknown recorded action');continue;}
 if(!action||typeof action!=='object')throw Error('Invalid recorded action');
 const a=action as Record<string,unknown>;
 if(a.kind==='wire-sensor'&&terminals.has(String(a.target)))continue;
 if(a.kind==='wire-return'&&typeof a.connected==='boolean')continue;
 if(a.kind==='starter-fault'&&starter.has(String(a.fault))&&typeof a.active==='boolean')continue;
 if(a.kind==='process-fault'&&process.has(String(a.fault))&&typeof a.active==='boolean')continue;
 if(a.kind==='spawn-product'&&typeof a.reject==='boolean')continue;
 if(a.kind==='force-input'&&Object.keys(a).length===3&&typeof a.tag==='string'&&(FORCEABLE_WORKCELL_INPUTS as readonly string[]).includes(a.tag)&&(a.value===null||typeof a.value==='boolean'))continue;
 throw Error('Unknown or malformed recorded action');}
 const session=makeSession(s.name,s.program,s.board,s.boardMode,s.actions);
 if(s.checkpoints!==undefined){
  if(!Array.isArray(s.checkpoints)||s.checkpoints.length!==session.checkpoints!.length)throw Error('Invalid replay checkpoint ledger');
  for(let i=0;i<session.checkpoints!.length;i++){const received=s.checkpoints[i] as SessionCheckpoint;const expected=session.checkpoints![i];if(!received||received.scan!==expected.scan||received.fingerprint!==expected.fingerprint)throw Error(`Replay checkpoint mismatch at scan ${expected.scan}: evidence may be corrupted or incompatible`);}
 }
 if(session.fingerprint!==s.fingerprint)throw Error('Session replay mismatch: evidence may be corrupted or from an incompatible simulator');
 return {session,final:replaySession(session.program,session.board,session.boardMode,session.actions)};
}
export function sessionFingerprint(state:WorkcellState):string{return fingerprint(state);}

/** Reconstruct the most recent 200 scans, including the original scan numbers.
 * The complete action sequence is replayed so PLC timer/counter state remains valid.
 * History is a bounded view, not a substitute for the full exported session.
 */
export function replaySessionTimeline(program:LadderDocument,board:Board,boardMode:boolean,actions:readonly WorkcellAction[],limit=200):{final:WorkcellState;history:WorkcellState[];firstScan:number} {
 if(actions.length>MAX_SESSION_ACTIONS)throw Error('Session exceeds 2000 actions');
 if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Timeline limit must be between 1 and 200');
 let state=initialWorkcell();const history:WorkcellState[]=[];
 for(const action of actions){state=stepWorkcell(state,action,20,program,boardMode?board:undefined);history.push(state);if(history.length>limit)history.shift();}
 return {final:state,history,firstScan:history.length?history[0].scan:0};
}
