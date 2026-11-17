/**
 * Course path (roadmap R9.2): the intended learning order, mapped onto what actually exists today.
 * Every stage states honestly whether there is a guided scenario, a focused lab, or only the open simulator
 * (no guided lesson yet). Data only: the Learn page renders it and a test checks every link resolves.
 */
export type CourseKind = 'scenario' | 'lab' | 'open';
export type CourseStage = {
  id: string; title: string; goal: string; kind: CourseKind;
  /** Route to open. `open` stages go to the simulator and say what to build. */
  to: string;
  /** What is missing, stated plainly, when the stage has no guided lesson. */
  gap?: string;
};

export const COURSE: readonly CourseStage[] = [
  { id: 'limits', title: '1. What this simulator is (and is not)', goal: 'Understand the educational 24 V model, the 50 ms scan and that nothing here is safety-rated.', kind: 'open', to: '/sandbox',
    gap: 'No guided lesson; read Help in the simulator\'s menu bar.' },
  { id: 'dc-wiring', title: '2. 24 V DC wiring and the multimeter', goal: 'Patch a supply, a switch and a lamp, then measure voltages at terminals.', kind: 'lab', to: '/labs/electrical-bench' },
  { id: 'ladder', title: '3. Ladder: start/stop latch and timers', goal: 'Wire a motor starter and write a seal-in rung that stops when it should.', kind: 'scenario', to: '/scenario/plc-sbx-startstop' },
  { id: 'sensors', title: '4. Digital sensors and diverting', goal: 'Read a photoeye and drive a diverter from your own logic.', kind: 'scenario', to: '/scenario/plc-sbx-sorting' },
  { id: 'motor-panel', title: '5. Motor panels: protection, reversing, star-delta', goal: 'Build a protected starter, interlock forward and reverse, then sequence star-delta.', kind: 'lab', to: '/labs/starter',
    gap: 'The star-delta lab is separate from the 3D simulator; protected and reversing starters are in the simulator\'s Starters menu without a guided lesson.' },
  { id: 'st-fbd', title: '6. Structured Text and Function Block Diagram', goal: 'Re-write the start/stop with ST (including TON/CTU) and with FBD.', kind: 'open', to: '/sandbox',
    gap: 'No guided lesson yet; see docs/product/PLC_SUBSET.md for what is supported.' },
  { id: 'pneumatics', title: '7. Pneumatic sequences', goal: 'Drive a double-acting cylinder from its limit switches and diagnose a jam or no-air fault.', kind: 'lab', to: '/labs/pneumatics',
    gap: 'The sandbox cylinder and its faults have no guided lesson; the lab is separate.' },
  { id: 'analog', title: '8. Analog level control', goal: 'Keep a tank between two levels with a numeric input and tuned control.', kind: 'scenario', to: '/scenario/plc-sbx-tank' },
  { id: 'cell', title: '9. Conveyors, sorting and material handling', goal: 'Compose a workcell and run it from your own program.', kind: 'lab', to: '/labs/workcell',
    gap: 'The 21 original factory scenes are in the simulator\'s scene gallery without a step-by-step lesson.' },
  { id: 'troubleshoot', title: '10. Troubleshooting and commissioning', goal: 'Find a hidden fault with the multimeter and replace only the faulty part.', kind: 'scenario', to: '/scenario/plc-sbx-find-fault' },
  { id: 'multi-plc', title: '11. Several controllers working together', goal: 'Signal between two PLCs over a shared common, with isolated supplies.', kind: 'open', to: '/sandbox',
    gap: 'No guided lesson; start from Starters, then "Place two-panel layout".' },
];
