import {describe,expect,it} from 'vitest';
import {applyLocalForce,localForceError} from '../src/program/local-force';
import {createWorld,tick,renderSnapshot} from '../src/sim/orchestrator';
import type {LadderDocument,SymbolDefinition} from '../src/engineering/ladder';

const doc: LadderDocument={id:'force-test',version:'1',
  symbols:{Ready:{description:'Internal readiness bit',type:'BOOL'},
    Count:{description:'Local instruction register',type:'INT',initial:1},
    GuardReady:{description:'Safety-like internal bit',type:'BOOL'}},
  rungs:[{id:'r1',elements:[{type:'contact',tag:'Ready'}],coil:'Run'}],
};
describe('P2 explicit local memory forces',()=>{
  it('accepts local BOOL and bounded numeric values, preserves original map and clears one force',()=>{
    const a=applyLocalForce({},doc,'Ready',true);
    expect(a).toEqual({Ready:true});
    const b=applyLocalForce(a,doc,'Count',12);
    expect(a).toEqual({Ready:true});
    expect(b).toEqual({Ready:true,Count:12});
    expect(applyLocalForce(b,doc,'Ready',null)).toEqual({Count:12});
  });
  it('refuses physical input/output and safety-like names, impossible types and overflow',()=>{
    expect(localForceError(doc,'Start',true)).toMatch(/local/);
    expect(localForceError(doc,'Run',true)).toMatch(/local/);
    expect(localForceError(doc,'GuardReady',true)).toMatch(/Safety/);
    expect(localForceError(doc,'Ready',42)).toMatch(/BOOL/);
    expect(localForceError(doc,'Count',1.3)).toMatch(/INT/);
    expect(localForceError(doc,'Count',32768)).toMatch(/INT/);
  });
  it('forces internal memory via the authoritative scan but cannot force hardwired STOP',()=>{
    let w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'loadProgram',program:doc}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'forceLocal',tag:'Ready',value:true}]).world;
    expect(w.lastError).toBeNull();
    expect(renderSnapshot(w).debugForces).toEqual({Ready:true});
    w=tick(w,[{k:'run'}]).world;
    for(let i=0;i<5;i++)w=tick(w).world;
    expect(w.tagValues.Ready).toBe(true);
    expect(w.coils.Run).toBe(true);
    expect(w.deviceOn['motor-1']).toBe(true);
    w=tick(w,[{k:'forceLocal',tag:'Ready',value:null}]).world;
    expect(w.lastError).toMatch(/Pause/);
    w=tick(w,[{k:'pause'},{k:'forceLocal',tag:'Ready',value:null}]).world;
    expect(w.lastError).toBeNull();
    expect(w.debugForces['plc-1']).toBeUndefined();
    expect(tick(w,[{k:'forceLocal',tag:'Start',value:true}]).world.lastError).toMatch(/local/);
  });
  it('does not persist debug overrides into the user project and reset clears them',()=>{
    let w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
    w=tick(w,[{k:'loadProgram',program:doc},{k:'forceLocal',tag:'Count',value:4}]).world;
    expect(w.project).not.toHaveProperty('debugForces');
    expect(w.debugForces['plc-1']).toEqual({Count:4});
    w=tick(w,[{k:'reset'}]).world;
    expect(w.debugForces).toEqual({});
  });
});
