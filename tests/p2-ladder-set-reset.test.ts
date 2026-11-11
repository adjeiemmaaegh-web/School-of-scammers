import {describe,expect,it} from 'vitest';
import {executeLadder,validateLadder,type LadderDocument} from '../src/engineering/ladder';
import {createWorld,tick} from '../src/sim/orchestrator';
import {validateSandboxProgram} from '../src/program/p2-contract';

const document: LadderDocument={id:'set-reset',version:'1',rungs:[
  {id:'set-run',elements:[{type:'contact',tag:'Start'}],coil:'Run',operation:{kind:'set'}},
  {id:'reset-run',elements:[{type:'contact',tag:'StopOK',normallyClosed:true}],coil:'Run',operation:{kind:'reset'}},
]};
const inputs=(start:boolean,stopOK:boolean)=>({Start:start,StopOK:stopOK,Photoeye:false,TankHigh:false,ReverseRequest:false});
describe('P2 Ladder retentive SET and RESET',()=>{
  it('sets, retains and resets a BOOL output with distinct real input conditions',()=>{
    expect(validateLadder(document)).toEqual([]);
    expect(validateSandboxProgram(document)).toEqual([]);
    let coils:Record<string,boolean>={};
    let r=executeLadder(document,inputs(false,true),coils);expect(r.outputs.Run).toBe(false);
    coils=r.outputs;r=executeLadder(document,inputs(true,true),coils);expect(r.outputs.Run).toBe(true);
    coils=r.outputs;r=executeLadder(document,inputs(false,true),coils);expect(r.outputs.Run).toBe(true);
    coils=r.outputs;r=executeLadder(document,inputs(false,false),coils);expect(r.outputs.Run).toBe(false);
  });
  it('rejects same-tag regular coils and multiple SET/RESET writers',()=>{
    const conflict={...document,rungs:[...document.rungs,
      {id:'normal',elements:[{type:'contact' as const,tag:'Start'}],coil:'Run'}]};
    expect(validateLadder(conflict).join(';')).toMatch(/duplicate/);
    const triple={...document,rungs:[...document.rungs,document.rungs[0]]};
    expect(validateLadder(triple).join(';')).toMatch(/duplicate/);
    const twin={...document,rungs:[
      document.rungs[0],{...document.rungs[0],id:'set-again'}]};
    expect(validateLadder(twin).join(';')).toMatch(/duplicate/);
  });
  it('uses the actual PLC worker to energize and stop a wired motor',()=>{
    let w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
    w=tick(w,[{k:'loadProgram',program:document}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'run'},{k:'operate',id:'start-1',pressed:true}]).world;
    for(let i=0;i<6;i++)w=tick(w).world;
    expect(w.deviceOn['motor-1']).toBe(true);
    w=tick(w,[{k:'operate',id:'start-1',pressed:false}]).world;
    for(let i=0;i<6;i++)w=tick(w).world;
    expect(w.deviceOn['motor-1']).toBe(true);
    w=tick(w,[{k:'operate',id:'stop-1',pressed:true}]).world;
    for(let i=0;i<6;i++)w=tick(w).world;
    expect(w.deviceOn['motor-1']).toBe(false);
  });
});
