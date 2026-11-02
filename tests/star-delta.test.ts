import {describe,it,expect} from 'vitest';
import {STARTER_INPUTS,STARTER_CONFIG,initialStarter,stepStarDelta,injectStarterFault,runStarterSequence,starterSample,starterCsv} from '../src/engineering/star-delta';

const start={...STARTER_INPUTS,start:true};
function toStar(){return stepStarDelta(initialStarter(),start);}
function toDelta(){
 let s=toStar();
 for(let i=0;i<33;i++)s=stepStarDelta(s,{...STARTER_INPUTS});
 return s;
}
describe('star–delta industrial control exercise (educational model)',()=>{
 it('requires a permissive and starts with STAR only',()=>{
  const no=stepStarDelta(initialStarter(),{...start,guardClosed:false});
  expect(no.phase).toBe('idle');
  const s=toStar();
  expect(starterSample(s)).toMatchObject({phase:'star',main:true,star:true,delta:false});
 });
 it('has a non-overlapping changeover interval before DELTA',()=>{
  let s=toStar();const samples=[];
  for(let i=0;i<40;i++){s=stepStarDelta(s,STARTER_INPUTS);samples.push(starterSample(s));}
  expect(samples.some(x=>x.phase==='deadtime')).toBe(true);
  expect(samples.some(x=>x.phase==='delta')).toBe(true);
  expect(samples.every(x=>!(x.star&&x.delta))).toBe(true);
  expect(samples.filter(x=>x.phase==='deadtime').every(x=>x.main&&!x.star&&!x.delta)).toBe(true);
 });
 it('stop and protective inputs interrupt the sequence',()=>{
  expect(stepStarDelta(toStar(),{...STARTER_INPUTS,stop:true}).phase).toBe('idle');
  const blocked=stepStarDelta(toStar(),{...STARTER_INPUTS,estopOk:false});
  expect(blocked.phase).toBe('tripped');
  expect(starterSample(blocked).main).toBe(false);
  expect(stepStarDelta(blocked,STARTER_INPUTS).phase).toBe('tripped');
  expect(stepStarDelta(blocked,{...STARTER_INPUTS,reset:true}).phase).toBe('idle');
 });
 it('overload or loss of guard during DELTA deenergizes commands',()=>{
  const s=toDelta();expect(s.phase).toBe('delta');
  for(const inputs of [{...STARTER_INPUTS,overloadOk:false},{...STARTER_INPUTS,guardClosed:false}]){
   const stopped=stepStarDelta(s,inputs);
   expect(stopped.phase).toBe('tripped');
   expect(starterSample(stopped)).toMatchObject({main:false,star:false,delta:false});
  }
 });
 it('only allows fault injection under isolation',()=>{
  expect(()=>injectStarterFault(toStar(),'star-welded',true)).toThrow(/Isolate/);
  expect(()=>injectStarterFault(initialStarter(),'star-welded',false)).toThrow(/Isolate/);
  expect(injectStarterFault(initialStarter(),'star-welded',true).fault).toBe('star-welded');
 });
 it('welded STAR contact blocks DELTA and requires simulated repair',()=>{
  let s=injectStarterFault(initialStarter(),'star-welded',true);
  s=stepStarDelta(s,start);
  for(let i=0;i<35;i++)s=stepStarDelta(s,STARTER_INPUTS);
  expect(s.phase).toBe('tripped');
  expect(s.starWeldLatched).toBe(true);
  expect(starterSample(s).delta).toBe(false);
  expect(starterSample(s).hazard).toBe(true);
  expect(stepStarDelta(s,{...STARTER_INPUTS,reset:true}).phase).toBe('tripped');
  s=injectStarterFault(s,'none',true);
  expect(stepStarDelta(s,{...STARTER_INPUTS,reset:true}).phase).toBe('idle');
 });
 it('a stuck transfer timer trips rather than remaining in STAR forever',()=>{
  let s=injectStarterFault(initialStarter(),'timer-stuck',true);
  s=stepStarDelta(s,start);
  for(let i=0;i<61;i++)s=stepStarDelta(s,STARTER_INPUTS);
  expect(s.phase).toBe('tripped');
  expect(s.message).toMatch(/timeout/i);
 });
 it('detects a welded DELTA contact following stop',()=>{
  let s=injectStarterFault(initialStarter(),'delta-welded',true);
  s=stepStarDelta(s,start);
  for(let i=0;i<40;i++)s=stepStarDelta(s,STARTER_INPUTS);
  expect(s.deltaWeldLatched).toBe(true);
  s=stepStarDelta(s,{...STARTER_INPUTS,stop:true});
  expect(s.phase).toBe('idle');
  expect(s.hazard).toBe(true);
  expect(starterSample(s).deltaFeedback).toBe(true);
 });
 it('is deterministic, bounded, and produces full CSV evidence',()=>{
  const commands=[{inputs:start,scans:1},{inputs:STARTER_INPUTS,scans:40},{inputs:{...STARTER_INPUTS,stop:true},scans:1}];
  const a=runStarterSequence(initialStarter(),commands);
  expect(runStarterSequence(initialStarter(),commands)).toEqual(a);
  expect(a.rows).toHaveLength(42);
  expect(starterCsv(a.rows).split('\r\n')).toHaveLength(43);
  expect(()=>runStarterSequence(initialStarter(),[{inputs:start,scans:3001}])).toThrow(/3000/);
  expect(()=>stepStarDelta(initialStarter(),start,2000)).toThrow();
  expect(()=>stepStarDelta(initialStarter(),start,100,{...STARTER_CONFIG,deadTimeMs:0})).toThrow();
 });
});