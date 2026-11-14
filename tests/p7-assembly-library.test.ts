import {describe,expect,it} from 'vitest';
import type {WorkspaceFragment} from '../src/workspace/types';
import {
 ASSEMBLY_STORAGE_KEY,MAX_SAVED_ASSEMBLIES,MAX_ASSEMBLY_BYTES,
 readAssemblyLibrary,encodeAssemblyLibrary,saveAssembly,deleteAssembly,
} from '../src/workspace/assembly-library';

const fragment=():WorkspaceFragment=>({
 version:1,
 components:[
  {id:'supply-1',kind:'supply',x:0,y:0,pressed:false},
  {id:'lamp-1',kind:'lamp',x:250,y:0,pressed:false},
 ],
 wires:[{id:'w1',from:'supply-1.P24',to:'lamp-1.L+'}],
 params:{'lamp-1':{}},
});
describe('P7 offline workcell station assemblies',()=>{
 it('stores the selected machines, internal wires and params with round-trip precision',()=>{
  const source=fragment(),before=JSON.stringify(source);
  const items=saveAssembly([],'  Sensor   checkpoint  ',source);
  expect(items[0].name).toBe('Sensor checkpoint');
  expect(items[0].fragment.wires).toEqual(source.wires);
  expect(readAssemblyLibrary(encodeAssemblyLibrary(items))).toEqual(items);
  expect(JSON.stringify(source)).toBe(before);
  expect(ASSEMBLY_STORAGE_KEY).toMatch(/assemblies-v1/);
 });
 it('copies fragments rather than aliasing mutable project data',()=>{
  const source=fragment(),items=saveAssembly([],'Station',source);
  source.components[0].x=500;
  expect(items[0].fragment.components[0].x).toBe(0);
 });
 it('guards duplicate names, blank names and the finite 12 station cap',()=>{
  const first=saveAssembly([],'Line A',fragment());
  expect(()=>saveAssembly(first,'  line  a  ',fragment())).toThrow(/already/);
  expect(()=>saveAssembly(first,' ',fragment())).toThrow(/name/);
  expect(()=>saveAssembly(first,'X'.repeat(49),fragment())).toThrow(/name/);
  let many=first;
  for(let i=2;i<=MAX_SAVED_ASSEMBLIES;i++)
   many=saveAssembly(many,'Line '+i,fragment());
  expect(()=>saveAssembly(many,'Extra',fragment())).toThrow(/At most 12/);
 });
 it('rejects tampered JSON, oversized payloads and duplicate records',()=>{
  expect(()=>readAssemblyLibrary('{invalid')).toThrow(/damaged/);
  expect(()=>readAssemblyLibrary(JSON.stringify([{id:1,name:'X',fragment:{version:99}}])))
   .toThrow(/Invalid/);
  const x=saveAssembly([],'X',fragment());
  expect(()=>readAssemblyLibrary(JSON.stringify([...x,...x]))).toThrow(/Invalid/);
  expect(()=>readAssemblyLibrary('x'.repeat(500000))).toThrow(/limit/);
  const giant=fragment();
  giant.components[0].id='x'.repeat(MAX_ASSEMBLY_BYTES);
  giant.wires[0].from=giant.components[0].id+'.P24';
  expect(()=>saveAssembly([],'Overflow',giant)).toThrow(/large/);
 });
 it('cannot save empty/untrusted fragments or wires referring to absent devices',()=>{
  const empty:WorkspaceFragment={version:1,components:[],wires:[]};
  expect(()=>saveAssembly([],'Empty',empty)).toThrow(/valid devices/);
  const stray=fragment();stray.wires[0].to='other.OUT';
  expect(()=>saveAssembly([],'Stray',stray)).toThrow(/valid devices/);
 });
 it('deleting an assembly does not mutate the previously saved set',()=>{
  const first=saveAssembly([],'One',fragment());
  const second=saveAssembly(first,'Two',fragment());
  const removed=deleteAssembly(second,first[0].id);
  expect(removed).toHaveLength(1);
  expect(removed[0].name).toBe('Two');
  expect(second).toHaveLength(2);
 });
});
