import {describe,it,expect} from 'vitest';
import {injectInputFault,compareInputFault} from '../src/engineering/input-fault-campaign';
import {SEQUENCE_EXAMPLES,type VectorStep} from '../src/engineering/ladder-sequences';
import type {LadderDocument} from '../src/engineering/ladder';

const steps=SEQUENCE_EXAMPLES['start-stop'];
const startStop:LadderDocument={id:'fault-campaign-start-stop',version:'1',rungs:[{id:'seal-in',elements:[
  {type:'contact',tag:'EStopOK'},
  {type:'contact',tag:'GuardClosed'},
  {type:'contact',tag:'Stop',normallyClosed:true},
  {type:'branch',alternatives:[[{type:'contact',tag:'Start'}],[{type:'contact',tag:'RunLatch'}]]}
],coil:'RunLatch'}]};

/** The fault injector emits input *changes*, not complete I/O snapshots. */
function expandedInputs(changes:readonly VectorStep[]):Record<string,boolean>[]{
 const states:Record<string,boolean>[]=[];
 let inputs:Record<string,boolean>={};
 for(const step of changes){
  inputs={...inputs,...step.inputs};
  for(let scan=0;scan<step.scans;scan++)states.push({...inputs});
 }
 return states;
}

describe('scan-bounded input faults',()=>{
 it('preserves original sequence',()=>{
  const snapshot=JSON.stringify(steps);
  injectInputFault(steps,{tag:'Start',startScan:2,durationScans:2,mode:'stuck-off'});
  expect(JSON.stringify(steps)).toBe(snapshot);
 });
 it('restores the intended signal after the fault window',()=>{
  const original=expandedInputs(steps);
  const injected=injectInputFault(steps,{tag:'Start',startScan:3,durationScans:1,mode:'stuck-on'});
  const altered=expandedInputs(injected);
  expect(altered).toHaveLength(original.length);
  expect(original[2].Start).toBe(false);
  expect(altered[2].Start).toBe(true);
  expect(altered[3].Start).toBe(original[3].Start);
  for(const index of [0,1,3])expect(altered[index]).toEqual(original[index]);
 });
 it('rejects out of bounds fault',()=>expect(()=>injectInputFault(steps,{tag:'Start',startScan:4,durationScans:2,mode:'invert'})).toThrow());
 it('rejects unassigned tag',()=>expect(()=>injectInputFault(steps,{tag:'Unknown',startScan:2,durationScans:1,mode:'stuck-on'})).toThrow());
 it('detects fault-driven assertion failures in an actual seal-in circuit',()=>{
  const r=compareInputFault(startStop,steps,{tag:'Start',startScan:2,durationScans:1,mode:'stuck-off'});
  expect(r.totalScans).toBe(4);
  expect(r.normalPassed).toBe(true);
  expect(r.faultedPassed).toBe(false);
  expect(r.injected.length).toBeGreaterThan(0);
  expect(r.differences.some(d=>d.scan===2&&d.tag==='RunLatch')).toBe(true);
 });
});
