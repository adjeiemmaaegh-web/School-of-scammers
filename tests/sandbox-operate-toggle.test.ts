import { describe, expect, it } from 'vitest';
import { createWorld, latchProgram, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

/**
 * Regression: the UI used to send `operate { pressed: !c.pressed }`, computing the new value from its
 * last worker snapshot. Between scans that snapshot is stale, so two quick clicks sent the same value
 * twice and a press was lost (the flaky P4 reversing browser test). `operateToggle` is resolved by the
 * worker against authoritative state, in command order.
 */
const placed: Command[] = [
  { k: 'place', id: 'start', kind: 'start', at: { x: 10, y: 240 } },
  { k: 'place', id: 'stop', kind: 'stop', at: { x: 280, y: 240 } },
  { k: 'place', id: 'estop', kind: 'estop', at: { x: 560, y: 240 } },
  { k: 'place', id: 'con', kind: 'contactor', at: { x: 560, y: 10 } },
];
const fixture = (): WorldState => tick(createWorld(), [...placed, { k: 'loadProgram', program: latchProgram() }]).world;
const pressed = (w: WorldState, id: string) => w.project.components.find(c => c.id === id)!.pressed;
const toggle = (id: string): Command => ({ k: 'operateToggle', id });

describe('operateToggle is resolved against authoritative worker state', () => {
  it('flips a pushbutton on each command, across separate ticks', () => {
    let w = fixture();
    expect(pressed(w, 'start')).toBe(false);
    w = tick(w, [toggle('start')]).world;
    expect(pressed(w, 'start')).toBe(true);
    w = tick(w, [toggle('start')]).world;
    expect(pressed(w, 'start')).toBe(false);
  });

  it('flips once per command when several land in the same batch (the lost-press case)', () => {
    let w = fixture();
    w = tick(w, [toggle('start')]).world; // held down
    expect(pressed(w, 'start')).toBe(true);
    // "release then press again" arriving before any new snapshot: must end pressed.
    w = tick(w, [toggle('start'), toggle('start')]).world;
    expect(pressed(w, 'start')).toBe(true);
    // Three in one batch from released == pressed; four == released.
    w = tick(w, [toggle('start')]).world; // now released
    expect(pressed(w, 'start')).toBe(false);
    expect(pressed(tick(w, [toggle('start'), toggle('start'), toggle('start')]).world, 'start')).toBe(true);
    expect(pressed(tick(w, [toggle('start'), toggle('start'), toggle('start'), toggle('start')]).world, 'start')).toBe(false);
  });

  it('shows why a snapshot-derived absolute value loses the second click', () => {
    // What the old UI did: both clicks read the same stale snapshot (pressed=true) and send `false`.
    const w0 = tick(fixture(), [toggle('start')]).world; // pressed
    const stale = pressed(w0, 'start'); // snapshot the UI is still holding
    const oldBehaviour = tick(w0, [
      { k: 'operate', id: 'start', pressed: !stale }, { k: 'operate', id: 'start', pressed: !stale },
    ]).world;
    const newBehaviour = tick(w0, [toggle('start'), toggle('start')]).world;
    expect(pressed(oldBehaviour, 'start')).toBe(false); // the second intended press was lost
    expect(pressed(newBehaviour, 'start')).toBe(true); // authoritative toggling keeps both
  });

  it('latches and resets the training E-stop like a manual operator would', () => {
    let w = fixture();
    w = tick(w, [toggle('estop')]).world;
    expect(pressed(w, 'estop')).toBe(true);
    w = tick(w, [toggle('estop')]).world;
    expect(pressed(w, 'estop')).toBe(false);
  });

  it('is accepted while the PLC is running (operating is not editing)', () => {
    let w = fixture();
    w = tick(w, [{ k: 'run' }]).world;
    expect(w.running).toBe(true);
    w = tick(w, [toggle('start')]).world;
    expect(pressed(w, 'start')).toBe(true);
    expect(w.lastError).toBeNull();
  });

  it('keeps the existing absolute `operate` command working unchanged', () => {
    let w = fixture();
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }]).world;
    expect(pressed(w, 'start')).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'start', pressed: true }]).world; // idempotent
    expect(pressed(w, 'start')).toBe(true);
  });

  it('rejects non-operable devices and unknown ids with the same error and no state change', () => {
    const w0 = fixture();
    for (const id of ['con', 'does-not-exist']) {
      const w = tick(w0, [toggle(id)]).world;
      expect(w.lastError).toBe('Only pushbuttons and training E-stop can be operated');
      expect(w.project.components).toEqual(w0.project.components);
    }
  });

  it('replays deterministically from the same command log', () => {
    const log: Command[][] = [
      [toggle('start')], [toggle('start'), toggle('stop')], [{ k: 'run' }],
      [{ k: 'operate', id: 'stop', pressed: false }, toggle('estop')], [toggle('start')], [toggle('estop')],
    ];
    const play = () => log.reduce((w, cmds) => tick(w, cmds).world, fixture());
    const a = play(), b = play();
    expect(b.project).toEqual(a.project);
    expect(b.tick).toBe(a.tick);
    expect(JSON.stringify(b.inputs)).toBe(JSON.stringify(a.inputs));
  });
});
