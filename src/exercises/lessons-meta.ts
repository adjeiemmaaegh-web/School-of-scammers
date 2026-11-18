/**
 * Lesson metadata only (no simulator imports), so landing/Learn pages can list lessons without pulling the engine
 * into the entry bundle. The checks and starters live in `lessons.ts`.
 */
export type LessonMeta = { id: string; title: string; level: 'beginner' | 'intermediate' | 'advanced'; summary: string; objectives: string[]; hints: string[] };
export const LESSON_META: readonly LessonMeta[] = [
  { id: 'lamp-pushbutton', title: 'A lamp on a pushbutton', level: 'beginner', summary: 'Wire a 24 V supply, a START pushbutton and a lamp so the lamp lights only while the button is held.',
    objectives: ['Connect the supply to the button and the button to the lamp', 'Return the lamp to the supply common', 'The lamp is off at rest, on while pressed, off again when released'],
    hints: ['A lamp is a load: current needs a path from P24 through it to M0', 'Use the multimeter across the lamp terminals to see where voltage is missing'] },
  { id: 'relay-seal-in', title: 'Hard-wired start/stop with a relay (no PLC)', level: 'beginner', summary: 'Build the classic seal-in: START latches a relay through its own contact, STOP (normally closed) releases it, and a lamp shows the state.',
    objectives: ['START then release keeps the lamp on (the relay seals itself in)', 'STOP drops it out and it stays off when STOP is released', 'No PLC and no program anywhere'],
    hints: ['Put START in parallel with a NO contact of the relay, then STOP in series with both', 'The relay coil is A1/A2; its NO contacts are 13-14 and 23-24', 'Feed the lamp from the second contact so the coil and the lamp circuits stay separate'] },
  { id: 'st-delayed-lamp', title: 'A one-second delay in Structured Text', level: 'intermediate', summary: 'Wire a 16/16 PLC, a pushbutton and a lamp, then use a TON timer in Structured Text so the lamp lights one second after the button is pressed and drops out when it is released.',
    objectives: ['Wire the button to an input and the lamp to an output of the PLC', 'Name the tags in the I/O panel and write the program', 'The lamp is still off at 0.5 s, on after 1.5 s, off again after release'],
    hints: ['Declare the timer in VAR: tm : TON;', 'Call it every scan: tm(IN := Go, PT := T#1s); then Lamp := tm.Q;', 'Remember the PLC needs its own 24 V on L+ and M'] },
];
