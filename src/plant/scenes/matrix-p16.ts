/**
 * P16 private, bounded fault-position resilience audit.
 *
 * P15 originally injected one registered equipment fault only when the
 * second physical item arrived. P16 makes that a falsifiable teaching
 * assessment: the same learner PLC must complete first/middle/last-body
 * fault profiles, reproduce a profile deterministically, and reject
 * four independent bypass controls. Every run is the real 24 V PLC/plant
 * Worker, with a new private temporary Start switch and original product
 * provenance. No direct Q toggles, simulated "passing" body injection,
 * rendering-derived grades, persistent result or external connectivity.
 */
import type {ProjectFile,Wire} from '../../sim/signals';
import {projectSignature} from './commissioning';
import {runP15AutonomousSort,autonomousSortPreflight} from './matrix-p15-autonomous';
import {runP15AutonomousFactory,autoFactoryPreflight,
 AUTO_FACTORY_SPECS} from './matrix-p15-autonomous-factory';

const supported=['robot-sort','gantry-transfer','palletizing','bottle-line'] as const;
export type P16Scene=typeof supported[number];
export type P16Profile={
 id:'first'|'middle'|'last'|'replay-middle';
 faultAtProduct:number;passed:boolean;status:'passed'|'failed'|'blocked';
 produced:number;completed:number;expected:number;faultRecovered:boolean;
 simulatedMs:number;throughputPerSimHour:number;diagnostic:string;
};
export type P16Control={
 id:'constant-on'|'constant-off'|'missing-physical-feedback'|'unpowered-plc';
 expectedStatus:'failed'|'blocked';observedStatus:'passed'|'failed'|'blocked';
 rejected:boolean;diagnostic:string;
};
export type P16AuditResult={
 sceneId:string;sourceSignature:string;status:'passed'|'failed'|'blocked';
 profiles:readonly P16Profile[];controls:readonly P16Control[];
 deterministicReplay:boolean;expectedProducts:number;
 medianSimulatedMs:number;slowestSimulatedMs:number;
 lowestThroughputPerSimHour:number;diagnostic:string;
};
type Outcome={status:'passed'|'failed'|'blocked';produced:number;completed:number;
 faultRecovered:boolean;simulatedMs:number;throughputPerSimHour:number;
 diagnostic:string;cases:readonly {id:string;pass:boolean;detail:string}[]};
function isP16Scene(sceneId:string):sceneId is P16Scene{
 return (supported as readonly string[]).includes(sceneId);
}
function requiredProducts(sceneId:P16Scene):number=>
 sceneId==='palletizing'?8:3;
function run(p:ProjectFile,sceneId:P16Scene,faultAtProduct:number):Outcome{
 if(sceneId==='robot-sort'){
  const r=runP15AutonomousSort(p,sceneId,{faultAtProduct});
  return {...r,completed:r.sorted};
 }
 return runP15AutonomousFactory(p,sceneId,{faultAtProduct});
}
function counterProgram(energized:boolean):string{
 return [
  'VAR_INPUT','  In0 : BOOL;','END_VAR','VAR_OUTPUT',
  ...Array.from({length:6},(_,i)=>'  Out'+i+' : BOOL;'),
  'END_VAR',
  ...Array.from({length:6},(_,i)=>'Out'+i+' := '+(energized?'TRUE':'FALSE')+';'),
 ].join('\n');
}
function removePhysicalEndpoint(p:ProjectFile,terminal:string):ProjectFile{
 const remove=(w:Wire)=>w.from!==terminal&&w.to!==terminal;
 return {...p,wires:p.wires.filter(remove)};
}
function measure(outcome:Outcome,id:P16Profile['id'],
 faultAtProduct:number,expected:number):P16Profile{
 const passed=outcome.status==='passed'&&outcome.completed===expected&&
  outcome.produced===expected&&outcome.faultRecovered&&
  outcome.cases.length>=4&&outcome.cases.every(c=>c.pass)&&
  Number.isFinite(outcome.simulatedMs)&&outcome.simulatedMs>0&&
  Number.isFinite(outcome.throughputPerSimHour)&&
  outcome.throughputPerSimHour>0;
 return {id,faultAtProduct,passed,status:outcome.status,
  produced:outcome.produced,completed:outcome.completed,expected,
  faultRecovered:outcome.faultRecovered,simulatedMs:outcome.simulatedMs,
  throughputPerSimHour:outcome.throughputPerSimHour,
  diagnostic:outcome.diagnostic};
}
function replayKey(value:P16Profile):string{
 return JSON.stringify({
  target:value.faultAtProduct,passed:value.passed,status:value.status,
  produced:value.produced,completed:value.completed,expected:value.expected,
  faultRecovered:value.faultRecovered,simulatedMs:value.simulatedMs,
  throughputPerSimHour:value.throughputPerSimHour,
  diagnostic:value.diagnostic,
 });
}
function control(id:P16Control['id'],expectedStatus:P16Control['expectedStatus'],
 outcome:Outcome):P16Control{
 return {id,expectedStatus,observedStatus:outcome.status,
  rejected:outcome.status===expectedStatus,
  diagnostic:outcome.diagnostic};
}
const supportedMessage=()=>(
 'P16 resilience audit requires one of the four P15 advanced original workcells'
);
/** Exact source is used for positive trials; temporary negative-control
 * programs are NEVER learner solutions or grading shortcuts. They test the
 * private auditor itself. A correct learner program must pass 3 real fault
 * profiles; falsified Qs, missing feedback or lost PLC power must NOT pass. */
