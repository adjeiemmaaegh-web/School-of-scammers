import {describe,it,expect} from 'vitest';
import {newBoard,changeBoard,evaluateBoard,type Board} from '../src/engineering/wiring-board';
import {initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
const wire=(b:Board,a:string,c:string)=>changeBoard(b,{kind:'connect',from:a,to:c},false);
describe('multiple PLC terminals and output-driven circuits',()=>{
 it('samples two independently wired PLC inputs',()=>{
  let b=newBoard();
  b=changeBoard(b,{kind:'add',part:{id:'I1',kind:'plc-input',label:'PLC I0.3',x:100,y:300}},false);
  for(const [a,c] of [['PS.P','I0.IN'],['PS.M','I0.COM'],['PS.P','I1.IN'],['PS.M','I1.COM']]) b=wire(b,a,c);
  const reading=evaluateBoard(b,true);
  expect(reading.plcInputs['I0.2']).toBe(true);expect(reading.plcInputs['I0.3']).toBe(true);
  const state=stepWorkcell(initialWorkcell(),'tick',20,undefined,b);
  expect(state.plcInputs['I0.3']).toBe(true);
 });
 it('PLC Q output controls a load circuit',()=>{
  let b=newBoard();b=changeBoard(b,{kind:'add',part:{id:'Q0',kind:'plc-output',label:'PLC Q0.0',x:300,y:300}},false);
  for(const [a,c] of [['PS.P','Q0.A'],['Q0.B','L1.A'],['L1.B','PS.M']]) b=wire(b,a,c);
  expect(evaluateBoard(b,true,{'Q0.0':false}).result.energizedLoads).not.toContain('L1');
  expect(evaluateBoard(b,true,{'Q0.0':true}).result.energizedLoads).toContain('L1');
 });
 it('relay contacts follow PLC output tags',()=>{
  let b=newBoard();b=changeBoard(b,{kind:'add',part:{id:'K2',kind:'relay-contact',label:'K2 NO',controlledBy:'RunLatch',x:300,y:300}},false);
  for(const [a,c] of [['PS.P','K2.A'],['K2.B','L1.A'],['L1.B','PS.M']]) b=wire(b,a,c);
  expect(evaluateBoard(b,true,{RunLatch:false}).result.energizedLoads).not.toContain('L1');
  expect(evaluateBoard(b,true,{RunLatch:true}).result.energizedLoads).toContain('L1');
 });
});
