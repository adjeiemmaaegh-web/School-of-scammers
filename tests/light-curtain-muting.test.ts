import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { COMPONENTS } from '../src/components/registry';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const curtain = (params: Record<string, number> = {}): EquipmentPlacement => ({ id: 'lc', kind: 'light-curtain', originMm: vec(0, 0, 0), yawDeg: 0, params });
const world = (size: [number, number, number] = [100, 100, 700]) => spawnBody(freshWorld(), 't', { size: vec(...size), massKg: 5, pos: vec(100, 0, 120), supportedBy: null });
type Cmd = Record<string, boolean | number>;
function run(cmd: (i: number) => Cmd, scans: number, item = curtain(), w = world(), faults: Record<string, string | null> = {}, each?: (r: SceneRuntime, i: number) => void) {
  let r = freshRuntime(w, [item], PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) { r = stepScene(r, [item], PLANT_EQUIPMENT, { lc: cmd(i) }, faults); each?.(r, i); }
  return r;
}
const sig = (r: SceneRuntime, n: string) => r.signals.lc[n];

describe('R20 light curtain muting', () => {
  it('without a mute command it behaves as before: blocked by a part, tall for a high part, clear when empty', () => {
    const r = run(() => ({}), 3);
    expect([sig(r, 'blocked'), sig(r, 'tall'), sig(r, 'muted'), sig(r, 'muteTimeout')]).toEqual([true, true, false, false]);
    expect(sig(run(() => ({}), 3, curtain(), world([100, 100, 200])), 'tall')).toBe(false);
    const empty = freshRuntime(freshWorld(), [curtain()], PLANT_EQUIPMENT);
    expect(stepScene(empty, [curtain()], PLANT_EQUIPMENT, { lc: {} }).signals.lc.blocked).toBe(false);
  });
  it('while muted the curtain ignores the part (blocked and tall drop) and reports muted', () => {
    const r = run(() => ({ mute: true }), 3);
    expect(sig(r, 'muted')).toBe(true); expect(sig(r, 'blocked')).toBe(false); expect(sig(r, 'tall')).toBe(false);
  });
  it('releasing the mute makes the curtain live again at once', () => {
    const r = run(i => ({ mute: i < 5 }), 8);
    expect(sig(r, 'muted')).toBe(false); expect(sig(r, 'blocked')).toBe(true);
  });
  it('a mute held past the maximum expires: the curtain is live again, the timeout is raised, and it clears only when the mute is released', () => {
    const item = curtain({ maxMuteMs: 500 });                                    // 10 scans of 50 ms
    let mutedScans = 0;
    const r = run(() => ({ mute: true }), 30, item, world(), {}, rr => { if (sig(rr, 'muted')) mutedScans++; });
    expect(mutedScans).toBeGreaterThanOrEqual(9); expect(mutedScans).toBeLessThanOrEqual(11);   // about 500 ms of muting, not more
    expect(sig(r, 'muted')).toBe(false); expect(sig(r, 'muteTimeout')).toBe(true);
    expect(sig(r, 'blocked')).toBe(true);                                                         // protected again although the PLC still asks for a mute
    const released = run(i => ({ mute: i < 30 }), 33, item);
    expect(sig(released, 'muteTimeout')).toBe(false);
    expect(sig(released, 'blocked')).toBe(true);
  });
  it('a fresh mute after release gets its full time again', () => {
    const item = curtain({ maxMuteMs: 500 });
    let mutedScans = 0;
    run(i => ({ mute: i >= 30 && i < 60 }), 60, item, world(), {}, (rr, i) => { if (i >= 30 && sig(rr, 'muted')) mutedScans++; });
    expect(mutedScans).toBeGreaterThanOrEqual(9);
  });
  it('the maximum mute time setting is honoured: a longer limit mutes for longer', () => {
    const count = (maxMuteMs: number) => { let n = 0; run(() => ({ mute: true }), 80, curtain({ maxMuteMs }), world(), {}, rr => { if (sig(rr, 'muted')) n++; }); return n; };
    expect(count(2000)).toBeGreaterThan(count(500) * 2);
  });
  it('a broken beam still reads clear and mute does not change that; the device now has a command terminal', () => {
    const r = run(() => ({}), 3, curtain(), world(), { lc: 'beam-broken' });
    expect(sig(r, 'blocked')).toBe(false);
    expect(COMPONENTS['light-curtain'].terminals.some(t => t.name === 'CMD_mute+')).toBe(true);
  });
  describe('two-sensor muting sequence', () => {
    const seq = (m1: (i: number) => boolean, m2: (i: number) => boolean, scans: number, item = curtain()) =>
      run(i => ({ m1: m1(i), m2: m2(i) }), scans, item);
    it('m1 then m2 (overlapping) mutes the curtain while either is active, and ends when both are released', () => {
      const during = seq(i => i >= 2 && i < 20, i => i >= 6 && i < 24, 10);
      expect(sig(during, 'muted')).toBe(true); expect(sig(during, 'sequenceOk')).toBe(true); expect(sig(during, 'blocked')).toBe(false);
      const stillM2 = seq(i => i >= 2 && i < 8, i => i >= 6 && i < 30, 15);
      expect(sig(stillM2, 'muted')).toBe(true);                                      // m1 gone, m2 still active: still muting
      const after = seq(i => i >= 2 && i < 8, i => i >= 6 && i < 12, 16);
      expect(sig(after, 'muted')).toBe(false); expect(sig(after, 'blocked')).toBe(true);
    });
    it('the wrong order (m2 first) never mutes: that is what a person walking in looks like', () => {
      const r = seq(i => i >= 6 && i < 20, i => i >= 2 && i < 20, 12);
      expect(sig(r, 'muted')).toBe(false); expect(sig(r, 'blocked')).toBe(true);
    });
    it('m2 arriving after m1 has been released is not a valid pass, and m1 alone never mutes', () => {
      const gap = seq(i => i >= 2 && i < 5, i => i >= 8 && i < 20, 12);
      expect(sig(gap, 'muted')).toBe(false);
      const only = seq(i => i >= 2, () => false, 10);
      expect(sig(only, 'muted')).toBe(false);
    });
    it('m2 arriving in the very scan m1 is released is not an overlapping pass', () => {
      const r = seq(i => i >= 2 && i < 6, i => i >= 6 && i < 20, 10);
      expect(sig(r, 'muted')).toBe(false); expect(sig(r, 'blocked')).toBe(true);
    });
    it('m2 too late (past the window) does not start a mute; inside the window it does', () => {
      const item = curtain({ sequenceMs: 500 });
      const late = seq(i => i >= 2, i => i >= 20, 24, item);                           // m2 comes 900 ms after m1 with a 500 ms window
      expect(sig(late, 'muted')).toBe(false);
      const inside = seq(i => i >= 2, i => i >= 8, 12, curtain({ sequenceMs: 500 }));   // 300 ms after
      expect(sig(inside, 'muted')).toBe(true);
    });
    it('a sequence mute is still limited by the maximum mute time', () => {
      const r = seq(i => i >= 2, i => i >= 4, 40, curtain({ maxMuteMs: 500 }));
      expect(sig(r, 'muted')).toBe(false); expect(sig(r, 'muteTimeout')).toBe(true); expect(sig(r, 'blocked')).toBe(true);
    });
    it('a new valid pass works again after the first one ended', () => {
      const r = seq(i => (i >= 2 && i < 8) || (i >= 20 && i < 30), i => (i >= 5 && i < 10) || (i >= 23 && i < 32), 26);
      expect(sig(r, 'muted')).toBe(true);
    });
  });
});
