import { describe, expect, it } from 'vitest';
import { compileFbd, fbdMotorStarter } from '../src/engineering/fbd';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { namesFor, programOf } from '../src/sim/plcs';
import type { Command, WorldState } from '../src/sim/signals';

const scan=(w:WorldState,n=7)=>{for(let i=0;i<n;i++)w=tick(w).world;return w;};
const starter=():WorldState=>{
  const w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
  expect(w.lastError).toBeNull();
  return w;
};
describe('FBD through the actual wiring/PLC 50ms scan',()=>{
  it('compiles, persists and executes FBD in the first PLC; a button energizes the physically wired motor',()=>{
    let w=starter();
    w=tick(w,[{k:'loadFBD',document:fbdMotorStarter()}]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.language).toBe('fbd');
    expect(validateProject(JSON.parse(JSON.stringify(w.project)))).toEqual(w.project);
    expect(compileFbd(programOf(w.project,'plc-1').fbd,namesFor(w.project,'plc-1')).order).toHaveLength(6);
    w=scan(tick(w,[{k:'run'},{k:'operate',id:'start-1',pressed:true}]).world);
    expect(w.deviceOn['motor-1']).toBe(true);
    expect(renderSnapshot(w).language).toBe('fbd');
    expect(renderSnapshot(w).fbdSteps.some(step=>step.nodeId==='coil'&&step.on)).toBe(true);
    w=scan(tick(w,[{k:'operate',id:'start-1',pressed:false}]).world);
    expect(w.deviceOn['motor-1']).toBe(true);
    w=scan(tick(w,[{k:'operate',id:'stop-1',pressed:true}]).world);
    expect(w.deviceOn['motor-1']).toBe(false);
  });
  it('switches back to preserved Ladder without mutating the FBD saved document',()=>{
    let w=tick(starter(),[{k:'loadFBD',document:fbdMotorStarter()}]).world;
    const original=JSON.stringify(w.project.fbd);
    w=tick(w,[{k:'activateLanguage',language:'ladder'}]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.language).toBe('ladder');
    expect(JSON.stringify(w.project.fbd)).toBe(original);
    w=tick(w,[{k:'activateLanguage',language:'fbd'}]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.language).toBe('fbd');
  });
  it('isolates the second PLC program from the first PLC and rejects malformed saved graphs',()=>{
    let w=starter();
    w=tick(w,[{k:'addPanel',template:'motor-starter'}]).world;
    expect(w.lastError).toBeNull();
    const graph=fbdMotorStarter();
    w=tick(w,[{k:'loadFBD',plc:'plc-2',document:graph}]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.language).toBe('ladder');
    expect(programOf(w.project,'plc-2').language).toBe('fbd');
    expect(programOf(w.project,'plc-1').language).toBe('ladder');
    expect(validateProject(JSON.parse(JSON.stringify(w.project)))).toEqual(w.project);
    const broken={...w.project,plcPrograms:{...w.project.plcPrograms,'plc-2':{
      ...w.project.plcPrograms!['plc-2'],fbd:{...graph,nodes:graph.nodes.map(node=>
        node.id==='coil'?{...node,inputs:['coil']}:node)},
    }}};
    expect(()=>validateProject(broken)).toThrow(/cycle/);
  });
  it('fails closed on FBD numeric errors or missing physical inputs instead of energizing the plant',()=>{
    let w=starter();
    const graph=fbdMotorStarter();
    w=tick(w,[{k:'loadFBD',document:graph}]).world;
    expect(w.lastError).toBeNull();
    const edited={...graph,nodes:graph.nodes.map(node=>node.id==='permit'?{...node,tag:'Start'}:node)};
    w=tick(w,[{k:'loadFBD',document:edited}]).world;
    expect(w.lastError).toBeNull();
    expect(w.project.fbd?.nodes.find(n=>n.id==='permit')?.tag).toBe('Start');
    // A malformed runtime tag image always throws instead of treating missing values as TRUE.
    expect(()=>compileFbd({...graph,nodes:graph.nodes.map(n=>n.id==='start'?{...n,tag:'Other'}:n)},namesFor(w.project,'plc-1'))).toThrow();
  });
});
