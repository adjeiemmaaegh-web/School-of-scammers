/**
 * Persistence boundary.
 *
 * The experience layer never talks to storage directly — it goes through this
 * module. v1 is local-only: assignments and results are encoded into shareable
 * strings (for links/files) and small conveniences live in localStorage.
 *
 * A later phase swaps the implementation behind these same functions for a real
 * backend (accounts, stored assignments/results) without touching the UI flows.
 */
import type { Assignment, AttemptResult } from './types';

/** This is an untrusted, client-side interchange format, NOT a signed
 * certificate. Keep a tight upper bound before allocating decoded bytes.
 * Validating the shape prevents malformed codes from crashing React pages.
 */
const MAX_ASSIGNMENT_CODE_CHARS=8192;
const MAX_RESULT_CODE_CHARS=262144;
const TRADES=new Set(['plc','cctv','bms','phone-pc','electronics']);
const own=(v:unknown):v is Record<string,unknown>=>v!==null&&
 typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const count=(v:unknown,max:number):v is number=>
 Number.isSafeInteger(v)&&typeof v==='number'&&v>=0&&v<=max;
const textField=(v:unknown,max:number):v is string=>
 typeof v==='string'&&v.length>0&&v.length<=max&&
 !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const timestamp=(v:unknown):v is string=>{
 if(typeof v!=='string'||v.length!==24||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v))return false;
 const date=new Date(v);
 return Number.isFinite(date.getTime())&&date.toISOString()===v;
};
function validAssignment(a:unknown):Assignment{
 if(!own(a)||a.kind!=='skills-lab-assignment'||a.formatVersion!==1||
  typeof a.trade!=='string'||!TRADES.has(a.trade)||
  !textField(a.exerciseId,80)||!/^[A-Za-z0-9_-]+$/.test(a.exerciseId)||
  !textField(a.exerciseVersion,40)||
  (a.mode!=='learning'&&a.mode!=='assessment')||
  !count(a.seed,4294967295)||!timestamp(a.createdAt)||
  (a.label!==undefined&&
   (typeof a.label!=='string'||a.label.length>160||
    /[\u0000-\u001f]/.test(a.label))))
  throw new Error('Invalid assignment code fields or version');
 return {kind:'skills-lab-assignment',formatVersion:1,
  trade:a.trade as Assignment['trade'],exerciseId:a.exerciseId,
  exerciseVersion:a.exerciseVersion,mode:a.mode,
  seed:a.seed,createdAt:a.createdAt,
  ...(a.label===undefined?{}:{label:a.label})};
}
function validResult(value:unknown):AttemptResult{
 if(!own(value)||value.kind!=='skills-lab-result'||value.formatVersion!==1)
  throw new Error('Invalid result code format or version');
 const assignment=validAssignment(value.assignment);
 if(!timestamp(value.startedAt)||!timestamp(value.finishedAt)||
  !count(value.durationMs,365*24*60*60*1000)||
  new Date(value.finishedAt).getTime()<new Date(value.startedAt).getTime()||
  value.durationMs>new Date(value.finishedAt).getTime()-
   new Date(value.startedAt).getTime()+60000)
  throw new Error('Invalid result timing');
 const rubric=value.rubric;
 if(!own(rubric)||!finite(rubric.score)||!finite(rubric.max)||
  rubric.max<0||rubric.max>10000||rubric.score<0||
  rubric.score>rubric.max||typeof rubric.passed!=='boolean'||
  typeof rubric.safetyHold!=='boolean'||
  !Array.isArray(rubric.criteria)||rubric.criteria.length>100)
  throw new Error('Invalid result rubric');
 const criteria:AttemptResult['rubric']['criteria']=[];
 for(const raw of rubric.criteria){
  if(!own(raw)||!textField(raw.id,80)||!textField(raw.label,200)||
   typeof raw.reason!=='string'||raw.reason.length>2000||
   !finite(raw.max)||!finite(raw.earned)||raw.max<0||raw.max>10000||
   raw.earned<0||raw.earned>raw.max)
   throw new Error('Invalid result criterion');
  criteria.push({id:raw.id,label:raw.label,max:raw.max,
   earned:raw.earned,reason:raw.reason});
 }
 if(!Array.isArray(value.evidence)||value.evidence.length>1000)
  throw new Error('Invalid result evidence length');
 const evidence:AttemptResult['evidence']=[];
 for(const raw of value.evidence){
  if(!own(raw)||!count(raw.index,10000000)||
   !count(raw.at,365*24*60*60*1000)||
   !textField(raw.action,80)||!textField(raw.detail,1000)||
   typeof raw.accepted!=='boolean')
   throw new Error('Invalid result evidence event');
  evidence.push({index:raw.index,at:raw.at,
   action:raw.action,detail:raw.detail,accepted:raw.accepted});
 }
 return {kind:'skills-lab-result',formatVersion:1,assignment,
  startedAt:value.startedAt,finishedAt:value.finishedAt,
  durationMs:value.durationMs,evidence,
  rubric:{score:rubric.score,max:rubric.max,passed:rubric.passed,
   safetyHold:rubric.safetyHold,criteria}};
}
/** URL-safe base64 of UTF-8 JSON; not authenticated. */
function encode(obj:unknown):string{
 const bytes=new TextEncoder().encode(JSON.stringify(obj));
 let bin='';
 for(const b of bytes)bin+=String.fromCharCode(b);
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(s:string,max:number):unknown{
 if(typeof s!=='string'||s.length<2||s.length>max||
   !/^[A-Za-z0-9_-]+$/.test(s))
  throw new Error('Invalid or oversized interchange code');
 try{
  const base64=s.replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(base64);
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
 }catch{
  throw new Error('Malformed interchange code');
 }
}
export function encodeAssignment(a:Assignment):string{
 return encode(validAssignment(a));
}
export function decodeAssignment(s:string):Assignment{
 return validAssignment(decode(s.trim(),MAX_ASSIGNMENT_CODE_CHARS));
}
export function encodeResult(r:AttemptResult):string{
 return encode(validResult(r));
}
export function decodeResult(s:string):AttemptResult{
 return validResult(decode(s.trim(),MAX_RESULT_CODE_CHARS));
}

/** Build a shareable assignment link that opens the candidate experience. */
export function assignmentLink(a: Assignment): string {
  const base =
    typeof window !== 'undefined' ? `${window.location.origin}/take` : '/take';
  return `${base}#a=${encodeAssignment(a)}`;
}

/* --- local progress (per-viewer convenience only) --- */

const PROGRESS_KEY = 'skills-lab:progress:v1';

export type ProgressMap = Record<string, { bestScore: number; attempts: number; passed: boolean }>;

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function recordProgress(exerciseId: string, score: number, passed: boolean): ProgressMap {
  const map = loadProgress();
  const prev = map[exerciseId] ?? { bestScore: 0, attempts: 0, passed: false };
  map[exerciseId] = {
    bestScore: Math.max(prev.bestScore, score),
    attempts: prev.attempts + 1,
    passed: prev.passed || passed,
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — progress is a convenience, ignore */
  }
  return map;
}
