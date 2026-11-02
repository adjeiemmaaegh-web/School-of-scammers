import {describe,it,expect} from 'vitest';
import {initialProcess,advanceProcess,setProcessFault} from '../src/engineering/conveyor-process';
describe('deterministic conveyor process',()=>{
 it('replays identical scan inputs exactly',()=>{const run=()=>{let s=initialProcess();s=advanceProcess(s,{motor:false,diverter:false,spawn:true},20);for(let i=0;i<400;i++)s=advanceProcess(s,{motor:true,diverter:false},20);return s};expect(run()).toEqual(run());expect(run().completed).toBe(1)});
 it('holds product when motor is stopped',()=>{let s=advanceProcess(initialProcess(),{motor:false,diverter:false,spawn:true},20);s=advanceProcess(s,{motor:false,diverter:false},1000);expect(s.products[0].xMm).toBe(0)});
 it('detects a product at photoeye',()=>{let s=advanceProcess(initialProcess(),{motor:false,diverter:false,spawn:true},20);for(let i=0;i<100;i++)s=advanceProcess(s,{motor:true,diverter:false},20);expect(s.photoeye).toBe(true)});
 it('rejects a fault injection while powered',()=>{const s=setProcessFault(initialProcess(),'beltSlipping',true,false);expect(s.faults.beltSlipping).toBe(false)});
 it('models slipping belt feedback',()=>{let s=setProcessFault(initialProcess(),'beltSlipping',true,true);s=advanceProcess(s,{motor:true,diverter:false,spawn:true},20);expect(s.motorFeedback).toBe(false);expect(s.products[0].xMm).toBe(0)});
 it('sorts a marked product when diverter is commanded',()=>{let s=advanceProcess(initialProcess(),{motor:false,diverter:false,spawn:true,rejectNext:true},20);for(let i=0;i<400;i++)s=advanceProcess(s,{motor:true,diverter:true},20);expect(s.rejected).toBe(1)});
});
