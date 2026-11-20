import {describe,expect,it} from 'vitest';
import { COMPONENTS } from '../src/components/registry';
import {FIRST_LAMP_PARTS,FIRST_LAMP_WIRES,FIRST_LAMP_LABELS} from '../src/steady-guide/guide-first-lamp';
import {createWorld,tick,renderSnapshot} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';
/** Independently verifies the beginner guide's exact P24 → START → lamp → M0 circuit with the real worker model. */
const ids={supply:'ps',start:'start',lamp:'lamp'} as const;
const parts:Command[]=FIRST_LAMP_PARTS.map((kind,index)=>({
 k:'place',kind,id:ids[kind],at:{x:25+index*245,y:25},
}));
const wires:[string,string][]=FIRST_LAMP_WIRES.map(({from,to})=>[
 ids[from.kind]+'.'+from.terminal,ids[to.kind]+'.'+to.terminal,
]);
const fixture=(remove:number[]=[]):WorldState=>tick(createWorld(),[
 ...parts,
 ...wires.flatMap(([from,to],index):Command[]=>remove.includes(index)?[]:[{k:'wire',id:'guide-w'+index,from,to}])
]).world;
function scans(world:WorldState,n=3){
 let w=world;for(let i=0;i<n;i++)w=tick(w).world;return w;
}
describe('Steady Guide first-lamp instructions use the authoritative simulator',()=>{
 it('every advertised wire references a real registered terminal and one of the three actual parts',()=>{
  expect([...FIRST_LAMP_PARTS]).toEqual(['supply','start','lamp']);
  expect(FIRST_LAMP_WIRES).toHaveLength(3);
  expect(FIRST_LAMP_LABELS.lamp).toMatch(/pilot lamp/i);
  for(const link of FIRST_LAMP_WIRES){
   for(const endpoint of [link.from,link.to]){
    expect(FIRST_LAMP_PARTS).toContain(endpoint.kind);
    expect(COMPONENTS[endpoint.kind].terminals.some(t=>t.name===endpoint.terminal)).toBe(true);
   }
  }
 });
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
