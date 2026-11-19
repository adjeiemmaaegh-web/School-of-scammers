import {describe,expect,it} from 'vitest';
import {createWorld,tick,renderSnapshot} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';
/** Independently verifies the beginner guide's exact P24 → START → lamp → M0 circuit with the real worker model. */
const parts:Command[]=[
 {k:'place',kind:'supply',id:'ps',at:{x:25,y:25}},
 {k:'place',kind:'start',id:'start',at:{x:270,y:25}},
 {k:'place',kind:'lamp',id:'lamp',at:{x:600,y:25}},
];
const wires:[string,string][]=[
 ['ps.P24','start.A'],
 ['start.B','lamp.L+'],
 ['lamp.M-','ps.M0']
];
const fixture=(remove:number[]=[]):WorldState=>tick(createWorld(),[
 ...parts,
 ...wires.flatMap(([from,to],index):Command[]=>remove.includes(index)?[]:[{k:'wire',id:'guide-w'+index,from,to}])
]).world;
function scans(world:WorldState,n=3){
 let w=world;for(let i=0;i<n;i++)w=tick(w).world;return w;
}
describe('Steady Guide first-lamp instructions use the authoritative simulator',()=>{
 it('a fully wired pushbutton lamp starts dark, lights only when START is pressed, and goes dark when released',()=>{
  const initial=fixture();
  expect(initial.project.components.map(c=>c.kind)).toEqual(['supply','start','lamp']);
  expect(initial.project.wires).toHaveLength(3);
  let w=scans(tick(initial,[{k:'run'}]).world,3);
  expect(w.lampOn).toBe(false);
  w=scans(tick(w,[{k:'operate',id:'start',pressed:true}]).world,3);
  expect(w.lampOn).toBe(true);
  expect(renderSnapshot(w).lampOn).toBe(true);
  w=scans(tick(w,[{k:'operate',id:'start',pressed:false}]).world,3);
  expect(w.lampOn).toBe(false);
 });
 it('missing any one of the three instructions must not light the lamp',()=>{
  for(let i=0;i<wires.length;i++){
   let w=scans(tick(fixture([i]),[{k:'operate',id:'start',pressed:true},{k:'run'}]).world,4);
   expect(w.lampOn).toBe(false);
  }
 });
});
