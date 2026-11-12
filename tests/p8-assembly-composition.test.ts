import {describe,it,expect} from 'vitest';
import {createWorld,tick,validateProject} from '../src/sim/orchestrator';
import {makeFragment} from '../src/workspace/clipboard';
import {composeAssemblyFragments} from '../src/workspace/assembly-composition';
import {encodeAssemblyLibrary,readAssemblyLibrary,saveAssembly} from '../src/workspace/assembly-library';
import type {WorkspaceFragment} from '../src/workspace/types';
import type {Command} from '../src/sim/signals';

const a=()=>{
 const commands:Command[]=[
  {k:'place',id:'power',kind:'supply',at:{x:40,y:40}},
  {k:'place',id:'logic',kind:'plc16',at:{x:260,y:40}},
  {k:'wire',id:'voltage',from:'power.P24',to:'logic.L+'},
 ];
 const world=tick(createWorld(),commands).world;
 expect(world.lastError).toBeNull();
 return makeFragment(world.project,['power','logic']);
};
const b=()=>{
 const commands:Command[]=[
  {k:'place',id:'power',kind:'supply',at:{x:60,y:50}},
  {k:'place',id:'lamp',kind:'lamp',at:{x:250,y:50}},
  {k:'wire',id:'voltage',from:'power.P24',to:'lamp.L+'},
 ];
 const world=tick(createWorld(),commands).world;
 expect(world.lastError).toBeNull();
 return makeFragment(world.project,['power','lamp']);
};
describe('P8 offline composed / nested workcell fragments through real worker',()=>{
 it('remaps duplicate source IDs and all internal electrical wires deterministically',()=>{
  const sources=[a(),b()];
  const original=JSON.stringify(sources);
  const joined=composeAssemblyFragments(sources);
  expect(joined.components).toHaveLength(4);
  expect(joined.wires).toHaveLength(2);
  expect(new Set(joined.components.map(c=>c.id)).size).toBe(4);
  const actual=new Set(joined.components.map(c=>c.id));
  for(const wire of joined.wires){
   expect(actual.has(wire.from.split('.')[0])).toBe(true);
   expect(actual.has(wire.to.split('.')[0])).toBe(true);
  }
  expect(JSON.stringify(sources)).toBe(original);
 });
 it('preserves worker PLC program settings and creates a valid pasted project',()=>{
  const joined=composeAssemblyFragments([a(),b()]);
  expect(Object.keys(joined.plcPrograms??{})).toHaveLength(1);
  const world=tick(createWorld(),[{k:'editWorkspace',edit:{
   kind:'paste',fragment:joined,at:{x:120,y:100},grid:5,
  }}]).world;
  expect(world.lastError).toBeNull();
  expect(world.project.components).toHaveLength(4);
  expect(world.project.wires).toHaveLength(2);
  expect(validateProject(world.project)).toEqual(world.project);
 });
 it('supports nested composition snapshots with no external reference required',()=>{
  const joined=composeAssemblyFragments([a(),b()]);
  const nested=composeAssemblyFragments([joined,b()],100);
  expect(nested.components).toHaveLength(6);
  expect(nested.wires).toHaveLength(3);
  const source=JSON.stringify(joined);
  const library=saveAssembly(saveAssembly([],'Basic',joined),'Nested',nested);
  const decoded=readAssemblyLibrary(encodeAssemblyLibrary(library));
  expect(decoded[1].fragment.components).toHaveLength(6);
  expect(JSON.stringify(joined)).toBe(source);
 });
 it('rejects cross-cell external wires instead of connecting to accidental names',()=>{
  const fragment=a();
  const bad:WorkspaceFragment={...fragment,wires:[
   ...fragment.wires,{id:'bad',from:'power.P24',to:'outside.L+'},
  ]};
  expect(()=>composeAssemblyFragments([bad,b()])).toThrow(/exits its source/);
 });
 it('fails safely when four large cells cannot fit the existing factory floor',()=>{
  expect(()=>composeAssemblyFragments([a(),a(),a(),a()]))
   .toThrow(/exceeds this classroom floor/);
  expect(()=>composeAssemblyFragments([a()])).toThrow(/between two and four/);
  expect(()=>composeAssemblyFragments([a(),b()],0)).toThrow(/spacing/);
 });
});
