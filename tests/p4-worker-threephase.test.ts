import {describe,expect,it} from 'vitest';
import {STAR_DELTA_PANEL,STAR_DELTA_ST} from '../src/electrical/panel-templates';
import {createWorld,tick,validateProject,renderSnapshot} from '../src/sim/orchestrator';
import type {Command,WorldState} from '../src/sim/signals';
import type {ComponentKind} from '../src/components/registry';

const setup=():WorldState=>{
 const placements:Command[]=STAR_DELTA_PANEL.parts.map(part=>({
  k:'place',id:part.id,kind:part.kind as ComponentKind,at:{x:part.x,y:part.y},
 }));
 const wires:Command[]=STAR_DELTA_PANEL.wires.map(w=>({k:'wire',...w}));
 let w=tick(createWorld(),placements).world;
 expect(w.lastError).toBeNull();
 w=tick(w,wires).world;
 expect(w.lastError).toBeNull();
 expect(w.project.wires).toHaveLength(STAR_DELTA_PANEL.wires.length);
 w=tick(w,[{k:'loadST',source:STAR_DELTA_ST}]).world;
 expect(w.lastError).toBeNull();
 expect(w.project.language).toBe('st');
 return w;
};
const scans=(state:WorldState,n:number):WorldState=>{
 let w=state;for(let i=0;i<n;i++)w=tick(w).world;return w;
};
describe('P4 star/delta from actual dual-domain terminal wiring and real PLC scan',()=>{
 it('publishes only actual connected phase-domain state, not fake 24V on L1/L2/L3',()=>{
  const w=setup();const snapshot=renderSnapshot(w);
  expect(snapshot.phaseMeters.drive.status).toBe('live');
  expect(snapshot.phaseMeters.drive.lineToLine).toBe(400);
  expect(snapshot.voltages['mains.L1']).toBeUndefined();
  expect(snapshot.voltages['drive.L1']).toBeUndefined();
  expect(validateProject(JSON.parse(JSON.stringify(w.project)))).toEqual(w.project);
 });
 it('uses real ST program output coils for STAR start, open transition and DELTA acceleration',()=>{
  let w=tick(setup(),[{k:'run'},{k:'operate',id:'start',pressed:true}]).world;
  w=scans(w,35);
  expect(w.lastError).toBeNull();
  expect(w.threePhase.drive?.mainClosed).toBe(true);
  expect(w.threePhase.drive?.starClosed).toBe(true);
  expect(w.threePhase.drive?.motor.speedRpm).toBeGreaterThan(100);
  w=scans(w,60);
  expect(w.threePhase.drive?.starClosed).toBe(false);
  expect(w.threePhase.drive?.deltaClosed).toBe(true);
  expect(w.threePhase.drive?.motor.mode).toBe('delta');
  expect(w.threePhase.drive?.conflict).toBe(false);
  expect(w.threePhase.drive?.motor.currentA).toBeGreaterThan(0);
  expect(w.threePhase.drive?.motor.tripped).toBe(false);
  w=tick(w,[{k:'operate',id:'stop',pressed:true}]).world;
  w=scans(w,4);
  expect(w.threePhase.drive?.mainClosed).toBe(false);
  expect(w.threePhase.drive?.motor.currentA).toBe(0);
 });
 it('allows source isolation when paused but not while running',()=>{
  let w=setup();
  w=tick(w,[{k:'setThreePhasePower',id:'mains',enabled:false}]).world;
  expect(renderSnapshot(w).phaseMeters.drive.status).toBe('isolated');
  w=tick(w,[{k:'run'},{k:'operate',id:'start',pressed:true}]).world;
  w=scans(w,30);
  expect(w.threePhase.drive?.motor.speedRpm).toBe(0);
  const rejected=tick(w,[{k:'setThreePhasePower',id:'mains',enabled:true}]).world;
  expect(rejected.lastError).toMatch(/Pause/);
  expect(rejected.threePhasePower.mains).toBe(false);
 });
 it('rejects patching mains to 24V PLC supply and invalid phase crossings, including JSON import',()=>{
  let w=setup();w=tick(w,[{k:'wire',id:'bad',from:'mains.L1',to:'plc16.L+'}]).world;
  expect(w.lastError).toMatch(/cannot connect/);
  expect(w.project.wires.some(x=>x.id==='bad')).toBe(false);
  expect(()=>validateProject({...w.project,wires:[...w.project.wires,
   {id:'bad',from:'mains.L1',to:'drive.L2'}]})).toThrow(/Phase crossings/);
 });
 it('deterministically replays identical motor telemetry across 100 scans',()=>{
  const run=()=>{
   let w=tick(setup(),[{k:'run'},{k:'operate',id:'start',pressed:true}]).world;
   w=scans(w,100);return w.threePhase.drive;
  };
  expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
 });
});
