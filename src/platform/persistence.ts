/**
 * Local-only portable assignment/result codes and browser progress.
 * The codes are base64url JSON: strictly validated for safe rendering but
 * NOT signed, encrypted, authenticated, tamper-proof or employer-verified.
 * Never treat an imported result as proof of identity or external completion.
 */
import type { Assignment, AttemptResult,Criterion,EvidenceEvent,RubricResult } from './types';

const ASSIGNMENT_MAX_BYTES=16_384;
const RESULT_MAX_BYTES=1_500_000;
const MAX_RESULT_EVENTS=2_000;
const PROGRESS_KEY='skills-lab:progress:v1';

const object=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,min:number,max:number):v is string=>
 typeof v==='string'&&v.length>=min&&v.length<=max;
const number=(v:unknown,min:number,max:number):v is number=>
 typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number):v is number=>
 number(v,min,max)&&Number.isSafeInteger(v);
const timestamp=(v:unknown):v is string=>
 text(v,20,40)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&
 Number.isFinite(Date.parse(v));
const safeId=(v:unknown):v is string=>
 text(v,1,100)&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v)&&
 !['__proto__','prototype','constructor'].includes(v);
function invalid(type:string):never{throw new Error('Invalid or unsupported EFO Skill Lab '+type+' code.');}
function validateAssignment(value:unknown):Assignment{
 if(!object(value)||value.kind!=='skills-lab-assignment'||value.formatVersion!==1||
  !['plc','cctv','bms','phone-pc','electronics'].includes(String(value.trade))||
  !safeId(value.exerciseId)||!text(value.exerciseVersion,1,80)||
  !['assessment','learning'].includes(String(value.mode))||
  !integer(value.seed,0,2_147_483_647)||!timestamp(value.createdAt)||
  (value.label!==undefined&&!text(value.label,0,512)))
  return invalid('assignment');
 return {
  kind:'skills-lab-assignment',formatVersion:1,
  trade:value.trade as Assignment['trade'],
  exerciseId:value.exerciseId as string,
  exerciseVersion:value.exerciseVersion as string,
  mode:value.mode as Assignment['mode'],
  seed:value.seed as number,
  ...(value.label===undefined?{}:{label:value.label as string}),
  createdAt:value.createdAt as string,
 };
}
function validateCriterion(v:unknown):Criterion{
 if(!object(v)||!safeId(v.id)||!text(v.label,1,512)||
  !number(v.max,0,1_000_000)||!number(v.earned,0,v.max as number)||
  !text(v.reason,0,4096))return invalid('result');
 return {id:v.id,label:v.label,max:v.max,earned:v.earned,reason:v.reason};
}
function validateEvidence(v:unknown):EvidenceEvent{
 if(!object(v)||!integer(v.index,1,1_000_000_000)||
  !integer(v.at,0,1_000_000_000)||!text(v.action,1,128)||
  !text(v.detail,0,4096)||typeof v.accepted!=='boolean')
  return invalid('result');
 return {index:v.index,at:v.at,action:v.action,detail:v.detail,accepted:v.accepted};
}
function validateRubric(v:unknown):RubricResult{
 if(!object(v)||!number(v.score,0,1_000_000)||!number(v.max,0,1_000_000)||
  v.score>v.max||typeof v.passed!=='boolean'||typeof v.safetyHold!=='boolean'||
  !Array.isArray(v.criteria)||v.criteria.length>200)
  return invalid('result');
 const criteria=v.criteria.map(validateCriterion);
 // Malformed score totals must never silently render as authoritative.
 const max=criteria.reduce((n,c)=>n+c.max,0),score=criteria.reduce((n,c)=>n+c.earned,0);
 if(Math.abs(max-v.max)>1e-6||Math.abs(score-v.score)>1e-6||
   (v.safetyHold&&v.passed))return invalid('result');
 return {score:v.score,max:v.max,passed:v.passed,
  safetyHold:v.safetyHold,criteria};
}
function validateResult(v:unknown):AttemptResult{
 if(!object(v)||v.kind!=='skills-lab-result'||v.formatVersion!==1||
  !timestamp(v.startedAt)||!timestamp(v.finishedAt)||
  Date.parse(v.startedAt)>Date.parse(v.finishedAt)||
  !integer(v.durationMs,0,1_000_000_000)||
  !Array.isArray(v.evidence)||v.evidence.length>MAX_RESULT_EVENTS)
  return invalid('result');
 const assignment=validateAssignment(v.assignment);
 const evidence=v.evidence.map(validateEvidence);
 for(let i=1;i<evidence.length;i++)
  if(evidence[i].index<=evidence[i-1].index||evidence[i].at<evidence[i-1].at)
   return invalid('result');
 return {
  kind:'skills-lab-result',formatVersion:1,assignment,
  startedAt:v.startedAt,finishedAt:v.finishedAt,durationMs:v.durationMs,
  evidence,rubric:validateRubric(v.rubric),
 };
}
/** Efficient bounded base64url encoding of UTF-8 JSON, not encryption. */
function encode(value:unknown,limit:number):string{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 if(bytes.length>limit)throw new RangeError('Portable code exceeds supported size');
 const parts:string[]=[];
 for(let i=0;i<bytes.length;i+=16384)
  parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
 return btoa(parts.join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** Reject huge or non-base64 inputs BEFORE allocation/decoding. */
function decode(value:string,limit:number):unknown{
 const code=value.trim();
 if(!code||code.length>Math.ceil(limit*4/3)+8||
    !/^[A-Za-z0-9_-]+$/.test(code))
  throw new Error('Invalid or oversized portable code');
 const padded=code.replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(padded);
 if(raw.length>limit)throw new RangeError('Decoded portable code exceeds supported size');
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
}
export function encodeAssignment(value:Assignment):string{
 return encode(validateAssignment(value),ASSIGNMENT_MAX_BYTES);
}
export function decodeAssignment(value:string):Assignment{
 return validateAssignment(decode(value,ASSIGNMENT_MAX_BYTES));
}
export function encodeResult(value:AttemptResult):string{
 return encode(validateResult(value),RESULT_MAX_BYTES);
}
export function decodeResult(value:string):AttemptResult{
 return validateResult(decode(value,RESULT_MAX_BYTES));
}
export function assignmentLink(value:Assignment):string{
 const base=typeof window!=='undefined'?window.location.origin+'/take':'/take';
 return base+'#a='+encodeAssignment(value);
}
export type ProgressMap=Record<string,{bestScore:number;attempts:number;passed:boolean}>;
/** Rebuild only safe plain records from browser storage; never trust its keys. */
export function loadProgress():ProgressMap{
 const clean:ProgressMap=Object.create(null) as ProgressMap;
 try{
  const raw=localStorage.getItem(PROGRESS_KEY);
  if(!raw||raw.length>500_000)return clean;
  const parsed:unknown=JSON.parse(raw);
  if(!object(parsed))return clean;
  for(const [key,value] of Object.entries(parsed)){
   if(!safeId(key)||!object(value)||!number(value.bestScore,0,100)||
    !integer(value.attempts,0,1_000_000)||typeof value.passed!=='boolean')continue;
   clean[key]={bestScore:value.bestScore,attempts:value.attempts,passed:value.passed};
  }
 }catch{/* Browser storage is optional; malformed data never breaks practice. */}
 return clean;
}
export function recordProgress(exerciseId:string,score:number,passed:boolean):ProgressMap{
 if(!safeId(exerciseId)||!number(score,0,100)||typeof passed!=='boolean')
  throw new TypeError('Invalid exercise progress input');
 const map=loadProgress(),prev=map[exerciseId]??{
  bestScore:0,attempts:0,passed:false,
 };
 map[exerciseId]={
  bestScore:Math.max(prev.bestScore,score),
  attempts:Math.min(1_000_000,prev.attempts+1),
  passed:prev.passed||passed,
 };
 try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(map));}
 catch{/* Browser storage is optional and its failures are not certification. */}
 return map;
}
