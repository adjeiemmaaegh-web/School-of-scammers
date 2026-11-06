import { describe, expect, it } from 'vitest';
import { createWorld, latchProgram, renderSnapshot, tick, validateSandboxProgram } from '../src/sim/orchestrator';
import { appendScanTrace, MAX_SCAN_TRACE, scanTraceCsv, type ScanTrace } from '../src/program/scan-trace';
import type { Command, WorldState } from '../src/sim/signals';
import type { LadderDocument } from '../src/engineering/ladder';

const components: Command[] = [
  { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } },
  { k: 'place', id: 'plc', kind: 'plc', at: { x: 280, y: 10 } },
  { k: 'place', id: 'start', kind: 'start', at: { x: 10, y: 240 } },
  { k: 'place', id: 'stop', kind: 'stop', at: { x: 280, y: 240 } },
  { k: 'place', id: 'con', kind: 'contactor', at: { x: 560, y: 10 } },
  { k: 'place', id: 'motor', kind: 'motor', at: { x: 800, y: 10 } },
];
const pairs = [
  ['ps.P24','plc.L+'], ['ps.M0','plc.M'],
  ['ps.P24','start.A'], ['start.B','plc.I0.0'],
  ['ps.P24','stop.A'], ['stop.B','plc.I0.1'],
  ['plc.Q0.0','con.A1'], ['ps.M0','con.A2'],
  ['ps.P24','con.13'], ['con.14','motor.L+'],
  ['ps.M0','motor.M-'],
] as const;
const wired = () => tick(createWorld(), [...components,
  ...pairs.map(([from,to],i): Command => ({ k:'wire',id:`w${i}`,from,to }))]).world;
const scan = (w: WorldState, n: number) => {
  for (let i=0;i<n;i++) w=tick(w).world;
  return w;
};
const down: LadderDocument = {
  id: 'down-count', version: '1',
  symbols: { CountReady: { description: 'CTD zero detected' } },
  rungs: [
    { id:'down', elements:[{ type:'contact',tag:'StopOK' }], coil:'CountReady',
      operation:{ kind:'ctd',preset:2,loadTag:'Start' } },
    { id:'drive', elements:[{ type:'contact',tag:'CountReady' }], coil:'Run' },
  ],
};

describe('P2 extended instruction and debugging workbench', () => {
  it('executes CTD load and two genuine PLC input edges through the wired motor', () => {
    expect(validateSandboxProgram(down)).toEqual([]);
    let w=tick(wired(),[{k:'loadProgram',program:down},
      {k:'operate',id:'start',pressed:true},{k:'operate',id:'stop',pressed:true},{k:'run'}]).world;
    expect(w.ladderMemory.down.count).toBe(2);
    w=tick(w,[{k:'operate',id:'start',pressed:false}]).world;
    expect(w.ladderMemory.down.count).toBe(2);
    w=tick(w,[{k:'operate',id:'stop',pressed:false}]).world;
    expect(w.ladderMemory.down.count).toBe(1);
    w=tick(w,[{k:'operate',id:'stop',pressed:true}]).world;
    w=tick(w,[{k:'operate',id:'stop',pressed:false}]).world;
    expect(w.ladderMemory.down.count).toBe(0);
    expect(w.coils.Run).toBe(true);
    w=scan(w,3);
    expect(w.motorOn).toBe(true);
  });
  it('uses actual worker sampled BOOL transitions for rising and falling breakpoints', () => {
    let w=tick(wired(),[{k:'loadProgram',program:latchProgram()},
      {k:'breakOnTag',breakpoint:{tag:'Run',edge:'rising'}},
      {k:'operate',id:'start',pressed:true},{k:'run'}]).world;
    expect(w.tick).toBe(1);
    expect(w.running).toBe(false);
    expect(w.coils.Run).toBe(true);
    expect(w.breakpointHit).toMatch(/Run rising edge/);
    expect(w.scanTrace.at(-1)?.breakpoint).toBe(w.breakpointHit);
    expect(tick(w).world.tick).toBe(1);
    w=tick(w,[{k:'breakOnTag',breakpoint:null},{k:'run'}]).world;
    w=scan(w,3);
    expect(w.motorOn).toBe(true);
    w=tick(w,[{k:'pause'},{k:'breakOnTag',breakpoint:{tag:'Run',edge:'falling'}}]).world;
    expect(w.running).toBe(false);
    w=tick(w,[{k:'operate',id:'stop',pressed:true},{k:'run'}]).world;
    expect(w.coils.Run).toBe(false);
    expect(w.breakpointHit).toMatch(/Run falling edge/);
    expect(w.running).toBe(false);
    w=tick(w,[{k:'step'}]).world;
    expect(w.motorOn).toBe(false);
  });
  it('rejects unknown edge tags and invalid reset/load tags without corrupting the project', () => {
    const initial=wired();
    const invalid=tick(initial,[{k:'breakOnTag',breakpoint:{tag:'Unknown',edge:'rising'}}]).world;
    expect(invalid.breakpointTag).toBeNull();
    expect(invalid.lastError).toMatch(/known Boolean PLC tag/);
    const corruptedReset: LadderDocument = { ...down,
      rungs: [{...down.rungs[0],operation:{kind:'ctu',preset:2,resetTag:'Unknown'}},down.rungs[1]] };
    const corruptedLoad: LadderDocument = { ...down,
      rungs: [{...down.rungs[0],operation:{kind:'ctd',preset:2,loadTag:'Unknown'}},down.rungs[1]] };
    expect(validateSandboxProgram(corruptedReset).join(' ')).toMatch(/reset tag.*not declared/);
    expect(validateSandboxProgram(corruptedLoad).join(' ')).toMatch(/load tag.*not declared/);
    expect(tick(initial,[{k:'loadProgram',program:corruptedLoad}]).world.project).toEqual(initial.project);
  });
  it('retains only the latest 300 authoritative scan records and copies them for UI', () => {
    let w=tick(createWorld(),[{k:'run'}]).world;
    w=scan(w,304);
    expect(w.tick).toBe(305);
    expect(w.scanTrace).toHaveLength(MAX_SCAN_TRACE);
    expect(w.scanTrace[0].scan).toBe(6);
    expect(w.scanTrace.at(-1)?.simulatedMs).toBe(305*50);
    const snapshot=renderSnapshot(w);
    expect(snapshot.scanTrace).toHaveLength(MAX_SCAN_TRACE);
    snapshot.scanTrace[0].scan=-123;
    expect(w.scanTrace[0].scan).toBe(6);
  });
  it('exports deterministic CSV and mitigates spreadsheet formula injection', () => {
    const row: ScanTrace={
      scan:1,simulatedMs:50,language:'ladder',start:false,stopOK:true,
      run:false,plcPowered:true,contactorOn:false,motorOn:false,
      networks:[{rung:'=IMPORTXML(1)',instruction:'coil',result:false}],breakpoint:null,
    };
    const csv=scanTraceCsv(appendScanTrace([],row));
    expect(csv).toContain('"\'=IMPORTXML(1):coil=0"');
    expect(csv).toContain('"simulated_ms"');
  });
});
