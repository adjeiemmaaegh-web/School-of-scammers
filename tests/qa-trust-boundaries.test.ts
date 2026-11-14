import {describe,it,expect,vi,afterEach} from 'vitest';
import {
 decodeAssignment,encodeAssignment,decodeResult,encodeResult,
 loadProgress,recordProgress,
} from '../src/platform/persistence';
import {getTrade,getLadder} from '../src/trades/registry';
import type {Assignment,AttemptResult} from '../src/platform/types';

const assignment:Assignment={
 kind:'skills-lab-assignment',formatVersion:1,trade:'plc',
 exerciseId:'plc-sbx-startstop',exerciseVersion:'1.0',
 mode:'assessment',seed:42,label:'Maintenance interview',
 createdAt:'2026-11-14T11:00:00.000Z',
};
const result:AttemptResult={
 kind:'skills-lab-result',formatVersion:1,assignment,
 startedAt:'2026-11-14T11:00:00.000Z',
 finishedAt:'2026-11-14T11:02:00.000Z',durationMs:120000,
 evidence:[{index:1,at:400,action:'operate',detail:'Pressed START',accepted:true}],
 rubric:{score:75,max:100,passed:true,safetyHold:false,
  criteria:[{id:'start',label:'Start sequence',max:100,earned:75,reason:'Physical PLC sequence accepted'}]},
};
const base64url=(bytes:Uint8Array):string=>{
 let text='';
 for(const byte of bytes)text+=String.fromCharCode(byte);
 return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const code=(data:unknown)=>base64url(new TextEncoder().encode(JSON.stringify(data)));
afterEach(()=>vi.unstubAllGlobals());
describe('QA: browser-facing share codes are untrusted payloads',()=>{
 it('round-trips real assignment and result including UTF-8 labels and evidence',()=>{
  const a={...assignment,label:'Maintenance électricité – 工場'};
  expect(decodeAssignment(encodeAssignment(a))).toEqual(a);
  const r={...result,assignment:a};
  expect(decodeResult(encodeResult(r))).toEqual(r);
 });
 it('rejects malicious or incomplete assignment records before candidate route consumes them',()=>{
  const bad=[
   {kind:'skills-lab-assignment'},
   {...assignment,formatVersion:999},
   {...assignment,seed:'invalid'},
   {...assignment,seed:-1},
   {...assignment,trade:'__proto__'},
   {...assignment,createdAt:'today'},
   {...assignment,label:'x'.repeat(200)},
   {...assignment,exerciseId:{toString:'plc'}},
   {...assignment,mode:'admin'},
  ];
  for(const payload of bad)expect(()=>decodeAssignment(code(payload))).toThrow();
 });
 it('rejects incomplete result codes before RubricReport can dereference them',()=>{
  const bad=[
   {kind:'skills-lab-result'},
   {...result,assignment:null},
   {...result,rubric:{}},
   {...result,rubric:{...result.rubric,criteria:null}},
   {...result,rubric:{...result.rubric,score:Infinity}},
   {...result,rubric:{...result.rubric,score:101}},
   {...result,rubric:{...result.rubric,criteria:[{id:'x',label:'Y',max:1,earned:2,reason:''}]}},
   {...result,evidence:[{index:1,at:-1,action:'operate',detail:'bad',accepted:true}]},
   {...result,evidence:[{index:1,at:1,action:{danger:'object'},detail:'bad',accepted:true}]},
   {...result,finishedAt:'2020-01-01T00:00:00.000Z'},
   {...result,durationMs:-1},
  ];
  for(const payload of bad)expect(()=>decodeResult(code(payload))).toThrow();
 });
 it('bounds extremely long base64 before UTF-8 decoding or JSON parsing',()=>{
  expect(()=>decodeAssignment('A'.repeat(8193))).toThrow(/oversized/i);
  expect(()=>decodeResult('A'.repeat(262145))).toThrow(/oversized/i);
  expect(()=>decodeResult(code({kind:'skills-lab-result',rubric:{criteria:Array(101).fill(null)}}))).toThrow();
  expect(()=>decodeAssignment('not+base64')).toThrow();
 });
 it('rejects malformed UTF-8 and malformed base64 without reaching the review UI',()=>{
  expect(()=>decodeResult(base64url(Uint8Array.from([0xff,0xfe,0xfd])))).toThrow();
  expect(()=>decodeAssignment('abcde')).toThrow();
 });
 it('does not return unknown extra fields as trusted assignment or grading fields',()=>{
  const a=decodeAssignment(code({...assignment,admin:true}));
  expect(Object.hasOwn(a,'admin')).toBe(false);
  const r=decodeResult(code({...result,role:'root',rubric:{...result.rubric,admin:true}}));
  expect(Object.hasOwn(r,'role')).toBe(false);
  expect(Object.hasOwn(r.rubric,'admin')).toBe(false);
 });
});
describe('QA: untrusted trade routes and local progress',()=>{
 it.each(['__proto__','prototype','constructor','toString','hasOwnProperty','valueOf'])(
  'unknown route parameter %s never resolves as a legitimate trade',id=>{
   expect(getTrade(id)).toBeUndefined();
   expect(getLadder(id)).toEqual([]);
  });
 it('retains legitimate trade modules unchanged',()=>{
  expect(getTrade('plc')?.meta.id).toBe('plc');
  expect(getTrade('cctv')?.meta.id).toBe('cctv');
 });
 it('refuses malformed localStorage map entries while retaining valid records',()=>{
  const data=JSON.stringify({
   'plc-conveyor-start':{bestScore:90,attempts:2,passed:true},
   bad:null,
   weird:{bestScore:'100',attempts:1,passed:true},
   '__proto__':{bestScore:10,attempts:1,passed:true},
   wrong:{bestScore:NaN,attempts:-1,passed:'yes'},
  });
  const entries=new Map([['skills-lab:progress:v1',data]]);
  vi.stubGlobal('localStorage',{
   getItem:(key:string)=>entries.get(key)??null,
   setItem:(key:string,value:string)=>entries.set(key,value),
  });
  expect(loadProgress()).toEqual({'plc-conveyor-start':{
   bestScore:90,attempts:2,passed:true,
  }});
  expect(recordProgress('plc-conveyor-start',95,true)['plc-conveyor-start'])
   .toEqual({bestScore:95,attempts:3,passed:true});
  expect(()=>recordProgress('__proto__',50,true)).toThrow();
  expect(()=>recordProgress('x',Number.NaN,false)).toThrow();
 });
 it('returns an empty progress map for corrupt, oversized or array storage',()=>{
  let raw='bad JSON';
  vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:()=>{}});
  expect(loadProgress()).toEqual({});
  raw='x'.repeat(150001);
  expect(loadProgress()).toEqual({});
  raw='[]';
  expect(loadProgress()).toEqual({});
 });
});
