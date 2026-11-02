import { describe, expect, it } from 'vitest';
import { executeLadder, validateLadder, type LadderDocument } from '../src/engineering/ladder';

const program: LadderDocument = { id: 'editable-branches', version: '1', rungs: [{
  id: 'motor', coil: 'RunLatch', elements: [{ type: 'branch', alternatives: [
    [{ type: 'contact', tag: 'Start' }, { type: 'contact', tag: 'GuardClosed' }],
    [{ type: 'contact', tag: 'Aux1', normallyClosed: true }],
    [{ type: 'contact', tag: 'Aux2' }]
  ] }]
}] };
describe('editable parallel path semantics', () => {
  it('accepts three independent paths and series contacts', () => expect(validateLadder(program)).toEqual([]));
  it('conducts when any complete path conducts', () => {
    expect(executeLadder(program, { Start:true, GuardClosed:false, Aux1:true, Aux2:false }).outputs.RunLatch).toBe(false);
    expect(executeLadder(program, { Start:true, GuardClosed:true, Aux1:true, Aux2:false }).outputs.RunLatch).toBe(true);
    expect(executeLadder(program, { Start:false, GuardClosed:false, Aux1:false, Aux2:false }).outputs.RunLatch).toBe(true);
    expect(executeLadder(program, { Start:false, GuardClosed:false, Aux1:true, Aux2:true }).outputs.RunLatch).toBe(true);
  });
  it('rejects empty paths', () => {
    const invalid: LadderDocument = { ...program, rungs: [{ ...program.rungs[0], elements:[{ type:'branch', alternatives:[[],[{type:'contact',tag:'Start'}]] }] }] };
    expect(validateLadder(invalid)).not.toEqual([]);
  });
});
