import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../src/components/registry';
import { createWorld, renderSnapshot, sortingProgram, tick, validateProject } from '../src/sim/orchestrator';
import { stationPosition } from '../src/plant/sorting-conveyor';
import type { Command, WorldState } from '../src/sim/signals';

const places: Command[] = [
  { k:'place',kind:'supply',id:'ps',at:{x:25,y:25} },
  { k:'place',kind:'plc',id:'plc',at:{x:315,y:25} },
  { k:'place',kind:'contactor',id:'con',at:{x:555,y:25} },
  { k:'place',kind:'conveyor',id:'belt',at:{x:610,y:280} },
  { k:'place',kind:'start',id:'start',at:{x:60,y:245} },
  { k:'place',kind:'stop',id:'stop',at:{x:325,y:245} },
  { k:'place',kind:'photoeye',id:'eye',at:{x:690,y:380} },
  { k:'place',kind:'diverter',id:'gate',at:{x:750,y:170} },
];
const links: [string,string][] = [
  ['ps.P24','plc.L+'], ['ps.M0','plc.M'],
  ['ps.P24','start.A'], ['start.B','plc.I0.0'],
  ['ps.P24','stop.A'], ['stop.B','plc.I0.1'],
  ['ps.P24','con.13'], ['ps.M0','con.A2'], ['plc.Q0.0','con.A1'],
  ['con.14','belt.L+'], ['ps.M0','belt.M-'],
  ['ps.P24','eye.L+'], ['ps.M0','eye.M'], ['eye.OUT','plc.I0.2'],
  ['plc.Q0.1','gate.A1'], ['ps.M0','gate.A2'],
];
const make = (ignore: number[] = [], program = sortingProgram()): WorldState => {
  let w=tick(createWorld(), [...places, ...links.filter((_,i)=>!ignore.includes(i))
    .map(([from,to],i): Command => ({k:'wire',id:`w${i}`,from,to}))]).world;
  w=tick(w,[{k:'loadProgram',program}]).world;
  return w;
};
const scans = (initial: WorldState, n: number): WorldState => {
  let w=initial;
  for(let i=0;i<n;i++) w=tick(w).world;
  return w;
};
const start = (w: WorldState) => scans(tick(w,[
  {k:'operate',id:'start',pressed:true}, {k:'run'},
]).world,4);
const release = (w: WorldState) => tick(w,[{k:'operate',id:'start',pressed:false}]).world;
const feed = (w: WorldState, kind: 'marked'|'plain') => tick(w,[{k:'feedParcel',kind}]).world;

