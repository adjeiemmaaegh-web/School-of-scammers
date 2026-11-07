import { describe, expect, it } from 'vitest';
import { solveDiscrete24V, type Device } from '../src/engineering/electrical';

const psu = (id: string, p: string, n: string): Device => ({ id, kind: 'supply', positive: p, negative: n, volts: 24 });
const load = (id: string, p: string, n: string): Device => ({ id, kind: 'load', positive: p, negative: n, nominalVolts: 24 });

describe('several independent supplies (separate panels)', () => {
  it('energises each panel from its own supply', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-'), load('la', 'la+', 'la-'), load('lb', 'lb+', 'lb-')],
      wires: [['A+', 'la+'], ['A-', 'la-'], ['B+', 'lb+'], ['B-', 'lb-']],
    });
    expect(r.energizedLoads.sort()).toEqual(['la', 'lb']);
    expect(r.diagnostics).toEqual([]);
  });
  it('a break in one panel does not affect the other', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-'), load('la', 'la+', 'la-'), load('lb', 'lb+', 'lb-')],
      wires: [['A+', 'la+'], ['B+', 'lb+'], ['B-', 'lb-']], // panel A return missing
    });
    expect(r.energizedLoads).toEqual(['lb']);
  });
  it('a load between one panel\'s positive and another\'s negative is NOT powered: the supplies are isolated', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-'), load('cross', 'x+', 'x-')],
      wires: [['A+', 'x+'], ['B-', 'x-']],
    });
    expect(r.energizedLoads).toEqual([]);
  });
  it('a shared common (M0 tied together) lets a signal from one panel drive a load in the other', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-'), load('cross', 'x+', 'x-')],
      wires: [['A+', 'x+'], ['B-', 'x-'], ['A-', 'B-']],
    });
    expect(r.energizedLoads).toEqual(['cross']);
    expect(r.diagnostics).toEqual([]);
  });
  it('one supply\'s positive net on another\'s negative net is flagged as a short and powers nothing', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-'), load('l', 'l+', 'l-')],
      wires: [['A+', 'B-'], ['A+', 'l+'], ['A-', 'l-']],
    });
    expect(r.diagnostics.some(d => d.startsWith('Supply short'))).toBe(true);
    expect(r.energizedLoads).toEqual([]);
  });
  it('a direct short across any one supply is still a short', () => {
    const r = solveDiscrete24V({ devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-')], wires: [['B+', 'B-']] });
    expect(r.diagnostics.some(d => d.startsWith('Supply short'))).toBe(true);
  });
  it('terminal voltages are per net: 24 on each positive, 0 on each negative', () => {
    const r = solveDiscrete24V({
      devices: [psu('A', 'A+', 'A-'), psu('B', 'B+', 'B-')], wires: [['A+', 'a1'], ['B-', 'b0']],
    });
    expect(r.voltage).toMatchObject({ a1: 24, 'A-': 0, 'B+': 24, b0: 0 });
  });
  it('no supply still reports that one is required and nothing is energised', () => {
    const r = solveDiscrete24V({ devices: [load('l', 'l+', 'l-')], wires: [] });
    expect(r.diagnostics).toEqual(['A 24V supply is required']);
    expect(r.energizedLoads).toEqual([]);
  });
  it('a single supply behaves exactly as before: load, open path and short', () => {
    expect(solveDiscrete24V({ devices: [psu('S', 'p', 'n'), load('l', 'l+', 'l-')], wires: [['p', 'l+'], ['n', 'l-']] }).energizedLoads).toEqual(['l']);
    expect(solveDiscrete24V({ devices: [psu('S', 'p', 'n'), load('l', 'l+', 'l-')], wires: [['p', 'l+']] }).energizedLoads).toEqual([]);
    expect(solveDiscrete24V({ devices: [psu('S', 'p', 'n')], wires: [['p', 'n']] }).diagnostics[0]).toMatch(/short/);
  });
});