export function p16AuditPreflight(p:ProjectFile,sceneId:string):string[]{
 if(!isP16Scene(sceneId))return [supportedMessage()];
 return sceneId==='robot-sort'?autonomousSortPreflight(p,sceneId):
  autoFactoryPreflight(p,sceneId);
}
export function runP16ResilienceAudit(p:ProjectFile,sceneId:string):P16AuditResult{
 const sourceSignature=projectSignature(p);
 const expectedProducts=isP16Scene(sceneId)?requiredProducts(sceneId):0;
 const base={
  sceneId,sourceSignature,expectedProducts,
  profiles:[] as P16Profile[],controls:[] as P16Control[],
  deterministicReplay:false,medianSimulatedMs:0,slowestSimulatedMs:0,
  lowestThroughputPerSimHour:0,
 };
 const blockers=p16AuditPreflight(p,sceneId);
 if(blockers.length||!isP16Scene(sceneId))
  return {...base,status:'blocked',diagnostic:blockers.join('; ')};
 try{
  const middle=Math.ceil(expectedProducts/2);
  const profileCases=[
   {id:'first' as const,at:1},
   {id:'middle' as const,at:middle},
   {id:'last' as const,at:expectedProducts},
   {id:'replay-middle' as const,at:middle},
  ];
  const profiles=profileCases.map(({id,at})=>
   measure(run(p,sceneId,at),id,at,expectedProducts));
  const deterministicReplay=replayKey(profiles[1])===replayKey(profiles[3]);
  // Audit the scorer itself against three invalid control environments. An
  // untrustworthy P15 worker that ever accepts a constant coil must fail P16.
  const on={...p,language:'st' as const,stSource:counterProgram(true)};
  const off={...p,language:'st' as const,stSource:counterProgram(false)};
  const sensorTerminal=sceneId==='robot-sort'?'pickup.OUT_present':
   sceneId==='bottle-line'?'fill-eye.OUT_present':'pickup.OUT_present';
  const disconnected=removePhysicalEndpoint(p,sensorTerminal);
  const unpowered=removePhysicalEndpoint(p,'scene-plc.L+');
  const controls:P16Control[]=[
   control('constant-on','failed',run(on,sceneId,2)),
   control('constant-off','failed',run(off,sceneId,2)),
   control('missing-physical-feedback','blocked',run(disconnected,sceneId,2)),
   control('unpowered-plc','blocked',run(unpowered,sceneId,2)),
  ];
  const exactSourceUnchanged=projectSignature(p)===sourceSignature;
  const good=profiles.every(profile=>profile.passed)&&deterministicReplay&&
   controls.every(c=>c.rejected)&&exactSourceUnchanged;
  const times=profiles.slice(0,3).map(x=>x.simulatedMs).sort((a,b)=>a-b);
  const throughputs=profiles.slice(0,3).map(x=>x.throughputPerSimHour);
  return {...base,profiles,controls,deterministicReplay,
   medianSimulatedMs:times[1],slowestSimulatedMs:times[2],
   lowestThroughputPerSimHour:Math.min(...throughputs),
   status:good?'passed':'failed',
   diagnostic:good?
    'P16 verified independent first/middle/last real-product equipment faults, same-body recovery, deterministic middle replay, electrical/sensor controls and unchanged learner source. Training-model evidence only.':
    'P16 found a fault-timing sensitivity, irreproducible physical outcome, negative-control bypass, or mutated source; no passing certification issued'};
 }catch(error){
  return {...base,status:'failed',
   diagnostic:'P16 audit aborted without a pass: '+
    (error instanceof Error?error.message:String(error))};
 }
}
