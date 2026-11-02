/** Deterministic, self-contained fault-diagnosis practicals; no backend. */
import {initialWorkcell,stepWorkcell,type WorkcellState,type WorkcellAction} from './workcell';
import type {StarterFaults} from './control-panel';
import type {ProcessFaults} from './conveyor-process';
export type FaultId='fuse-open'|'overload'|'coil-open'|'aux-open'|'sensor-disconnected'|'sensor-return'|'belt-slip'|'photoeye-blocked'|'product-jam'|'diverter-jam';
export type Diagnosis={id:FaultId;title:string;system:string;symptom:string;cause:string;repair:string;checks:readonly string[];difficulty:'Beginner'|'Intermediate'|'Advanced'};
export const diagnoses:readonly Diagnosis[]=[
{id:'fuse-open',title:'Starter fuse failure',system:'Motor starter',symptom:'Run request exists but motor cannot energize.',cause:'Open fuse F1',repair:'Isolate supply and replace simulated fuse F1.',checks:['Inspect F1 voltage','Compare run command and motor feedback'],difficulty:'Beginner'},
{id:'overload',title:'Overload trip',system:'Motor starter',symptom:'Contactor drive is interrupted after a simulated overload.',cause:'Tripped OL1',repair:'Isolate supply and reset simulated OL1.',checks:['Inspect overload contact','Check motor feedback'],difficulty:'Beginner'},
{id:'coil-open',title:'Contactor coil open',system:'Motor starter',symptom:'The PLC requests the motor but K1 fails to pick up.',cause:'Open K1 coil',repair:'Isolate supply and repair simulated coil.',checks:['Inspect K1 coil voltage','Check K1 auxiliary'],difficulty:'Intermediate'},
{id:'aux-open',title:'Auxiliary contact failure',system:'Motor starter',symptom:'Motor may run while K1 feedback remains absent.',cause:'K1 auxiliary stuck open',repair:'Isolate supply and repair simulated auxiliary.',checks:['Compare K1 feedback with motor state','Inspect auxiliary contact'],difficulty:'Intermediate'},
{id:'sensor-disconnected',title:'Sensor cable open',system:'PLC input',symptom:'SensorOK remains low and the motor cannot start.',cause:'Disconnected sensor cable',repair:'Isolate supply and reconnect sensor.',checks:['Measure sensor supply','Inspect SensorOK'],difficulty:'Beginner'},
{id:'sensor-return',title:'Sensor return open',system:'PLC input',symptom:'The input has no complete return circuit.',cause:'Sensor M0 return disconnected',repair:'Isolate supply and reconnect sensor return.',checks:['Inspect terminal return','Measure I0.2 to M0'],difficulty:'Intermediate'},
{id:'belt-slip',title:'Belt drive slipping',system:'Conveyor',symptom:'Motor command is present but belt feedback is missing.',cause:'Belt slipping',repair:'Isolate supply and clear simulated belt slip.',checks:['Compare motor and belt feedback','Observe product travel'],difficulty:'Intermediate'},
{id:'photoeye-blocked',title:'Photoeye stuck active',system:'Conveyor',symptom:'Photoeye remains active even without a product.',cause:'Photoeye blocked',repair:'Isolate supply and clear photoeye obstruction.',checks:['Inspect photoeye without products','Compare exit sensor'],difficulty:'Intermediate'},
{id:'product-jam',title:'Conveyor product jam',system:'Conveyor',symptom:'Belt feedback is lost under an active run command.',cause:'Product jam',repair:'Isolate supply and clear simulated jam.',checks:['Inspect motor and belt feedback','Observe product position'],difficulty:'Advanced'},
{id:'diverter-jam',title:'Sorter actuator jam',system:'Sorting',symptom:'Diverter cannot reach its commanded position.',cause:'Diverter jammed',repair:'Isolate supply and free simulated diverter.',checks:['Inspect diverter position','Compare output command'],difficulty:'Advanced'}
];
const starterFault:Partial<Record<FaultId,keyof StarterFaults>>={'fuse-open':'fuseOpen','overload':'overloadTripped','coil-open':'coilOpen','aux-open':'auxiliaryStuckOpen'};
const processFault:Partial<Record<FaultId,keyof ProcessFaults>>={'belt-slip':'beltSlipping','photoeye-blocked':'photoeyeBlocked','product-jam':'productJam','diverter-jam':'diverterJammed'};
export function setupFault(id:FaultId):WorkcellState {
 if(!diagnoses.some(d=>d.id===id))throw new Error('Unknown diagnosis');
 let s=stepWorkcell(initialWorkcell(),'isolate-power');
 s=stepWorkcell(s,'connect-sensor');
 s=stepWorkcell(s,{kind:'wire-sensor',target:'I0.2'});
 s=stepWorkcell(s,{kind:'wire-return',connected:true});
 if(id==='sensor-disconnected')s=stepWorkcell(s,'disconnect-sensor');
 if(id==='sensor-return')s=stepWorkcell(s,{kind:'wire-return',connected:false});
 const sf=starterFault[id],pf=processFault[id];
 if(sf)s=stepWorkcell(s,{kind:'starter-fault',fault:sf,active:true});
 if(pf)s=stepWorkcell(s,{kind:'process-fault',fault:pf,active:true});
 s=stepWorkcell(s,'restore-power');s=stepWorkcell(s,'press-start');s=stepWorkcell(s,'release-start');
 return s;
}
export function repairFault(state:WorkcellState,id:FaultId):WorkcellState {
 let s=stepWorkcell(state,'isolate-power');
 if(id==='sensor-disconnected')s=stepWorkcell(s,'connect-sensor');
 if(id==='sensor-return')s=stepWorkcell(s,{kind:'wire-return',connected:true});
 const sf=starterFault[id],pf=processFault[id];
 if(sf)s=stepWorkcell(s,{kind:'starter-fault',fault:sf,active:false});
 if(pf)s=stepWorkcell(s,{kind:'process-fault',fault:pf,active:false});
 s=stepWorkcell(s,'restore-power');s=stepWorkcell(s,'press-start');return stepWorkcell(s,'release-start');
}
export function faultPresent(s:WorkcellState,id:FaultId):boolean {
 if(id==='sensor-disconnected')return !s.sensorConnected;
 if(id==='sensor-return')return !s.terminalWiring.sensorReturnConnected;
 const sf=starterFault[id],pf=processFault[id];
 return sf?s.starter.faults[sf]:pf? s.process.faults[pf]:false;
}
export type DiagnosisRecord={scenario:FaultId;initialScan:number;observations:readonly string[];selectedCause:FaultId|null;verified:boolean;attempts:number};
export const startDiagnosis=(scenario:FaultId,state:WorkcellState):DiagnosisRecord=>({scenario,initialScan:state.scan,observations:[],selectedCause:null,verified:false,attempts:0});
export function recordObservation(record:DiagnosisRecord,state:WorkcellState):DiagnosisRecord {
 if(state.scan<=record.initialScan)return record;
 const observation=`Scan ${state.scan}: supply=${state.powerOn?'24V':'isolated'}, run=${state.plcOutputs.RunLatch?'ON':'OFF'}, motor=${state.motor?'ON':'OFF'}, sensor=${state.plcInputs.SensorOK?'ON':'OFF'}, belt=${state.process.motorFeedback?'ON':'OFF'}, photoeye=${state.process.photoeye?'ON':'OFF'}, K1 feedback=${state.starter.feedback?'ON':'OFF'}`;
 return record.observations.includes(observation)?record:{...record,observations:[...record.observations,observation].slice(-25)};
}
export function submitDiagnosis(record:DiagnosisRecord,state:WorkcellState,cause:FaultId):DiagnosisRecord {
 if(record.verified)return record;
 const correct=record.scenario===cause && record.observations.length>0 && state.scan>record.initialScan && !faultPresent(state,record.scenario) && state.powerOn;
 return {...record,selectedCause:cause,attempts:record.attempts+1,verified:correct};
}