describe('P3 live 3D material flow through wired PLC and physical I/O',()=>{
  it('routes a marked parcel to reject through actual Q0.1 and energised diverter',()=>{
    let w=release(start(make()));
    expect(w.conveyorOn).toBe(true);
    expect(w.motorOn).toBe(false); // P1 24V motor is optional; conveyor is a separate load
    w=feed(w,'marked');
    // Feeding during Run also processes this fixed 50ms worker scan.
    expect(w.plant.parcel?.position).toBe(0.032);
    let sawEye=false,sawGate=false,sawReject=false;
    for(let i=0;i<60;i++) {
      const update=tick(w);w=update.world;
      sawEye ||= w.inputs.Photoeye;
      sawGate ||= w.diverterOn;
      sawReject ||= update.events.some(e=>e.detail.includes('reject route'));
      if(w.plant.parcel===null)break;
    }
    expect(sawEye).toBe(true);
    expect(sawGate).toBe(true);
    expect(sawReject).toBe(true);
    expect(w.plant).toMatchObject({accepted:0,rejected:1,parcel:null});
    expect(w.coils.Run).toBe(true);
    expect(renderSnapshot(w).io).toMatchObject({'Q0.0':true, 'Q0.1':false});
  });
  it('uses the SAME wired photoeye and Q0.1 diverter when learner selects typed Structured Text',()=>{
    const source = [
      'VAR_INPUT',
      ' Start : BOOL;',
      ' StopOK : BOOL;',
      ' Photoeye : BOOL;',
      'END_VAR',
      'VAR_OUTPUT',
      ' Run : BOOL;',
      ' Sort : BOOL;',
      'END_VAR',
      'Run := StopOK AND (Start OR Run);',
      'Sort := Run AND Photoeye;',
    ].join('\n');
    let w=tick(make(),[{k:'loadST',source}]).world;
    expect(w.project.language).toBe('st');
    w=feed(release(start(w)),'marked');
    w=scans(w,45);
    expect(w.plant).toMatchObject({ accepted:0, rejected:1, parcel:null });
    expect(w.lastError).toBeNull();
  });
  it('publishes genuine parcel feed events even while paused',()=>{
    const w=make();
    const result=tick(w,[{k:'feedParcel',kind:'marked'}]);
    expect(result.snapshot.plant.parcel?.kind).toBe('marked');
    expect(result.events.some(e=>e.detail.includes('marked package fed'))).toBe(true);
    expect(result.snapshot.tick).toBe(0);
  });
  it('accepts an unmarked parcel with the same correct program, without a false photoeye',()=>{
    let w=feed(release(start(make())),'plain');
    let eye=false,gate=false;
    for(let i=0;i<60;i++){
      w=tick(w).world;eye ||= w.inputs.Photoeye;gate ||= w.diverterOn;
      if(!w.plant.parcel)break;
    }
    expect(eye).toBe(false);expect(gate).toBe(false);
    expect(w.plant).toMatchObject({accepted:1,rejected:0,parcel:null});
  });
  it('exposes incorrect learner logic: no Sort coil means marked parcel goes to pass lane',()=>{
    const sample=sortingProgram();
    const wrong = { ...sample, rungs: [sample.rungs[0], {
      id:'wrong',elements:[{type:'contact' as const,tag:'Unused'}],coil:'Sort',
    }] };
    let w=feed(release(start(make([],wrong))),'marked');
    w=scans(w,45);
    expect(w.plant).toMatchObject({accepted:1,rejected:0,parcel:null});
  });
  it('requires real photoeye supply/return and connected PLC I0.2, not frontend sensor graphics',()=>{
    // Removing OUT->I0.2 is equivalent to a missing sensor wire.
    for(const broken of [[13],[12],[11]]) {
      let w=feed(release(start(make(broken))),'marked');
      w=scans(w,45);
      expect(w.plant).toMatchObject({accepted:1,rejected:0});
      expect(w.coils.Sort).toBe(false);
    }
  });
  it('requires a real wired Q0.1->A1: PLC may command Sort but diverter cannot act',()=>{
    let w=feed(release(start(make([14]))),'marked');
    let commanded=false;
    for(let i=0;i<45;i++){w=tick(w).world;commanded ||= w.coils.Sort === true;}
    expect(commanded).toBe(true);
    expect(w.plant).toMatchObject({accepted:1,rejected:0});
  });
  it('uses station geometry: moving the photoeye away cancels detection and sorting',()=>{
    let w=make();
    w=tick(w,[{k:'move',id:'eye',to:{x:210,y:470}}]).world;
    const components=w.project.components;
    expect(stationPosition(components.find(c=>c.kind==='conveyor'),components.find(c=>c.kind==='photoeye'))).toBeNull();
    w=feed(release(start(w)),'marked');
    w=scans(w,45);
    expect(w.plant.accepted).toBe(1);
    expect(w.plant.rejected).toBe(0);
  });
  it('pauses all parcel kinematics when the wired motor supply is absent',()=>{
    let w=make([9]); // broken contactor 14 -> conveyor L+
    w=feed(release(start(w)),'marked');
    w=scans(w,30);
    expect(w.conveyorOn).toBe(false);
    expect(w.plant.parcel?.position).toBe(0);
    expect(w.plant.accepted+w.plant.rejected).toBe(0);
  });
  it('preserves legacy projects, isolates project snapshots and resets all plant counters',()=>{
    expect(COMPONENTS.conveyor.terminals.map(t=>t.name)).toEqual(['L+','M-']);
    let w=feed(release(start(make())),'marked');
    const snap=renderSnapshot(w);
    snap.plant.parcel!.position=99;
    expect(w.plant.parcel?.position).toBe(0.032);
    w=scans(w,45);
    expect(w.plant.rejected).toBe(1);
    w=tick(w,[{k:'reset'}]).world;
    expect(w.plant).toMatchObject({accepted:0,rejected:0,parcel:null});
    expect(w.tick).toBe(0);
    expect(validateProject(w.project).components).toHaveLength(8);
  });
  it('allows several conveyors, eyes and diverters (each conveyor is its own lane) and rejects unknown parcel commands',()=>{
    const w=make();
    for(const kind of ['conveyor','photoeye','diverter'] as const){
      const added=tick(w,[{k:'place',kind,id:`second-${kind}`,at:{x:900,y:400}}]).world;
      expect(added.project.components).toHaveLength(9);
      expect(added.lastError).toBeNull();
    }
    expect(tick(w,[{k:'feedParcel',kind:'invalid' as 'plain'}]).world.lastError).toMatch(/Unknown parcel type/);
  });
  it('is reproducible: identical command and wiring sequence gives identical traced outputs',()=>{
    const cycle=()=>{
      let w=feed(release(start(make())),'marked');
      const trace=[];
      for(let i=0;i<45;i++){
        w=tick(w).world;trace.push([w.inputs.Photoeye,w.coils.Sort,w.diverterOn,
          w.plant.parcel?.position ?? null,w.plant.rejected]);
      }
      return trace;
    };
    expect(cycle()).toEqual(cycle());
  });
});
