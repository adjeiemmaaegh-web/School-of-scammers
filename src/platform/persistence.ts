/** Portable codes are validated UTF-8 base64url JSON, NOT signed or authenticated. */
import type {Assignment,AttemptResult,Criterion,EvidenceEvent,RubricResult} from './types';
const AK='skills-lab-assignment',RK='skills-lab-result',PK='skills-lab:progress:v1';
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,n:number)=>typeof v==='string'&&v.length<=n;
const nonempty=(v:unknown,n:number)=>str(v,n)&&(v as string).length>0;
const num=(v:unknown,n:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=n;
const int=(v:unknown,n:number)=>num(v,n)&&Number.isSafeInteger(v);
const id=(v:unknown)=>nonempty(v,100)&&/^[a-z0-9][\w.:-]*$/i.test(v as string)&&
 !['__proto__','prototype','constructor'].includes(v as string);
const date=(v:unknown)=>str(v,40)&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v as string)&&
 Number.isFinite(Date.parse(v as string));
const bad=():never=>{throw Error('Invalid or unsupported EFO Skill Lab portable code');};
const check=(condition:unknown):void=>{if(!condition)bad();};
function assignment(v:unknown):Assignment{
 check(obj(v)&&v.kind===AK&&v.formatVersion===1&&
  ['plc','cctv','bms','phone-pc','electronics'].includes(v.trade)&&
  id(v.exerciseId)&&nonempty(v.exerciseVersion,80)&&
  ['assessment','learning'].includes(v.mode)&&int(v.seed,2147483647)&&
  date(v.createdAt)&&(v.label===undefined||str(v.label,512)));
 const a=v as Assignment;
 return {kind:AK,formatVersion:1,trade:a.trade,exerciseId:a.exerciseId,
  exerciseVersion:a.exerciseVersion,mode:a.mode,seed:a.seed,
  ...(a.label===undefined?{}:{label:a.label}),createdAt:a.createdAt};
}
function criterion(v:unknown):Criterion{
 check(obj(v)&&id(v.id)&&nonempty(v.label,512)&&num(v.max,1e6)&&
  num(v.earned,v.max)&&str(v.reason,4096));
 const c=v as Criterion;
 return {id:c.id,label:c.label,max:c.max,earned:c.earned,reason:c.reason};
}
function event(v:unknown):EvidenceEvent{
 check(obj(v)&&int(v.index,1e9)&&int(v.at,1e9)&&
  nonempty(v.action,128)&&str(v.detail,4096)&&typeof v.accepted==='boolean');
 const e=v as EvidenceEvent;
 return {index:e.index,at:e.at,action:e.action,detail:e.detail,accepted:e.accepted};
}
function rubric(v:unknown):RubricResult{
 check(obj(v)&&num(v.score,1e6)&&num(v.max,1e6)&&v.score<=v.max&&
  typeof v.passed==='boolean'&&typeof v.safetyHold==='boolean'&&
  Array.isArray(v.criteria)&&v.criteria.length<=200&&!(v.safetyHold&&v.passed));
 const r=v as RubricResult,criteria=r.criteria.map(criterion);
 check(Math.abs(criteria.reduce((n,c)=>n+c.max,0)-r.max)<1e-6&&
  Math.abs(criteria.reduce((n,c)=>n+c.earned,0)-r.score)<1e-6);
 return {score:r.score,max:r.max,passed:r.passed,safetyHold:r.safetyHold,criteria};
}
function result(v:unknown):AttemptResult{
 check(obj(v)&&v.kind===RK&&v.formatVersion===1&&
  date(v.startedAt)&&date(v.finishedAt)&&
  Date.parse(v.startedAt)<=Date.parse(v.finishedAt)&&
  int(v.durationMs,1e9)&&Array.isArray(v.evidence)&&v.evidence.length<=2000);
 const r=v as AttemptResult,evidence=r.evidence.map(event);
 for(let i=1;i<evidence.length;i++)
  check(evidence[i].index>evidence[i-1].index&&evidence[i].at>=evidence[i-1].at);
 return {kind:RK,formatVersion:1,assignment:assignment(r.assignment),
  startedAt:r.startedAt,finishedAt:r.finishedAt,durationMs:r.durationMs,
  evidence,rubric:rubric(r.rubric)};
}
function encode(value:unknown,limit:number):string{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 if(bytes.length>limit)bad();
 const pieces:string[]=[];
 for(let i=0;i<bytes.length;i+=16384)
  pieces.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
 return btoa(pieces.join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(code:string,limit:number):unknown{
 const s=code.trim();
 if(!s||s.length>Math.ceil(limit*4/3)+8||!/^[\w-]+$/.test(s))bad();
 const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));
 if(raw.length>limit)bad();
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
  Uint8Array.from(raw,c=>c.charCodeAt(0)))) as unknown;
}
export const encodeAssignment=(a:Assignment)=>encode(assignment(a),16384);
export const decodeAssignment=(s:string)=>assignment(decode(s,16384));
export const encodeResult=(r:AttemptResult)=>encode(result(r),1500000);
export const decodeResult=(s:string)=>result(decode(s,1500000));
export const assignmentLink=(a:Assignment)=>
 (typeof window!=='undefined'?window.location.origin+'/take':'/take')+
 '#a='+encodeAssignment(a);
export type ProgressMap=Record<string,{bestScore:number;attempts:number;passed:boolean}>;
export function loadProgress():ProgressMap{
 const map:ProgressMap=Object.create(null) as ProgressMap;
 try{
  const raw=localStorage.getItem(PK);
  if(!raw||raw.length>500000)return map;
  const parsed:unknown=JSON.parse(raw);
  if(!obj(parsed))return map;
  for(const [key,v] of Object.entries(parsed))if(id(key)&&obj(v)&&
   num(v.bestScore,100)&&int(v.attempts,1e6)&&typeof v.passed==='boolean')
   map[key]={bestScore:v.bestScore,attempts:v.attempts,passed:v.passed};
 }catch{/* Optional browser storage must never break training. */}
 return map;
}
export function recordProgress(exerciseId:string,score:number,passed:boolean):ProgressMap{
 if(!id(exerciseId)||!num(score,100)||typeof passed!=='boolean')
  throw new TypeError('Invalid exercise progress input');
 const map=loadProgress(),prev=map[exerciseId]??{bestScore:0,attempts:0,passed:false};
 map[exerciseId]={bestScore:Math.max(prev.bestScore,score),
  attempts:Math.min(1e6,prev.attempts+1),passed:prev.passed||passed};
 try{localStorage.setItem(PK,JSON.stringify(map));}catch{/* Optional. */}
 return map;
}
