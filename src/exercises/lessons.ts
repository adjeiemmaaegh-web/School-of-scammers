/**
 * Guided lessons on the open simulator (roadmap R9.3/R9.4). A lesson is DATA: an UNWIRED starter (parts only, never the
 * answer), objectives, hints, and outcome checks. A check drives the learner's own project through the real tick() and
 * asserts what the devices do, so any functionally correct build passes: hard-wired, relay or PLC, any tag names.
 * Vacuous passes are structurally impossible: every lesson must expect each checked device both ON and OFF.
 */
import type { Command, ProjectFile } from '../sim/signals';
import { createWorld, tick } from '../sim/orchestrator';

export type LessonStep = { op: 'run' } | { op: 'press' | 'release'; id: string } | { op: 'wait'; scans: number };
export type LessonExpect = { device: string; on: boolean; label: string };
export type LessonCheck = { label: string; steps: LessonStep[]; expect: LessonExpect[] };
export type Lesson = {
  id: string; title: string; level: 'beginner' | 'intermediate' | 'advanced'; summary: string;
  objectives: string[]; hints: string[];
  /** Commands that place the starter parts. Parts only: no wires, no program. */
  starterCommands: Command[];
  checks: LessonCheck[];
};
const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number, y = 20): Command => ({ k: 'place', id, kind, at: { x, y } });
const SCAN = 50;

