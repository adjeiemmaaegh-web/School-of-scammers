import { describe, expect, it } from 'vitest';
import { createWorld, reversingProgram, renderSnapshot, tick, validateProject, validateSandboxProgram } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';
import { COMPONENTS } from '../src/components/registry';

const devices:Command[] = [
  {k:'place',kind:'supply',id:'supply',at:{x:25,y:25}},
  {k:'place',kind:'breaker',id:'breaker',at:{x:175,y:25}},
  {k:'place',kind:'estop',id:'estop',at:{x:130,y:245}},
  {k:'place',kind:'plc',id:'plc',at:{x:350,y:25}},
  {k:'place',kind:'start',id:'start',at:{x:25,y:405}},
  {k:'place',kind:'reversebutton',id:'reversebutton',at:{x:250,y:405}},
  {k:'place',kind:'stop',id:'stop',at:{x:340,y:245}},
  {k:'place',kind:'forwardcontactor',id:'forwardcontactor',at:{x:595,y:25}},
  {k:'place',kind:'reversecontactor',id:'reversecontactor',at:{x:595,y:245}},
  {k:'place',kind:'revmotor',id:'revmotor',at:{x:875,y:25}},
];
const connections = [
  ['supply.P24','breaker.IN'], ['breaker.OUT','estop.A'],
  ['estop.B','plc.L+'], ['supply.M0','plc.M'],
  ['estop.B','start.A'], ['start.B','plc.I0.0'],
  ['estop.B','reversebutton.A'], ['reversebutton.B','plc.I0.4'],
  ['estop.B','stop.A'], ['stop.B','plc.I0.1'],
  ['supply.M0','forwardcontactor.A2'], ['supply.M0','reversecontactor.A2'],
  ['plc.Q0.4','reversecontactor.21'], ['reversecontactor.22','forwardcontactor.A1'],
  ['plc.Q0.5','forwardcontactor.21'], ['forwardcontactor.22','reversecontactor.A1'],
  ['estop.B','forwardcontactor.13'], ['estop.B','reversecontactor.13'],
  ['forwardcontactor.14','revmotor.F+'], ['reversecontactor.14','revmotor.R+'],
  ['supply.M0','revmotor.M-'],
] as const;
function build(missing:number[]=[]):WorldState {
  return tick(createWorld(),[
    ...devices,
    ...connections.flatMap(([from,to],i):Command[]=>missing.includes(i)?[]:
      [{k:'wire',id:`wire${i}`,from,to}]),
    {k:'loadProgram',program:reversingProgram()},
  ]).world;
}
function scan(w:WorldState,n=1) { for(let i=0;i<n;i++)w=tick(w).world;return w;}
function press(w:WorldState,id:'start'|'reversebutton'|'stop'|'estop') {
  return tick(w,[{k:'operate',id,pressed:true}]).world;
}
function release(w:WorldState,id:'start'|'reversebutton'|'stop'|'estop') {
  return tick(w,[{k:'operate',id,pressed:false}]).world;
}
function run(w:WorldState) {return tick(w,[{k:'run'}]).world;}
describe('P4 actual interlocked forward / reverse drive',()=>{
  it('runs forward, stops through real STOP circuit, then runs reverse with signed shaft motion',()=>{
    expect(validateSandboxProgram(reversingProgram())).toEqual([]);
    let w=run(build());
    w=scan(press(w,'start'),6);
    expect(w.motorDirection).toBe('forward');
    expect(w.forwardContactorOn).toBe(true);
    expect(w.reverseContactorOn).toBe(false);
    expect(w.interlockConflict).toBe(false);
    expect(w.coils.Forward).toBe(true);
    expect(w.inputs.Start).toBe(true);
    const first=w.reverseMotorAngleRad;
    w=scan(release(w,'start'),3);
    expect(w.motorDirection).toBe('forward');
    expect(w.reverseMotorAngleRad).not.toBe(first);
    w=scan(press(w,'stop'),5);
    expect(w.motorDirection).toBe('stopped');
    expect(w.forwardContactorOn).toBe(false);
    const held=w.reverseMotorAngleRad;
    w=scan(w,4);
    expect(w.reverseMotorAngleRad).toBe(held);
    w=release(w,'stop');
    w=scan(press(w,'reversebutton'),6);
    expect(w.inputs.ReverseRequest).toBe(true);
    expect(w.motorDirection).toBe('reverse');
    expect(w.reverseContactorOn).toBe(true);
    expect(w.forwardContactorOn).toBe(false);
    expect(w.reverseMotorAngleRad).not.toBe(held);
    expect(renderSnapshot(w).motorDirection).toBe('reverse');
  });
  it('requires a real STOP cycle before opposite request can reverse an already latched motor',()=>{
    let w=scan(press(run(build()),'start'),7);
    w=scan(release(w,'start'),2);
    expect(w.motorDirection).toBe('forward');
    w=scan(press(w,'reversebutton'),7);
    expect(w.motorDirection).toBe('forward');
    expect(w.coils.Forward).toBe(true);
    expect(w.coils.Reverse).toBe(false);
    w=scan(release(w,'reversebutton'),2);
    w=scan(press(w,'stop'),5);
    expect(w.motorDirection).toBe('stopped');
    w=scan(release(w,'stop'),2);
    w=scan(press(w,'reversebutton'),7);
    expect(w.motorDirection).toBe('reverse');
    w=scan(release(w,'reversebutton'),2);
    w=scan(press(w,'start'),6);
    expect(w.motorDirection).toBe('reverse');
    expect(w.coils.Forward).toBe(false);
    expect(w.coils.Reverse).toBe(true);
  });
  it('rejected simultaneous start/reverse requests cannot energize opposing output coils in safe example',()=>{
    let w=run(build());
    w=tick(w,[{k:'operate',id:'start',pressed:true},
      {k:'operate',id:'reversebutton',pressed:true}]).world;
    w=scan(w,7);
    expect(w.inputs.Start).toBe(true);
    expect(w.inputs.ReverseRequest).toBe(true);
    expect(w.coils.Forward).toBe(false);
    expect(w.coils.Reverse).toBe(false);
    expect(w.forwardContactorOn).toBe(false);
    expect(w.reverseContactorOn).toBe(false);
    expect(w.motorDirection).toBe('stopped');
  });
  it('cross-wired NC contacts actually block a direction if its auxiliary feed is missing',()=>{
    let w=scan(press(run(build([13])),'start'),8);
    expect(w.coils.Forward).toBe(true);
    expect(w.forwardContactorOn).toBe(false);
    expect(w.motorDirection).toBe('stopped');
    w=scan(press(run(build([15])),'reversebutton'),8);
    expect(w.coils.Reverse).toBe(true);
    expect(w.reverseContactorOn).toBe(false);
    expect(w.motorDirection).toBe('stopped');
  });
  it('a deliberately unsafe Ladder program demanding both coils triggers mechanical interlock alarm',()=>{
    const wrong={
      ...reversingProgram(),
      rungs:[
        {id:'unsafe-forward',elements:[{type:'contact' as const,tag:'StopOK'}],coil:'Forward'},
        {id:'unsafe-reverse',elements:[{type:'contact' as const,tag:'StopOK'}],coil:'Reverse'},
        {id:'inactive',elements:[{type:'contact' as const,tag:'Unused'}],coil:'Run'},
      ],
    };
    expect(validateSandboxProgram(wrong)).toEqual([]);
    let w=tick(build(),[{k:'loadProgram',program:wrong}]).world;
    w=run(w);
    const events:string[]=[];
    for(let i=0;i<9;i++){const out=tick(w);w=out.world;events.push(...out.events.map(e=>e.detail));}
    expect(w.coils.Forward).toBe(true);
    expect(w.coils.Reverse).toBe(true);
    expect(w.interlockConflict).toBe(true);
    expect(w.forwardContactorOn).toBe(false);
    expect(w.reverseContactorOn).toBe(false);
    expect(w.motorDirection).toBe('stopped');
    expect(w.diagnostics.some(d=>d.includes('mechanical interlock'))).toBe(true);
    expect(events.some(d=>d.includes('Simultaneous contactor-coil'))).toBe(true);
  });
  it('miswiring both direction motor inputs to one live contact correctly inhibits movement',()=>{
    let w=build();
    w=tick(w,[{k:'wire',id:'bypass',from:'forwardcontactor.14',to:'revmotor.R+'}]).world;
    w=scan(press(run(w),'start'),8);
    expect(w.forwardContactorOn).toBe(true);
    expect(w.reverseContactorOn).toBe(false);
    expect(w.motorDirection).toBe('stopped');
    expect(w.diagnostics.some(d=>d.includes('Both direction terminals'))).toBe(true);
  });
  it('missing reverse main contact or reverse motor M- keeps actual motor stationary',()=>{
    let w=scan(press(run(build([19])),'reversebutton'),8);
    expect(w.reverseContactorOn).toBe(true);
    expect(w.motorDirection).toBe('stopped');
    w=scan(press(run(build([20])),'start'),8);
    expect(w.forwardContactorOn).toBe(true);
    expect(w.motorDirection).toBe('stopped');
  });
  it('training E-stop cuts PLC and motor power; release does not auto-restart prior Run',()=>{
    let w=scan(press(run(build()),'start'),7);
    w=scan(press(w,'estop'),6);
    expect(w.powered).toBe(false);
    expect(w.motorDirection).toBe('stopped');
    expect(w.forwardContactorOn).toBe(false);
    expect(w.reverseContactorOn).toBe(false);
    // Release the momentary START command before resetting the supply path.
    // The prior PLC Run memory has been lost during E-stop isolation.
    w=scan(release(w,'start'),2);
    w=scan(release(w,'estop'),5);
    expect(w.motorDirection).toBe('stopped');
  });
  it('typed ST Forward/Reverse BOOL outputs use the SAME physical interlock and motor loads',()=>{
    const st=[
      'VAR_INPUT',' Start : BOOL;',' ReverseRequest : BOOL;',' StopOK : BOOL;','END_VAR',
      'VAR_OUTPUT',' Run : BOOL;',' Forward : BOOL;',' Reverse : BOOL;','END_VAR',
      'Run := FALSE;',
      'Forward := StopOK AND Start AND NOT ReverseRequest;',
      'Reverse := StopOK AND ReverseRequest AND NOT Start;',
    ].join('\n');
    let w=tick(build(),[{k:'loadST',source:st}]).world;
    expect(w.project.language).toBe('st');
    w=scan(press(run(w),'reversebutton'),7);
    expect(w.motorDirection).toBe('reverse');
    w=scan(release(w,'reversebutton'),5);
    expect(w.motorDirection).toBe('stopped');
    w=scan(press(w,'start'),7);
    expect(w.motorDirection).toBe('forward');
  });
  it('validates v1 project shape, duplicate reversing device and fresh reset state',()=>{
    const w=build();
    expect(w.project.components).toHaveLength(10);
    expect(w.project.wires).toHaveLength(21);
    expect(validateProject(w.project).formatVersion).toBe(1);
    for(const kind of ['reversebutton','forwardcontactor','reversecontactor','revmotor'] as const){
      const dup=tick(w,[{k:'place',id:'duplicate',kind,at:{x:920,y:440}}]).world;
      expect(dup.project.components).toHaveLength(10);
      expect(dup.lastError).toMatch(/one of each station/);
    }
    expect(COMPONENTS.revmotor.terminals.map(t=>t.name)).toEqual(['F+','R+','M-']);
    const reset=tick(scan(press(run(w),'start'),5),[{k:'reset'}]).world;
    expect(reset.motorDirection).toBe('stopped');
    expect(reset.forwardContactorOn).toBe(false);
    expect(reset.reverseMotorAngleRad).toBe(0);
  });
  it('replays a directional change and emergency stop deterministically without renderer state',()=>{
    const commands:Command[][]=[
      [{k:'run'}],[{k:'operate',id:'start',pressed:true}],[],[],[],[],
      [{k:'operate',id:'start',pressed:false}],[],
      [{k:'operate',id:'stop',pressed:true}],[],[],[],
      [{k:'operate',id:'stop',pressed:false}],
      [{k:'operate',id:'reversebutton',pressed:true}],[],[],[],[],
      [{k:'operate',id:'estop',pressed:true}],[],[],[],
    ];
    const replay=()=>{
      let w=build();const frames=[];
      for(const c of commands){const out=tick(w,c);w=out.world;frames.push({
        tick:w.tick,direction:w.motorDirection,
        forward:w.forwardContactorOn,reverse:w.reverseContactorOn,
        angle:w.reverseMotorAngleRad,events:out.events.map(e=>e.detail),
      });}return frames;
    };
    expect(replay()).toEqual(replay());
  });
});
