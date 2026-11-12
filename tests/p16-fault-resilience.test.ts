import {describe,expect,it} from 'vitest';
import {p16ReferenceProject,type P16Original} from './fixtures/p16-autonomous-programs';
import {runP16ResilienceAudit,p16AuditPreflight} from '../src/plant/scenes/matrix-p16';
import {runP15AutonomousFactory} from '../src/plant/scenes/matrix-p15-autonomous-factory';
import {runP15AutonomousSort} from '../src/plant/scenes/matrix-p15-autonomous';

const scenarios:P16Original[]=['robot-sort','gantry-transfer','palletizing','bottle-line'];
describe('P16 independent first/middle/final fault-position endurance, replay and anti-bypass audit',()=>{
 it.each(scenarios)('%s completes real first/middle/last fault trials and exact deterministic replay',
  scene=>{
   const source=p16ReferenceProject(scene),before=JSON.stringify(source);
   expect(p16AuditPreflight(source,scene)).toEqual([]);
   const audit=runP16ResilienceAudit(source,scene);
   expect(audit.status,JSON.stringify({scene,profiles:audit.profiles,controls:audit.controls},null,2))
    .toBe('passed');
   expect(audit.deterministicReplay).toBe(true);
   expect(audit.profiles.map(p=>p.id)).toEqual([
    'first','middle','last','replay-middle',
   ]);
   const expected=scene==='palletizing'?8:3;
   expect(audit.profiles.map(p=>p.faultAtProduct)).toEqual([
    1,Math.ceil(expected/2),expected,Math.ceil(expected/2),
   ]);
   for(const profile of audit.profiles){
    expect(profile.passed).toBe(true);
    expect(profile.expected).toBe(expected);
    expect(profile.produced).toBe(expected);
    expect(profile.completed).toBe(expected);
    expect(profile.faultRecovered).toBe(true);
    expect(profile.throughputPerSimHour).toBeGreaterThan(0);
    expect(profile.simulatedMs).toBeGreaterThan(0);
   }
   expect(audit.controls.map(c=>c.id)).toEqual([
    'constant-on','constant-off','missing-physical-feedback','unpowered-plc',
   ]);
   expect(audit.controls.map(c=>c.observedStatus)).toEqual([
    'failed','failed','blocked','blocked',
   ]);
   expect(audit.controls.every(c=>c.rejected)).toBe(true);
   expect(audit.medianSimulatedMs).toBeGreaterThan(0);
   expect(audit.slowestSimulatedMs).toBeGreaterThanOrEqual(audit.medianSimulatedMs);
   expect(audit.lowestThroughputPerSimHour).toBeGreaterThan(0);
   expect(JSON.stringify(source)).toBe(before);
   expect(before).not.toContain('p16-audit-start');
   expect(before).not.toContain('p15-auto-start');
  },120000);
 it('rejects out-of-range fault schedules without fabricating a passing trial',()=>{
  const robot=p16ReferenceProject('robot-sort');
  for(const index of [0,-1,4,1.5,Number.NaN]){
   const result=runP15AutonomousSort(robot,'robot-sort',{faultAtProduct:index});
   expect(result.status).toBe('blocked');
   expect(result.cases).toHaveLength(0);
  }
  const factory=p16ReferenceProject('palletizing');
  for(const index of [0,-10,9,2.5,Number.POSITIVE_INFINITY]){
   const result=runP15AutonomousFactory(factory,'palletizing',{faultAtProduct:index});
   expect(result.status).toBe('blocked');
   expect(result.cases).toHaveLength(0);
  }
 });
 it('does not let a source edit or physical sensor disconnect borrow a former passing audit',()=>{
  const source=p16ReferenceProject('robot-sort');
  const disconnected={...source,wires:source.wires.filter(w=>
   w.from!=='eye.OUT_present'&&w.to!=='eye.OUT_present')};
  const blocked=runP16ResilienceAudit(disconnected,'robot-sort');
  expect(blocked.status).toBe('blocked');
  expect(blocked.profiles).toHaveLength(0);
  expect(blocked.controls).toHaveLength(0);
  const inert={...source,stSource:source.stSource.replace(
   'IF In0 THEN Phase := 1; END_IF;','IF FALSE THEN Phase := 1; END_IF;')};
  const failed=runP16ResilienceAudit(inert,'robot-sort');
  expect(failed.status).toBe('failed');
  expect(failed.profiles.some(p=>p.passed)).toBe(false);
  expect(failed.sourceSignature).not.toBe(blocked.sourceSignature);
  expect(source.components.some(c=>c.id.startsWith('p15-auto'))).toBe(false);
 },120000);
 it('refuses unsupported scenes before running or altering any physical machine',()=>{
  const project=p16ReferenceProject('robot-sort');
  const audit=runP16ResilienceAudit(project,'sorting-line');
  expect(audit.status).toBe('blocked');
  expect(audit.profiles).toHaveLength(0);
  expect(audit.controls).toHaveLength(0);
  expect(audit.expectedProducts).toBe(0);
 });
});
