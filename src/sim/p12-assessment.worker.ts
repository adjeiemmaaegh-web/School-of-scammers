/// <reference lib="webworker" />
/** P12 private offline assessment Worker: independent deterministic bench.
 * No timers, fetch, storage, server, external PLC actions or renderer state.
 */
import {runPlantMatrix} from '../plant/scenes/matrix';
import {expandedSpecFor,runExpandedMatrix} from '../plant/scenes/matrix-p13';
import {advancedSpecFor,runAdvancedProcess} from '../plant/scenes/matrix-p14';
import {runP15Batch} from '../plant/scenes/matrix-p15';
import {runP15AutonomousSort} from '../plant/scenes/matrix-p15-autonomous';
import {runP15AutonomousFactory} from '../plant/scenes/matrix-p15-autonomous-factory';
import {runP16ResilienceAudit} from '../plant/scenes/matrix-p16';
import {runP17MaterialCampaign} from '../plant/scenes/matrix-p17';
import {runP18JamRecovery} from '../plant/scenes/matrix-p18';
import {runP19PowerCampaign} from '../plant/scenes/matrix-p19';
import type {ProjectFile} from './signals';

type RunRequest={kind:'run-matrix'|'run-batch'|'run-autonomous'|'run-resilience'|'run-material-lots'|'run-jam-recovery'|'run-power-recovery';id:number;sceneId:string;project:ProjectFile};
type RunResponse={kind:'matrix-result';id:number;result:ReturnType<typeof runPlantMatrix>}|
 {kind:'batch-result';id:number;result:ReturnType<typeof runP15Batch>}|
 {kind:'autonomous-result';id:number;result:ReturnType<typeof runP15AutonomousSort>|ReturnType<typeof runP15AutonomousFactory>}|
 {kind:'resilience-result';id:number;result:ReturnType<typeof runP16ResilienceAudit>}|
 {kind:'material-lots-result';id:number;result:ReturnType<typeof runP17MaterialCampaign>}|
 {kind:'jam-recovery-result';id:number;result:ReturnType<typeof runP18JamRecovery>}|
 {kind:'power-recovery-result';id:number;result:ReturnType<typeof runP19PowerCampaign>}|
 {kind:'matrix-error';id:number;message:string};
const scope:DedicatedWorkerGlobalScope=self as DedicatedWorkerGlobalScope;
scope.onmessage=(event:MessageEvent<RunRequest>)=>{
 const req=event.data;
 if(!req||(req.kind!=='run-matrix'&&req.kind!=='run-batch'&&req.kind!=='run-autonomous'&&
   req.kind!=='run-resilience'&&req.kind!=='run-material-lots'&&
   req.kind!=='run-jam-recovery'&&req.kind!=='run-power-recovery')||
   !Number.isSafeInteger(req.id)||
   typeof req.sceneId!=='string'||!req.project)return;
 try{
  const size=JSON.stringify(req.project).length;
  if(size>300000)throw new RangeError('Assessment project exceeds bounded local trial size');
  if(req.kind==='run-power-recovery'){
   const result=runP19PowerCampaign(req.project,req.sceneId);
   scope.postMessage({kind:'power-recovery-result',id:req.id,result} satisfies RunResponse);
  }else if(req.kind==='run-jam-recovery'){
   const result=runP18JamRecovery(req.project,req.sceneId);
   scope.postMessage({kind:'jam-recovery-result',id:req.id,result} satisfies RunResponse);
  }else if(req.kind==='run-material-lots'){
   const result=runP17MaterialCampaign(req.project,req.sceneId);
   scope.postMessage({kind:'material-lots-result',id:req.id,result} satisfies RunResponse);
  }else if(req.kind==='run-resilience'){
   const result=runP16ResilienceAudit(req.project,req.sceneId);
   scope.postMessage({kind:'resilience-result',id:req.id,result} satisfies RunResponse);
  }else if(req.kind==='run-autonomous'){
   const result=req.sceneId==='robot-sort'?
    runP15AutonomousSort(req.project,req.sceneId):
    runP15AutonomousFactory(req.project,req.sceneId);
   scope.postMessage({kind:'autonomous-result',id:req.id,result} satisfies RunResponse);
  }else if(req.kind==='run-batch'){
   const result=runP15Batch(req.project,req.sceneId);
   scope.postMessage({kind:'batch-result',id:req.id,result} satisfies RunResponse);
  }else{
   const result=advancedSpecFor(req.sceneId)?
    runAdvancedProcess(req.project,req.sceneId):
    expandedSpecFor(req.sceneId)?
    runExpandedMatrix(req.project,req.sceneId):
    runPlantMatrix(req.project,req.sceneId);
   scope.postMessage({kind:'matrix-result',id:req.id,result} satisfies RunResponse);
  }
 }catch(error){
  scope.postMessage({kind:'matrix-error',id:req.id,
   message:error instanceof Error?error.message:'Local trial could not execute'} satisfies RunResponse);
 }
};
