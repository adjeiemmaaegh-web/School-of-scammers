import {describe,it,expect} from 'vitest';
import {createWorld,tick,validateProject} from '../src/sim/orchestrator';
import type {Command} from '../src/sim/signals';
import {makeFragment} from '../src/workspace/clipboard';
import {rotateAssemblyFragment} from '../src/workspace/assembly-transform';

const placed:Command[]=[
 {k:'place',id:'source',kind:'supply',at:{x:40,y:40}},
 {k:'place',id:'light',kind:'lamp',at:{x:250,y:40}},
 {k:'wire',id:'power',from:'source.P24',to:'light.L+'},
];
const source=()=>tick(createWorld(),placed).world;
describe('P8 worker-safe reusable 3D cell orientation',()=>{
 it('rotates all instances and keeps original wire, settings and stored assembly unchanged',()=>{
  const w=source();
  expect(w.lastError).toBeNull();
  const fragment=makeFragment(w.project,['source','light']);
  const before=JSON.stringify(fragment);
  const turned=rotateAssemblyFragment(fragment,1);
  expect(turned.components.map(c=>c.yawDeg)).toEqual([90,90]);
  const byId=Object.fromEntries(turned.components.map(c=>[c.id,c]));
  expect(byId.light.x).toBe(byId.source.x);
  expect(byId.light.y-byId.source.y).toBe(210);
  expect(turned.wires).toEqual(fragment.wires);
  expect(JSON.stringify(fragment)).toBe(before);
 });
 it('supports 180/270 and keeps relative positions through four turns',()=>{
  const original=makeFragment(source().project,['source','light']);
  const twice=rotateAssemblyFragment(original,2);
  const thrice=rotateAssemblyFragment(original,3);
  expect(twice.components.every(c=>c.yawDeg===180)).toBe(true);
  expect(thrice.components.every(c=>c.yawDeg===270)).toBe(true);
  expect(twice.components[0].y).toBe(twice.components[1].y);
  expect(thrice.components[0].x).toBe(thrice.components[1].x);
 });
 it('accepts rotated assemblies only via the authoritative worker paste gate',()=>{
  let w=source();
  const fragment=rotateAssemblyFragment(makeFragment(w.project,['source','light']),1);
  w=tick(w,[{k:'editWorkspace',edit:{
   kind:'paste',fragment,at:{x:500,y:190},grid:5,
  }}]).world;
  expect(w.lastError).toBeNull();
  expect(w.project.components).toHaveLength(4);
  expect(w.project.wires).toHaveLength(2);
  expect(new Set(w.project.components.map(c=>c.id)).size).toBe(4);
  expect(w.project.components.slice(-2).every(c=>c.yawDeg===90)).toBe(true);
  expect(validateProject(w.project)).toEqual(w.project);
 });
 it('rejects rotate when a saved cell contains orientation-locked machinery',()=>{
  const w=tick(createWorld(),[{k:'place',id:'feeder',kind:'box-feeder',
   at:{x:300,y:200}}]).world;
  expect(w.lastError).toBeNull();
  const f=makeFragment(w.project,['feeder']);
  expect(()=>rotateAssemblyFragment(f,1)).toThrow(/orientation-locked/);
  expect(rotateAssemblyFragment(f,0)).toBe(f);
 });
 it('rejects malformed turns and invalid fragment without altering saved data',()=>{
  const f=makeFragment(source().project,['source','light']);
  const snapshot=JSON.stringify(f);
  expect(()=>rotateAssemblyFragment(f,4 as 0)).toThrow(/quarter/);
  expect(()=>rotateAssemblyFragment({...f,components:[]},1)).toThrow(/Invalid/);
  expect(JSON.stringify(f)).toBe(snapshot);
 });
});
