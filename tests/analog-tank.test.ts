import {describe,it,expect} from 'vitest';
import {initialTank,stepTank,simulateTank,tankSamplesCsv,DEFAULT_TANK_CONTROL,DEFAULT_TANK_CONFIG} from '../src/engineering/analog-tank';

const controls=DEFAULT_TANK_CONTROL;
describe('educational analog tank and PID',()=>{
 it('starts at a defined actual and measured level',()=>{const s=initialTank();expect(s.liters).toBe(200);expect(s.actualPercent).toBe(20);expect(s.measuredPercent).toBe(20);});
 it('deterministically settles toward the setpoint without overflow in a normal plant',()=>{
  const a=simulateTank(initialTank(),controls,240);const b=simulateTank(initialTank(),controls,240);
  expect(a).toEqual(b);expect(a.end.actualPercent).toBeGreaterThan(55);expect(a.end.actualPercent).toBeLessThan(65);expect(a.tripScans).toBe(0);expect(a.end.spilledLiters).toBe(0);
 });
 it('never pumps on E-stop, even with manual full duty',()=>{const s=stepTank(initialTank(),{...controls,mode:'manual',manualDuty:1,emergencyStop:true,demandOutflow:0});expect(s.duty).toBe(0);expect(s.liters).toBe(200);expect(s.alarm).toBe('EMERGENCY STOP');});
 it('honors external pump permissive even in manual mode',()=>{const s=stepTank(initialTank(),{...controls,mode:'manual',manualDuty:1,permitPump:false,demandOutflow:0});expect(s.liters).toBe(200);expect(s.duty).toBe(0);});
 it('high-high trip latches until drained below 90 percent and requested reset',()=>{
  let s=simulateTank(initialTank(),{...controls,mode:'manual',manualDuty:1,demandOutflow:0},20).end;
  expect(s.actualPercent).toBeGreaterThanOrEqual(98);expect(s.highHighTrip).toBe(true);
  const blocked=stepTank(s,{...controls,mode:'manual',manualDuty:1,resetTrip:true,demandOutflow:0});expect(blocked.highHighTrip).toBe(true);expect(blocked.duty).toBe(0);
  s=simulateTank(s,{...controls,mode:'manual',manualDuty:0,demandOutflow:12},12).end;
  expect(s.actualPercent).toBeLessThanOrEqual(90);expect(s.highHighTrip).toBe(true);
  const released=stepTank(s,{...controls,mode:'manual',manualDuty:0,resetTrip:true});expect(released.highHighTrip).toBe(false);
 });
 it('sensor stuck low reports disagreement and physical high-high still trips',()=>{
  const s=simulateTank(initialTank(),{...controls,mode:'manual',manualDuty:1,demandOutflow:0,fault:'sensor-stuck-low'},20).end;
  expect(s.measuredPercent).toBe(0);expect(s.actualPercent).toBeGreaterThan(50);expect(s.highHighTrip).toBe(true);
 });
 it('blocked inlet cannot increase plant volume',()=>{const s=stepTank(initialTank(),{...controls,mode:'manual',manualDuty:1,demandOutflow:0,fault:'inlet-blocked'});expect(s.liters).toBe(200);expect(s.totalInletLiters).toBe(0);});
 it('outlet leak increases outflow without making volume negative',()=>{const s=stepTank(initialTank(),{...controls,mode:'manual',manualDuty:0,demandOutflow:12,fault:'outlet-leak'});expect(s.liters).toBe(170);expect(s.totalOutletLiters).toBe(30);});
 it('restricts unphysical controller parameters and corrupt states',()=>{
  expect(()=>stepTank(initialTank(),{...controls,kp:NaN})).toThrow();
  expect(()=>stepTank(initialTank(),{...controls,setpointPercent:120})).toThrow();
  expect(()=>stepTank(initialTank(),controls,99999)).toThrow();
  expect(()=>stepTank({...initialTank(),liters:-1},controls)).toThrow();
  expect(()=>initialTank({...DEFAULT_TANK_CONFIG,capacityLiters:0})).toThrow();
 });
 it('exports escaped CSV with complete evidence and bounded rows',()=>{const t=simulateTank(initialTank(),controls,3);const csv=tankSamplesCsv(t.rows);expect(csv).toContain('actual_percent');expect(csv.split('\r\n')).toHaveLength(4);expect(()=>tankSamplesCsv(Array.from({length:10001},()=>t.rows[0]))).toThrow();});
 it('prevents excessive simulation work',()=>expect(()=>simulateTank(initialTank(),controls,3601)).toThrow(/3600/));
});