export const LESSONS: readonly Lesson[] = [
  {
    id: 'lamp-pushbutton', title: 'A lamp on a pushbutton', level: 'beginner',
    summary: 'Wire a 24 V supply, a START pushbutton and a lamp so the lamp lights only while the button is held.',
    objectives: ['Connect the supply to the button and the button to the lamp', 'Return the lamp to the supply common', 'The lamp is off at rest, on while pressed, off again when released'],
    hints: ['A lamp is a load: current needs a path from P24 through it to M0', 'Use the multimeter across the lamp terminals to see where voltage is missing'],
    starterCommands: [place('ps', 'supply', 20), place('go', 'start', 260), place('lamp', 'lamp', 500)],
    checks: [
      { label: 'At rest the lamp is off', steps: [{ op: 'run' }, { op: 'wait', scans: 6 }], expect: [{ device: 'lamp', on: false, label: 'lamp off with nothing pressed' }] },
      { label: 'Pressing START lights the lamp', steps: [{ op: 'run' }, { op: 'press', id: 'go' }, { op: 'wait', scans: 8 }], expect: [{ device: 'lamp', on: true, label: 'lamp on while START is held' }] },
      { label: 'Releasing START turns it off', steps: [{ op: 'run' }, { op: 'press', id: 'go' }, { op: 'wait', scans: 6 }, { op: 'release', id: 'go' }, { op: 'wait', scans: 8 }], expect: [{ device: 'lamp', on: false, label: 'lamp off after release' }] },
    ],
  },
  {
    id: 'relay-seal-in', title: 'Hard-wired start/stop with a relay (no PLC)', level: 'beginner',
    summary: 'Build the classic seal-in: START latches a relay through its own contact, STOP (normally closed) releases it, and a lamp shows the state.',
    objectives: ['START then release keeps the lamp on (the relay seals itself in)', 'STOP drops it out and it stays off when STOP is released', 'No PLC and no program anywhere'],
    hints: ['Put START in parallel with a NO contact of the relay, then STOP in series with both', 'The relay coil is A1/A2; its NO contacts are 13-14 and 23-24', 'Feed the lamp from the second contact so the coil and the lamp circuits stay separate'],
    starterCommands: [place('ps', 'supply', 20), place('start', 'start', 220), place('stop', 'stop', 420), place('k', 'relay', 620), place('lamp', 'lamp', 820)],
    checks: [
      { label: 'At rest the lamp is off', steps: [{ op: 'run' }, { op: 'wait', scans: 6 }], expect: [{ device: 'lamp', on: false, label: 'lamp off at rest' }] },
      { label: 'START then release latches', steps: [{ op: 'run' }, { op: 'press', id: 'start' }, { op: 'wait', scans: 6 }, { op: 'release', id: 'start' }, { op: 'wait', scans: 12 }], expect: [{ device: 'lamp', on: true, label: 'lamp still on after START is released' }] },
      { label: 'STOP releases and stays released', steps: [{ op: 'run' }, { op: 'press', id: 'start' }, { op: 'wait', scans: 6 }, { op: 'release', id: 'start' }, { op: 'wait', scans: 8 }, { op: 'press', id: 'stop' }, { op: 'wait', scans: 8 }, { op: 'release', id: 'stop' }, { op: 'wait', scans: 12 }], expect: [{ device: 'lamp', on: false, label: 'lamp off after STOP and after releasing STOP' }] },
    ],
  },
  {
    id: 'st-delayed-lamp', title: 'A one-second delay in Structured Text', level: 'intermediate',
    summary: 'Wire a 16/16 PLC, a pushbutton and a lamp, then use a TON timer in Structured Text so the lamp lights one second after the button is pressed and drops out when it is released.',
    objectives: ['Wire the button to an input and the lamp to an output of the PLC', 'Name the tags in the I/O panel and write the program', 'The lamp is still off at 0.5 s, on after 1.5 s, off again after release'],
    hints: ['Declare the timer in VAR: tm : TON;', 'Call it every scan: tm(IN := Go, PT := T#1s); then Lamp := tm.Q;', 'Remember the PLC needs its own 24 V on L+ and M'],
    starterCommands: [place('ps', 'supply', 20), place('p', 'plc16', 220), place('go', 'start', 520), place('lamp', 'lamp', 720)],
    checks: [
      { label: 'At rest the lamp is off', steps: [{ op: 'run' }, { op: 'wait', scans: 8 }], expect: [{ device: 'lamp', on: false, label: 'lamp off at rest' }] },
      { label: 'Still off before the delay', steps: [{ op: 'run' }, { op: 'wait', scans: 4 }, { op: 'press', id: 'go' }, { op: 'wait', scans: 8 }], expect: [{ device: 'lamp', on: false, label: 'lamp still off about 0.5 s after pressing' }] },
      { label: 'On after the delay', steps: [{ op: 'run' }, { op: 'wait', scans: 4 }, { op: 'press', id: 'go' }, { op: 'wait', scans: 34 }], expect: [{ device: 'lamp', on: true, label: 'lamp on about 1.7 s after pressing' }] },
      { label: 'Off again after release', steps: [{ op: 'run' }, { op: 'wait', scans: 4 }, { op: 'press', id: 'go' }, { op: 'wait', scans: 34 }, { op: 'release', id: 'go' }, { op: 'wait', scans: 10 }], expect: [{ device: 'lamp', on: false, label: 'lamp off after release' }] },
    ],
  },
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find(l => l.id === id);
export const starterProject = (lesson: Lesson): ProjectFile => tick(createWorld(), lesson.starterCommands).world.project;

export type CheckResult = { label: string; passed: boolean; reason: string };
export type LessonResult = { lessonId: string; passed: boolean; built: boolean; results: CheckResult[] };

/**
 * Runs every check against the learner's project in a fresh world through the real tick(). Never throws: a project the
 * simulator rejects is reported as a failing lesson with the reason.
 */
export function gradeLesson(lesson: Lesson, project: ProjectFile): LessonResult {
  const starter = starterProject(lesson);
  const built = project.wires.length > starter.wires.length;
  const results: CheckResult[] = [];
  for (const check of lesson.checks) {
    let world = tick(createWorld(), [{ k: 'loadProject', project }]).world;
    if (world.lastError) { results.push({ label: check.label, passed: false, reason: `The simulator rejected the project: ${world.lastError}` }); continue; }
    let failure = '';
    try {
      for (const step of check.steps) {
        if (step.op === 'run') world = tick(world, [{ k: 'run' }]).world;
        else if (step.op === 'wait') { for (let i = 0; i < step.scans; i++) world = tick(world, [], SCAN).world; }
        else world = tick(world, [{ k: 'operate', id: step.id, pressed: step.op === 'press' }]).world;
        if (world.lastError) { failure = `The simulator reported: ${world.lastError}`; break; }
      }
      if (!failure) for (const e of check.expect) {
        if (!world.project.components.some(c => c.id === e.device)) { failure = `The part "${e.device}" from the starter is missing.`; break; }
        const on = world.deviceOn[e.device] === true;
        if (on !== e.on) { failure = `Expected ${e.label}: ${e.device} was ${on ? 'ON' : 'OFF'}, it should be ${e.on ? 'ON' : 'OFF'}.`; break; }
      }
    } catch (error) { failure = `The simulation failed: ${error instanceof Error ? error.message : 'unknown error'}`; }
    results.push({ label: check.label, passed: !failure, reason: failure || 'Passed' });
  }
  const passed = built && results.every(r => r.passed);
  if (!built) results.unshift({ label: 'Build something', passed: false, reason: 'No wires have been added to the starter yet.' });
  return { lessonId: lesson.id, passed, built, results };
}
