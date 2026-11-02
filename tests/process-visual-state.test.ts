import {describe,it,expect} from 'vitest';
import {initialProcess,advanceProcess} from '../src/engineering/conveyor-process';
import {processVisualState} from '../src/components/ProcessConveyor3D';
describe('3D process rendering adapter',()=>{
 it('maps physical position in millimetres to scene metres',()=>{
  let p=advanceProcess(initialProcess(),{motor:false,diverter:false,spawn:true},20);
  p=advanceProcess(p,{motor:true,diverter:false},1000);
  expect(processVisualState(p).packages[0].position[0]).toBe(-1.5);
 });
 it('does not mutate process state',()=>{
  const p=advanceProcess(initialProcess(),{motor:false,diverter:false,spawn:true,rejectNext:true},20);
  const before=JSON.stringify(p);expect(processVisualState(p).packages[0].rejected).toBe(true);
  expect(JSON.stringify(p)).toBe(before);
 });
 it('shows sensor and motor states from the same snapshot',()=>{
  const p=advanceProcess(initialProcess(),{motor:true,diverter:true},20);
  expect(processVisualState(p).beltRunning).toBe(true);
  expect(processVisualState(p).diverterActive).toBe(true);
 });
});
