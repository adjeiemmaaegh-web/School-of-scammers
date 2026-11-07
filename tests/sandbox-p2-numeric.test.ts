import { describe, expect, it } from 'vitest';
import { createWorld, tick, validateProject, validateSandboxProgram } from '../src/sim/orchestrator';
import { executeLadder, type LadderDocument } from '../src/engineering/ladder';
import type { Command, WorldState } from '../src/sim/signals';

const devices: Command[] = [
  { k:'place', id:'ps',kind:'supply',at:{x:10,y:10} },
  { k:'place', id:'plc',kind:'plc',at:{x:260,y:10} },
  { k:'place', id:'start',kind:'start',at:{x:10,y:230} },
  { k:'place', id:'stop',kind:'stop',at:{x:260,y:230} },
  { k:'place', id:'con',kind:'contactor',at:{x:540,y:10} },
  { k:'place', id:'motor',kind:'motor',at:{x:800,y:10} },
];
const endpoints = [
  ['ps.P24','plc.L+'],['ps.M0','plc.M'],['ps.P24','start.A'],['start.B','plc.I0.0'],
  ['ps.P24','stop.A'],['stop.B','plc.I0.1'],['plc.Q0.0','con.A1'],['ps.M0','con.A2'],
  ['ps.P24','con.13'],['con.14','motor.L+'],['ps.M0','motor.M-'],
] as const;
const wired = () => tick(createWorld(), [...devices,...endpoints.map(([from,to],index): Command =>
  ({k:'wire',id:`w${index}`,from,to}))]).world;
const repeat = (world: WorldState, scans: number) => {
  let state=world;
  for(let i=0;i<scans;i++) state=tick(state).world;
  return state;
};
const C = (name:string) => ({type:'contact' as const,tag:name});
const literal = (value:number) => ({kind:'literal' as const,value});
const tag = (name:string) => ({kind:'tag' as const,name});
const counter: LadderDocument = {
  id:'numeric-demo',version:'1',
  symbols:{
    Count:{description:'Total qualified scans',type:'INT',initial:0},
    Active:{description:'Scan conditions'},
  },
  rungs:[
    {id:'increment',elements:[C('Start')],coil:'Active',operation:{
      kind:'add',target:'Count',left:tag('Count'),right:literal(1)}},
    {id:'threshold',elements:[C('StopOK')],coil:'Run',operation:{
      kind:'compare',left:tag('Count'),comparator:'ge',right:literal(3)}},
  ],
};

