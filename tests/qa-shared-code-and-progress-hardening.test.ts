import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {
 encodeAssignment,decodeAssignment,encodeResult,decodeResult,
 loadProgress,recordProgress,
} from '../src/platform/persistence';
import type {Assignment,AttemptResult} from '../src/platform/types';

const assignment:Assignment={
 kind:'skills-lab-assignment',formatVersion:1,trade:'plc',
 exerciseId:'plc-sbx-startstop',exerciseVersion:'1.0',mode:'assessment',
 seed:42,label:'Engineering interview',createdAt:'2026-11-14T00:00:00.000Z',
};
const result:AttemptResult={
 kind:'skills-lab-result',formatVersion:1,assignment,
 startedAt:'2026-11-14T01:00:00.000Z',
 finishedAt:'2026-11-14T01:00:15.000Z',durationMs:15000,
 evidence:[{index:1,at:1200,action:'wire',detail:'Real output',accepted:true}],
 rubric:{score:80,max:100,passed:true,safetyHold:false,
  criteria:[{id:'wiring',label:'Wiring',max:100,earned:80,reason:'Verified in simulation'}]},
};
const base64url=(bytes:Uint8Array)=> {
 let raw='';
 for(const value of bytes)raw+=String.fromCharCode(value);
 return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const forged=(data:unknown)=>base64url(new TextEncoder().encode(JSON.stringify(data)));

describe('untrusted externally supplied offline assessment codes',()=>{
 it('accepts and roundtrips genuine assignment and rich result, including Unicode labels',()=>{
  const a={...assignment,label:'Maintenance — Stage 3 ✓'};
  expect(decodeAssignment(encodeAssignment(a))).toEqual(a);
  const r={...result,assignment:a};
  expect(decodeResult(encodeResult(r))).toEqual(r);
 });
 it('rejects same-kind-only forged assignment and version mismatch',()=>{
  for(const data of [
   {kind:'skills-lab-assignment'},
   {...assignment,formatVersion:2},
   {...assignment,trade:'__proto__'},
   {...assignment,seed:-1},
   {...assignment,seed:Number.MAX_SAFE_INTEGER},
   {...assignment,seed:'42'},
   {...assignment,exerciseId:'../../malformed'},
   {...assignment,exerciseVersion:null},
   {...assignment,mode:'admin'},
   {...assignment,createdAt:'not-a-date'},
   {...assignment,label:42},
  ])expect(()=>decodeAssignment(forged(data))).toThrow(/valid/i);
 });
 it('rejects same-kind-only forged result that would crash RubricReport',()=>{
  for(const data of [
   {kind:'skills-lab-result'},
   {...result,assignment:{}},
   {...result,formatVersion:99},
   {...result,evidence:null},
   {...result,rubric:null},
   {...result,rubric:{...result.rubric,criteria:null}},
   {...result,rubric:{...result.rubric,max:0}},
   {...result,rubric:{...result.rubric,score:Infinity}},
   {...result,evidence:[{index:1,at:1,action:'wire',detail:'X'}]},
   {...result,durationMs:-1},
   {...result,finishedAt:'2026-11-13T00:00:00.000Z'},
   {...result,evidence:Array.from({length:401},(_,i)=>({
    index:i+1,at:i,action:'wire',detail:'ok',accepted:true,
   }))},
  ])expect(()=>decodeResult(forged(data))).toThrow(/valid/i);
 });
 it('bounds input before atob/JSON parse and rejects corrupted encodings',()=>{
  for(const code of ['', '!', 'abc+', 'a', '%%%','x'.repeat(16_385)])
   expect(()=>decodeAssignment(code)).toThrow();
  expect(()=>decodeResult('a'.repeat(1_000_004))).toThrow(/oversized/i);
  expect(()=>decodeResult(forged({kind:'skills-lab-result'}))).toThrow();
  // A string with broken UTF8 bytes must not silently accept replacement chars.
  expect(()=>decodeAssignment(base64url(new Uint8Array([0xff,0xff])))).toThrow();
 });
});
describe('local progress corruption and object-key safety',()=>{
 const store=new Map<string,string>();
 beforeEach(()=>{
  store.clear();
  vi.stubGlobal('localStorage',{
   getItem:(k:string)=>store.get(k)??null,
   setItem:(k:string,v:string)=>{store.set(k,v);},
  });
 });
 afterEach(()=>vi.unstubAllGlobals());
 it('starts with empty records on malformed/NULL/array and oversized local storage',()=>{
  const key='skills-lab:progress:v1';
  for(const bad of ['not json','null','[]','123','"oops"','x'.repeat(100_001)]){
   store.set(key,bad);
   expect(loadProgress()).toEqual({});
   expect(recordProgress('plc-sbx-startstop',85,true)['plc-sbx-startstop'])
    .toEqual({bestScore:85,attempts:1,passed:true});
  }
 });
 it('filters tampered record fields and cannot overwrite prototype keys',()=>{
  const key='skills-lab:progress:v1';
  store.set(key,JSON.stringify({
   '__proto__':{bestScore:100,attempts:100,passed:true},
   valid:{bestScore:90,attempts:2,passed:false},
   invalid:{bestScore:'100',attempts:2,passed:true},
   broken:{bestScore:100,attempts:-2,passed:true},
  }));
  expect(loadProgress().valid).toEqual({bestScore:90,attempts:2,passed:false});
  expect(loadProgress().invalid).toBeUndefined();
  expect(loadProgress().broken).toBeUndefined();
  expect(()=>recordProgress('__proto__',50,false)).toThrow();
  expect(()=>recordProgress('plc-sbx-startstop',Infinity,false)).toThrow();
  expect(({} as Record<string,unknown>).bestScore).toBeUndefined();
 });
 it('updates valid progress without losing best score or passed state',()=>{
  expect(recordProgress('plc-sbx-startstop',80,true)['plc-sbx-startstop'])
   .toEqual({bestScore:80,attempts:1,passed:true});
  expect(recordProgress('plc-sbx-startstop',50,false)['plc-sbx-startstop'])
   .toEqual({bestScore:80,attempts:2,passed:true});
 });
});
