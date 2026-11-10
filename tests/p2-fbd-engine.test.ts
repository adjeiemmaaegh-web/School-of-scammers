import { describe, expect, it } from 'vitest';
import { compileFbd, executeFbd, fbdMotorStarter, type FbdDocument, type FbdNames } from '../src/engineering/fbd';

const legacy: FbdNames={ inputs:['Start','StopOK'], outputs:['Run'], requireRun:true };
const step = (doc:FbdDocument, inputs:Record<string,boolean>, memory = {}, coils = {}, dt=50) =>
  executeFbd(compileFbd(doc,legacy),inputs,coils,memory,dt);

describe('FBD graph compilation and deterministic runtime',()=>{
  it('uses real prior-scan coil feedback for the same latch as a Ladder start-stop',()=>{
    const program=fbdMotorStarter();
    let r=step(program,{Start:false,StopOK:true});
    expect(r.outputs.Run).toBe(false);
    r=step(program,{Start:true,StopOK:true},r.memory,r.outputs);
    expect(r.outputs.Run).toBe(true);
    r=step(program,{Start:false,StopOK:true},r.memory,r.outputs);
    expect(r.outputs.Run).toBe(true);
    r=step(program,{Start:false,StopOK:false},r.memory,r.outputs);
    expect(r.outputs.Run).toBe(false);
  });
  it('refuses cycles, output conflicts, missing wires, unknown tags and malicious IDs',()=>{
    const base=fbdMotorStarter();
    expect(()=>compileFbd({...base,nodes:[...base.nodes,{id:'again',kind:'output',tag:'Run',inputs:['start']}]},legacy)).toThrow(/duplicate/);
    expect(()=>compileFbd({...base,nodes:base.nodes.map(n=>n.id==='latch'?{...n,inputs:['enable','feedback']}:n)},legacy)).toThrow(/cycle/);
    expect(()=>compileFbd({...base,nodes:base.nodes.map(n=>n.id==='coil'?{...n,inputs:['missing']}:n)},legacy)).toThrow(/Missing/);
    expect(()=>compileFbd({...base,nodes:base.nodes.map(n=>n.id==='start'?{...n,tag:'NoSuchIo'}:n)},legacy)).toThrow(/mapped/);
    expect(()=>compileFbd({...base,nodes:base.nodes.map(n=>n.id==='start'?{...n,id:'__proto__'}:n)},legacy)).toThrow(/Invalid/);
  });
  it('TON and CTU use fixed simulation time and edge-triggered memory',()=>{
    const doc:FbdDocument={id:'timer-counter',version:'1',nodes:[
      {id:'start',kind:'input',tag:'Start'},
      {id:'reset',kind:'constant',value:false},
      {id:'ton',kind:'ton',preset:150,inputs:['start']},
      {id:'ctu',kind:'ctu',preset:2,inputs:['ton','reset']},
      {id:'coil',kind:'output',tag:'Run',inputs:['ctu']},
    ]};
    let m={};let outputs:Record<string,boolean>={};let result=step(doc,{Start:true,StopOK:true},m,outputs);
    for(let i=0;i<2;i++){expect(result.outputs.Run).toBe(false);m=result.memory;outputs=result.outputs;result=step(doc,{Start:true,StopOK:true},m,outputs)}
    expect(result.steps.find(s=>s.nodeId==='ton')?.elapsedMs).toBe(150);
    expect(result.steps.find(s=>s.nodeId==='ctu')?.count).toBe(1);
    m=result.memory;outputs=result.outputs;
    result=step(doc,{Start:false,StopOK:true},m,outputs);
    m=result.memory;outputs=result.outputs;
    for(let i=0;i<3;i++){result=step(doc,{Start:true,StopOK:true},m,outputs);m=result.memory;outputs=result.outputs;}
    expect(result.steps.find(s=>s.nodeId==='ctu')?.count).toBe(2);
    expect(result.outputs.Run).toBe(true);
  });
  it('SR set-dominant and RS reset-dominant agree with their block names',()=>{
    for(const kind of ['sr','rs'] as const){
      const doc:FbdDocument={id:'latch',version:'1',nodes:[
        {id:'set',kind:'input',tag:'Start'},
        {id:'reset',kind:'input',tag:'StopOK'},
        {id:'latch',kind,inputs:['set','reset']},
        {id:'coil',kind:'output',tag:'Run',inputs:['latch']},
      ]};
      const r=step(doc,{Start:true,StopOK:true});
      expect(r.outputs.Run).toBe(kind==='sr');
    }
  });
  it('only compares real numeric channels, never coerces 24V Boolean contacts',()=>{
    const names:FbdNames={inputs:['Start'],outputs:['Run'],numericInputs:['WeightKg'],requireRun:true};
    const doc:FbdDocument={id:'weigh',version:'1',nodes:[
      {id:'cmp',kind:'compare',tag:'WeightKg',comparator:'ge',threshold:12.5},
      {id:'out',kind:'output',tag:'Run',inputs:['cmp']},
    ]};
    const compiled=compileFbd(doc,names);
    expect(executeFbd(compiled,{WeightKg:13}).outputs.Run).toBe(true);
    expect(executeFbd(compiled,{WeightKg:12.3}).outputs.Run).toBe(false);
    expect(()=>executeFbd(compiled,{WeightKg:true})).toThrow(/numeric/);
    expect(()=>compileFbd(doc,{...names,numericInputs:[]})).toThrow(/numeric/);
  });
  it('same scan inputs, graph and prior memory reproduce exactly',()=>{
    const compiled=compileFbd(fbdMotorStarter(),legacy);
    const one=executeFbd(compiled,{Start:true,StopOK:true});
    const two=executeFbd(compiled,{Start:true,StopOK:true});
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });
});
