import {describe,it,expect,vi,afterEach} from 'vitest';
import {
 decodeAssignment,decodeResult,encodeAssignment,encodeResult,
 loadProgress,recordProgress,
} from '../src/platform/persistence';
import type {Assignment,AttemptResult} from '../src/platform/types';

const assignment:Assignment={
 kind:'skills-lab-assignment',formatVersion:1,trade:'plc',
 exerciseId:'plc-sbx-find-fault',exerciseVersion:'1.0',mode:'assessment',
 seed:42,label:'Site 4 cohort',createdAt:'2026-11-14T00:00:00.000Z',
};
const result:AttemptResult={
 kind:'skills-lab-result',formatVersion:1,assignment,
 startedAt:'2026-11-14T00:00:02.000Z',
 finishedAt:'2026-11-14T00:00:07.000Z',
 durationMs:5000,
 evidence:[{index:1,at:50,action:'operate',detail:'Pushed START',accepted:true}],
 rubric:{score:10,max:10,passed:true,safetyHold:false,
  criteria:[{id:'sensor',label:'Observed the limit',max:10,earned:10,
   reason:'Electrical terminal correctly measured'}]},
};
const raw=(x:unknown)=>{
 const bytes=new TextEncoder().encode(JSON.stringify(x));
 return btoa(Array.from(bytes,c=>String.fromCharCode(c)).join(''))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
afterEach(()=>vi.unstubAllGlobals());
describe('Repository QA: portable untrusted assessment boundary',()=>{
 it('round-trips valid Unicode assignments and bounded result evidence',()=>{
  const a={...assignment,label:'Côte d’Ivoire – instrumentation ①'};
  expect(decodeAssignment(encodeAssignment(a))).toEqual(a);
  const r={...result,assignment:a};
  expect(decodeResult(encodeResult(r))).toEqual(r);
 });
 it.each([
  {...assignment,label:{danger:'React node object'}},
  {...assignment,exerciseVersion:null},
  {...assignment,formatVersion:22},
  {...assignment,seed:NaN},
  {...assignment,seed:-1},
  {...assignment,mode:'adversarial'},
  {...assignment,trade:'other'},
  {...assignment,createdAt:'not a date'},
 ])('rejects malformed imported assignment with correct top-level kind: %#',x=>{
  expect(()=>decodeAssignment(raw(x))).toThrow();
 });
 it.each([
  {...result,rubric:null},
  {...result,rubric:{score:10,max:10,passed:true}},
  {...result,evidence:[{action:'operate'}]},
  {...result,startedAt:'not a time'},
  {...result,rubric:{...result.rubric,criteria:'not an array'}},
  {...result,rubric:{...result.rubric,criteria:[
   {...result.rubric.criteria[0],earned:10000}]}},
 ])('rejects malformed imported result before rendering the employer rubric: %#',x=>{
  expect(()=>decodeResult(raw(x))).toThrow();
 });
 it('rejects deliberately oversized inbound encoded data before base64 parse',()=>{
  expect(()=>decodeAssignment('A'.repeat(100_000))).toThrow();
  expect(()=>decodeResult('A'.repeat(3_000_000))).toThrow();
 });
 it('does not accept malformed outgoing codes either',()=>{
  expect(()=>encodeAssignment({...assignment,label:{} as unknown as string})).toThrow();
  expect(()=>encodeResult({...result,evidence:undefined as unknown as AttemptResult['evidence']})).toThrow();
 });
 it('rejects local progress prototype-sensitive keys and nonfinite scores',()=>{
  const store=new Map<string,string>();
  vi.stubGlobal('localStorage',{
   getItem:(k:string)=>store.get(k)??null,
   setItem:(k:string,v:string)=>{store.set(k,v);},
  });
  expect(()=>recordProgress('__proto__',70,true)).toThrow();
  expect(()=>recordProgress('valid-exercise',Number.NaN,true)).toThrow();
  expect(recordProgress('valid-exercise',83,true)['valid-exercise']).toEqual({
   bestScore:83,attempts:1,passed:true,
  });
  expect(loadProgress()['valid-exercise'].bestScore).toBe(83);
 });
});
