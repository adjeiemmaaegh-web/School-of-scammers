/// <reference lib="webworker" />
/** P12 private offline assessment Worker: independent deterministic bench.
 * No timers, fetch, storage, server, external PLC actions or renderer state.
 */
import {runPlantMatrix} from '../plant/scenes/matrix';
import {expandedSpecFor,runExpandedMatrix} from '../plant/scenes/matrix-p13';
import type {ProjectFile} from './signals';

type RunRequest={kind:'run-matrix';id:number;sceneId:string;project:ProjectFile};
type RunResponse={kind:'matrix-result';id:number;result:ReturnType<typeof runPlantMatrix>}|
 {kind:'matrix-error';id:number;message:string};
const scope:DedicatedWorkerGlobalScope=self as DedicatedWorkerGlobalScope;
scope.onmessage=(event:MessageEvent<RunRequest>)=>{
 const req=event.data;
 if(!req||req.kind!=='run-matrix'||!Number.isSafeInteger(req.id)||
   typeof req.sceneId!=='string'||!req.project)return;
 try{
  const size=JSON.stringify(req.project).length;
  if(size>300000)throw new RangeError('Assessment project exceeds bounded local trial size');
  const result=expandedSpecFor(req.sceneId)?
   runExpandedMatrix(req.project,req.sceneId):
   runPlantMatrix(req.project,req.sceneId);
  scope.postMessage({kind:'matrix-result',id:req.id,result} satisfies RunResponse);
 }catch(error){
  scope.postMessage({kind:'matrix-error',id:req.id,
   message:error instanceof Error?error.message:'Local trial could not execute'} satisfies RunResponse);
 }
};
