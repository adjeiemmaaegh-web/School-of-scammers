import { describe, expect, it } from 'vitest';
import { conveyorStarter, executeLadder, validateLadder } from '../src/engineering/ladder';
import { solveDiscrete24V } from '../src/engineering/electrical';
describe('ladder logic', () => {
  it('starts with all interlocks closed', () => expect(executeLadder(conveyorStarter, { EStopOK: true, GuardClosed: true, Start: true, Stop: false }).outputs.RunLatch).toBe(true));
  it('holds run via previous latch', () => expect(executeLadder(conveyorStarter, { EStopOK: true, GuardClosed: true, Start: false, Stop: false }, {RunLatch: true}).outputs.RunLatch).toBe(true));
  it('stop overrides latch', () => expect(executeLadder(conveyorStarter, { EStopOK: true, GuardClosed: true, Start: false, Stop: true }, {RunLatch: true}).outputs.RunLatch).toBe(false));
  it('open guard overrides latch', () => expect(executeLadder(conveyorStarter, { EStopOK: true, GuardClosed: false, Start: true, Stop: false }, {RunLatch: true}).outputs.RunLatch).toBe(false));
  it('rejects duplicate rung ids', () => expect(validateLadder({...conveyorStarter, rungs: [conveyorStarter.rungs[0], conveyorStarter.rungs[0]]}).length).toBeGreaterThan(0));
});
describe('24V DC circuit', () => {
  const supply = {id:'psu',kind:'supply' as const,positive:'p',negative:'n',volts:24 as const};
  const load = {id:'lamp',kind:'load' as const,positive:'lamp+',negative:'lamp-',nominalVolts:24};
  it('energizes a correctly wired load', () => expect(solveDiscrete24V({devices:[supply,load],wires:[['p','lamp+'],['n','lamp-']]}).energizedLoads).toEqual(['lamp']));
  it('does not energize an open circuit', () => expect(solveDiscrete24V({devices:[supply,load],wires:[['p','lamp+']]}).energizedLoads).toEqual([]));
  it('reports a supply short', () => expect(solveDiscrete24V({devices:[supply],wires:[['p','n']]}).diagnostics[0]).toMatch(/short/));
});
