import {describe,it,expect} from 'vitest';
import {newBoard,changeBoard,evaluateBoard} from '../src/engineering/wiring-board';
describe('wiring board',()=>{
 it('requires isolation before wiring',()=>expect(()=>changeBoard(newBoard(),{kind:'connect',from:'PS.P',to:'F1.A'},true)).toThrow(/Isolate/));
 it('rejects nonexistent terminals and duplicate wires',()=>{const b=changeBoard(newBoard(),{kind:'connect',from:'PS.P',to:'F1.A'},false);expect(()=>changeBoard(b,{kind:'connect',from:'PS.P',to:'F1.A'},false)).toThrow(/Duplicate/);expect(()=>changeBoard(b,{kind:'connect',from:'PS.P',to:'X.A'},false)).toThrow(/Invalid/);});
 it('energizes a lamp only through a complete circuit',()=>{let b=newBoard();for(const [from,to] of [['PS.P','F1.A'],['F1.B','S1.A'],['S1.B','L1.A'],['L1.B','PS.M']])b=changeBoard(b,{kind:'connect',from,to},false);expect(evaluateBoard(b,true).result.energizedLoads).toContain('L1');b=changeBoard(b,{kind:'toggle',id:'S1'},false);expect(evaluateBoard(b,true).result.energizedLoads).not.toContain('L1');});
 it('detects a direct supply short',()=>{const b=changeBoard(newBoard(),{kind:'connect',from:'PS.P',to:'PS.M'},false);expect(evaluateBoard(b,true).result.diagnostics.join(' ')).toMatch(/short circuit/i);});
 it('reports isolated supply as de-energized',()=>expect(evaluateBoard(newBoard(),false).result.energizedLoads).toEqual([]));
});
