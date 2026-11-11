import { describe, expect, it } from 'vitest';
import { type LadderDocument } from '../src/engineering/ladder';
import { LEGACY_NAMES } from '../src/sim/plc-io';
import { renameLocalTag, updateLocalTag } from '../src/program/tag-table';
import { validateSandboxProgram } from '../src/program/p2-contract';

const doc: LadderDocument = { id:'tag-test',version:'1.0',symbols:{
  Ready:{description:'Internal ready bit',type:'BOOL'},
  Count:{description:'Product count',type:'INT',initial:0,address:'M10'},
},rungs:[
  {id:'a',elements:[{type:'contact',tag:'Ready'}],coil:'Run'},
  {id:'b',elements:[{type:'contact',tag:'Start'}],coil:'Ready'},
  {id:'c',elements:[{type:'contact',tag:'Start'}],coil:'Unused',
    operation:{kind:'add',target:'Count',left:{kind:'tag',name:'Count'},right:{kind:'literal',value:1}}},
]};

describe('P2 tag-table metadata edits and reference-aware renaming',()=>{
 it('renames local BOOL contacts/coils without breaking PLC output wiring',()=>{
  const p=renameLocalTag(doc,'Ready','ReadyState',LEGACY_NAMES);
  expect(validateSandboxProgram(p,LEGACY_NAMES)).toEqual([]);
  expect(p.symbols?.ReadyState).toBeDefined();
  expect(p.symbols?.Ready).toBeUndefined();
  expect((p.rungs[0].elements[0] as {tag:string}).tag).toBe('ReadyState');
  expect(p.rungs[1].coil).toBe('ReadyState');
  expect(p.rungs[0].coil).toBe('Run');
 });
 it('renames numeric operands and destinations without losing their values',()=>{
  const p=renameLocalTag(doc,'Count','Parts',LEGACY_NAMES);
  const op=p.rungs[2].operation;
  expect(op?.kind).toBe('add');
  if(op?.kind==='add'){expect(op.target).toBe('Parts');expect(op.left).toEqual({kind:'tag',name:'Parts'});}
  expect(p.symbols?.Parts?.initial).toBe(0);
 });
 it('blocks physical IO names, duplicates and invalid metadata',()=>{
  expect(()=>renameLocalTag(doc,'Ready','Run',LEGACY_NAMES)).toThrow(/reserved/);
  expect(()=>renameLocalTag(doc,'Ready','Count',LEGACY_NAMES)).toThrow(/duplicate/);
  expect(()=>renameLocalTag(doc,'Ready','__proto__',LEGACY_NAMES)).toThrow(/invalid/);
  expect(()=>updateLocalTag(doc,'Count',{description:'x'.repeat(121)},LEGACY_NAMES)).toThrow(/120/);
  expect(()=>updateLocalTag(doc,'Count',{address:'%Q??'},LEGACY_NAMES)).toThrow();
 });
 it('saves address as metadata without remapping physical I/O addresses',()=>{
  const p=updateLocalTag(doc,'Count',{address:'M12',description:'Inventory count'},LEGACY_NAMES);
  expect(p.symbols?.Count.address).toBe('M12');
  expect(p.symbols?.Count.description).toBe('Inventory count');
  expect(p.rungs).toEqual(doc.rungs);
 });
});
