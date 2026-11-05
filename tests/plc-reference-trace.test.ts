import {describe,it,expect} from 'vitest';
import {compareReferenceCsv,referenceTraceTemplate} from '../src/engineering/plc-reference-trace';
import type {LadderDocument} from '../src/engineering/ladder';
const p:LadderDocument={id:'ExternalBench',version:'1',rungs:[{id:'run',coil:'Run',elements:[{type:'contact',tag:'Start'},{type:'contact',tag:'Stop',normallyClosed:true}]},{id:'timer',coil:'Delay',elements:[{type:'contact',tag:'Start'}],operation:{kind:'ton',presetMs:200}}]};
const header='scan,delta_ms,input:Start,input:Stop,output:Run,output:Delay';
describe('evidence-driven, externally supplied PLC trace comparison',()=>{
 it('checks every output on sequential recorded scan input images and clock',()=>{
  const csv=[header,'1,100,1,0,1,0','2,100,1,0,1,1','3,100,0,0,0,0'].join('\n');
  const r=compareReferenceCsv(p,csv);
  expect(r).toMatchObject({scans:3,checks:6,matches:6,mismatches:0,sourceVerified:false});
  expect(r.outcomes.map(x=>x.timeMs)).toEqual([100,200,300]);
  expect(referenceTraceTemplate(p)).toContain('input:Start');
  expect(referenceTraceTemplate(p)).toContain('output:Delay');
 });
 it('preserves scan/tag/expected/observed mismatch evidence without fabricating an independent source',()=>{
  const r=compareReferenceCsv(p,[header,'1,100,1,0,0,0','2,100,1,0,1,1'].join('\n'));
  expect(r.mismatches).toBe(1);
  expect(r.firstMismatches).toEqual([{scan:1,tag:'Run',expected:false,actual:true}]);
  expect(r.sourceVerified).toBe(false);
 });
 it('rejects incomplete, nonsequential, altered, malformed or unknown reference data',()=>{
  expect(()=>compareReferenceCsv(p,'scan,delta_ms,input:Start,output:Run\n1,100,1,1')).toThrow(/omits output/);
  expect(()=>compareReferenceCsv(p,[header,'2,100,1,0,1,0'].join('\n'))).toThrow(/Nonsequential/);
  expect(()=>compareReferenceCsv(p,[header,'1,0,1,0,1,0'].join('\n'))).toThrow(/interval/);
  expect(()=>compareReferenceCsv(p,[header,'1,100,on,0,1,0'].join('\n'))).toThrow(/Boolean/);
  expect(()=>compareReferenceCsv(p,[header.replace('output:Delay','output:Unknown'),'1,100,1,0,1,0'].join('\n'))).toThrow(/not present/);
 });
 it('rejects duplicate columns and quoted CSV without trying to evaluate spreadsheet formulas',()=>{
  expect(()=>compareReferenceCsv(p,[header.replace('input:Stop','input:Start'),'1,100,1,0,1,0'].join('\n'))).toThrow(/Duplicate/);
  expect(()=>compareReferenceCsv(p,[header,'1,100,"TRUE",0,1,0'].join('\n'))).toThrow(/unquoted/);
  expect(()=>compareReferenceCsv(p,'x'.repeat(200001))).toThrow(/200 KB/);
 });
});
