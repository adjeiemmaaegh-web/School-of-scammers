import {describe,expect,it} from 'vitest';
import {createWorld,renderSnapshot,tick,validateProject} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';

/**
 * Integrated user-authored workcell. Every object starts as a place command on
 * a blank project, every PLC I/O link is a real terminal-level wire, and the
 * five 10ms equipment substeps belong to the authoritative 50ms worker tick.
 *
 * Orientation/orthogonal turntable transfer is NOT claimed: this source branch
 * locks P3 equipment yaw pending P1/P3 physical rotation reconciliation.
 */
const parts:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:20,y:10}},
 {k:'place',id:'plc16',kind:'plc16',at:{x:245,y:10}},
 {k:'place',id:'feeder',kind:'box-feeder',at:{x:433,y:225}},
 {k:'place',id:'roller1',kind:'roller-conveyor',at:{x:455,y:225}},
 {k:'place',id:'roller2',kind:'roller-conveyor',at:{x:515,y:225}},
 {k:'place',id:'turn',kind:'turntable',at:{x:570,y:225}},
 {k:'place',id:'roller3',kind:'roller-conveyor',at:{x:625,y:225}},
 {k:'place',id:'eye1',kind:'geometry-photoeye',at:{x:470,y:225}},
 {k:'place',id:'eye2',kind:'geometry-photoeye',at:{x:550,y:225}},
];
const connected:[string,string,string][]=[
 ['p1','supply.P24','plc16.L+'],['p2','supply.M0','plc16.M'],
 ['start','supply.P24','plc16.I0.0'],
 ['q0','plc16.Q0.0','roller1.CMD_run+'],
 ['q1','plc16.Q0.1','roller2.CMD_run+'],
 ['q2','plc16.Q0.2','roller3.CMD_run+'],
 ['q3','plc16.Q0.3','turn.CMD_turn+'],
 ['q4','plc16.Q0.4','feeder.CMD_enable+'],
 ['r0','supply.M0','roller1.M-'],['r1','supply.M0','roller2.M-'],
 ['r2','supply.M0','roller3.M-'],['r3','supply.M0','turn.M-'],
 ['r4','supply.M0','feeder.M-'],
 ['eye1l','supply.P24','eye1.L+'],['eye1m','supply.M0','eye1.M'],
 ['eye2l','supply.P24','eye2.L+'],['eye2m','supply.M0','eye2.M'],
 ['s1','eye1.OUT_present','plc16.I0.1'],
 ['s2','eye2.OUT_present','plc16.I0.2'],
];
const wires:Command[]=connected.map(([id,from,to])=>({k:'wire',id,from,to}));
const program=(roller2=true,turn='In1 OR In2')=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;',
 ' Out3 : BOOL;',' Out4 : BOOL;','END_VAR',
 'Out0 := In0;',`Out1 := ${roller2?'In0':'FALSE'};`,'Out2 := In0;',
 `Out3 := ${turn};`,'Out4 := In0;',
].join('\n');
function author(source=program()):WorldState{
 const w=tick(createWorld(),[...parts,...wires,{k:'loadST',source}]).world;
 expect(w.lastError).toBeNull();
 expect(w.project.components).toHaveLength(parts.length);
 expect(w.project.wires).toHaveLength(wires.length);
 return w;
}
const scan=(w:WorldState,n:number)=>{for(let i=0;i<n;i++)w=tick(w).world;return w;};

describe('Integrating three real PLC-driven rollers, two eyes and a turntable',()=>{
 it('builds a blank project with editable ST, real terminals, worker motion and save/reload',()=>{
  const authored=author();
  expect(validateProject(JSON.parse(JSON.stringify(authored.project)))).toEqual(authored.project);
  let w=scan(tick(authored,[{k:'run'}]).world,32);
  expect(w.lastError).toBeNull();
  for(const id of ['roller1','roller2','roller3']){
   expect(w.plantWorld.signals[id].moving).toBe(true);
  }
  expect(w.plantWorld.world.spawnedCount).toBeGreaterThan(0);
  expect(w.plantWorld.world.timeMs).toBeGreaterThan(1000);
  expect(w.plantWorld.world.spawnedCount-w.plantWorld.world.despawnedCount)
   .toBe(w.plantWorld.world.bodies.length);
  expect(renderSnapshot(w).plantWorld.world.bodies).toHaveLength(w.plantWorld.world.bodies.length);
  const saved=JSON.parse(JSON.stringify(w.project));
  expect(validateProject(saved)).toEqual(w.project);
 });
 it('wrong PLC logic or a disconnected Q actually stops one roller without fake animation',()=>{
  let w=scan(tick(author(program(false)),[{k:'run'}]).world,20);
  expect(w.plantWorld.signals.roller1.moving).toBe(true);
  expect(w.plantWorld.signals.roller2.moving).toBe(false);
  expect(w.plantWorld.signals.roller3.moving).toBe(true);
  const unlinked=tick(author(),[{k:'unwire',id:'q1'}]).world;
  expect(unlinked.lastError).toBeNull();
  w=scan(tick(unlinked,[{k:'run'}]).world,20);
  expect(w.plantWorld.signals.roller1.moving).toBe(true);
  expect(w.plantWorld.signals.roller2.moving).toBe(false);
 });
 it('a wired PLC command drives turntable rotation over actual simulated time',()=>{
  const first=author(program(true,'In0'));
  const run=()=>scan(tick(first,[{k:'run'}]).world,45);
  const a=run(),b=run();
  expect(a.lastError).toBeNull();
  expect(a.plantWorld.signals.turn.rotated).toBe(true);
  expect(a.plantWorld.signals.turn.busy).toBe(false);
  expect(JSON.stringify(a.plantWorld)).toBe(JSON.stringify(b.plantWorld));
 });
});
