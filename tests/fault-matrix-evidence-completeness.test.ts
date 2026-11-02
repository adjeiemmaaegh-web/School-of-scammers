import {describe,it,expect} from 'vitest';
import {runFaultMatrix} from '../src/engineering/fault-matrix';
import type {LadderDocument} from '../src/engineering/ladder';

describe('fault matrix evidence cap does not truncate affected-output attribution',()=>{
 it('reports late-appearing delayed outputs after detailed evidence is capped',()=>{
  const doc:LadderDocument={id:'cap',version:'1',rungs:[
   {id:'instant',elements:[{type:'contact',tag:'Start'}],coil:'Motor'},
   {id:'delay',elements:[{type:'contact',tag:'Start'}],coil:'Ready',operation:{kind:'ton',presetMs:400}}
  ]};
  const matrix=runFaultMatrix(doc,[{scans:900,inputs:{Start:true}},{scans:200,inputs:{}}],['Start'],6);
  const fault=matrix.cases.find(c=>c.fault.mode==='stuck-off'&&c.fault.durationScans===1100);
  expect(fault?.evidenceTruncated).toBe(true);
  expect(fault?.affectedOutputs).toEqual(['Motor','Ready']);
  expect(matrix.affectedOutputs).toEqual(['Motor','Ready']);
 });
});