describe('P2 bounded numeric Ladder and physical circuit integration', () => {
  it('increments an INT register through a real wired input and compares it to drive the motor', () => {
    expect(validateSandboxProgram(counter)).toEqual([]);
    let w=tick(wired(),[{k:'loadProgram',program:counter},
      {k:'operate',id:'start',pressed:true},{k:'run'}]).world;
    expect(w.tagValues.Count).toBe(1);
    expect(w.coils.Run).toBe(false);
    w=repeat(w,1);
    expect(w.tagValues.Count).toBe(2);
    expect(w.motorOn).toBe(false);
    w=repeat(w,1);
    expect(w.tagValues.Count).toBe(3);
    expect(w.coils.Run).toBe(true);
    w=repeat(w,4);
    expect(w.motorOn).toBe(true);
    expect(w.ladderNumeric.Count).toBe(7);
    w=tick(w,[{k:'operate',id:'stop',pressed:true}]).world;
    w=repeat(w,4);
    expect(w.coils.Run).toBe(false);
    expect(w.motorOn).toBe(false);
  });
  it('runs MOV, DIV and numeric comparator in rung order with typed REAL output', () => {
    const program: LadderDocument={id:'arithmetic',version:'1',symbols:{
      Source:{description:'DINT source',type:'DINT',initial:0},
      Result:{description:'REAL quotient',type:'REAL',initial:0},
    },rungs:[
      {id:'mov',elements:[C('StopOK')],coil:'Unused',operation:{
        kind:'move',target:'Source',left:literal(9)}},
      {id:'div',elements:[C('StopOK')],coil:'Unused2',operation:{
        kind:'div',target:'Result',left:tag('Source'),right:literal(3)}},
      {id:'cmp',elements:[C('StopOK')],coil:'Run',operation:{
        kind:'compare',left:tag('Result'),comparator:'eq',right:literal(3)}},
    ]};
    // Rungs need distinct output coils; declare the dummy Boolean network output.
    program.symbols={...program.symbols,Unused2:{description:'Helper BOOL'}};
    expect(validateSandboxProgram(program)).toEqual([]);
    let w=tick(wired(),[{k:'loadProgram',program},{k:'run'}]).world;
    expect(w.tagValues.Source).toBe(9);
    expect(w.tagValues.Result).toBe(3);
    expect(w.coils.Run).toBe(true);
    w=repeat(w,4);
    expect(w.motorOn).toBe(true);
    expect(w.ladderSteps[1].numericResult).toBe(3);
  });
  it('rejects arithmetic with undeclared sources, numeric contacts and numeric coils', () => {
    const badOperand: LadderDocument={...counter,rungs:[{...counter.rungs[0],
      operation:{kind:'add',target:'Count',left:tag('Unknown'),right:literal(1)}},counter.rungs[1]]};
    expect(validateSandboxProgram(badOperand).join(' ')).toMatch(/must be a declared numeric/);
    const badContact: LadderDocument={...counter,rungs:[{...counter.rungs[0],elements:[C('Count')]},counter.rungs[1]]};
    expect(validateSandboxProgram(badContact).join(' ')).toMatch(/requires comparison/);
    const badCoil: LadderDocument={...counter,rungs:[{...counter.rungs[0],coil:'Count'},counter.rungs[1]]};
    expect(validateSandboxProgram(badCoil).join(' ')).toMatch(/numeric tag cannot be a BOOL output coil/);
    const w=wired();
    expect(tick(w,[{k:'loadProgram',program:badContact}]).world.project).toEqual(w.project);
  });
  it('fails on INT overflow and division by zero; neither produces fake numeric results', () => {
    const overflow: LadderDocument={...counter,symbols:{
      ...counter.symbols,Count:{description:'small register',type:'INT',initial:32767},
    }};
    expect(validateSandboxProgram(overflow)).toEqual([]);
    const state=tick(wired(),[{k:'loadProgram',program:overflow},
      {k:'operate',id:'start',pressed:true},{k:'run'}]).world;
    expect(state.running).toBe(false);
    expect(state.lastError).toMatch(/INT/);
    const divide: LadderDocument={id:'division',version:'1',
      symbols:{A:{description:'numeric',type:'REAL',initial:0}},
      rungs:[{id:'div',elements:[C('Start')],coil:'Run',operation:{
        kind:'div',target:'A',left:literal(1),right:literal(0)}}]};
    expect(validateSandboxProgram(divide)).toEqual([]);
    const divideState=tick(wired(),[{k:'loadProgram',program:divide},
      {k:'operate',id:'start',pressed:true},{k:'run'}]).world;
    expect(divideState.running).toBe(false);
    expect(divideState.lastError).toMatch(/division by zero/);
  });
  it('restores typed initial numeric values after reset and keeps old project JSON readable', () => {
    let w=tick(wired(),[{k:'loadProgram',program:counter},
      {k:'operate',id:'start',pressed:true},{k:'run'}]).world;
    w=repeat(w,4);
    expect(w.ladderNumeric.Count).toBe(5);
    w=tick(w,[{k:'pause'},{k:'reset'}]).world;
    expect(w.tick).toBe(0);
    expect(w.ladderNumeric).toEqual({});
    // The pressed START contact is intentionally preserved by Reset; release it before checking initialization.
    w=tick(w,[{k:'operate',id:'start',pressed:false},{k:'step'}]).world;
    expect(w.tagValues.Count).toBe(0);
    expect(validateProject({...w.project,language:undefined,stSource:undefined}).program.symbols?.Count.type).toBe('INT');
    const plain=executeLadder({id:'old',version:'1',rungs:[{id:'one',elements:[C('Start')],coil:'Run'}]},
      {Start:true});
    expect(plain.outputs.Run).toBe(true);
  });
});
