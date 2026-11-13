import {describe,expect,it} from 'vitest';
import {freshStarterPanel} from '../src/electrical/three-phase-types';
import {stepWiredStarter} from '../src/electrical/wired-star-delta';
import {stepMotor} from '../src/electrical/motor-dynamics';
import {freshThermal,stepThermal} from '../src/electrical/thermal-protection';
import {threePhaseConnections} from '../src/electrical/three-phase-netlist';
import {readVirtualClamp} from '../src/electrical/phase-instruments';
const source={supplyId:'source',driveId:'drive',hasL1:true,hasL2:true,hasL3:true,
 hasPE:true,crossed:false,shorted:false,diagnostics:[]};
const coils=(main=false,star=false,delta=false,reset=false)=>({main,star,delta,reset});
describe('P4 24V controlled three-phase star-delta motor',()=>{
 it('will not run on unwired power even with all three PLC coils high',()=>{
  let s=freshStarterPanel();
  for(let i=0;i<30;i++)s=stepWiredStarter(s,null,coils(true,true,false));
  expect(s.motor.speedRpm).toBe(0);
  expect(s.mainsPresent).toBe(false);
  expect(readVirtualClamp(s).status).toBe('stopped');
 });
 it('starts in STAR, preserves interlock, then transfers to DELTA after open dead time',()=>{
  let s=freshStarterPanel();
  for(let i=0;i<40;i++)s=stepWiredStarter(s,source,coils(true,true,false));
  expect(s.starClosed).toBe(true);
  expect(s.motor.speedRpm).toBeGreaterThan(100);
  s=stepWiredStarter(s,source,coils(true,false,false));
  expect(s.starClosed).toBe(false);
  for(let i=0;i<2;i++)s=stepWiredStarter(s,source,coils(true,false,true));
  expect(s.deltaClosed).toBe(false);
  for(let i=0;i<5;i++)s=stepWiredStarter(s,source,coils(true,false,true));
  expect(s.deltaClosed).toBe(true);
  expect(s.starClosed).toBe(false);
  expect(s.motor.mode).toBe('delta');
 });
 it('disallows simultaneous STAR and DELTA even with a bad student program',()=>{
  let s=freshStarterPanel();
  s=stepWiredStarter(s,source,coils(true,true,true));
  expect(s.conflict).toBe(true);
  expect(s.starClosed).toBe(false);
  expect(s.deltaClosed).toBe(false);
  expect(s.motor.currentA).toBe(0);
  expect(s.events.join(' ')).toMatch(/simultaneously/);
 });
 it('models overcurrent heating and denies an immediate hot reset',()=>{
  let thermal=freshThermal();
  for(let i=0;i<300;i++)thermal=stepThermal(thermal,40,50);
  expect(thermal.tripped).toBe(true);
  const noReset=stepThermal(thermal,0,50,undefined,true);
  expect(noReset.tripped).toBe(true);
  for(let i=0;i<3000;i++)thermal=stepThermal(thermal,0,50);
  expect(stepThermal(thermal,0,50,undefined,true).tripped).toBe(false);
 });
 it('replays identical motor speed, modeled current and energy for identical commands',()=>{
  const run=()=>{let s=freshStarterPanel();for(let i=0;i<15;i++)s=stepWiredStarter(s,source,coils(true,true,false));return s};
  expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  expect(readVirtualClamp(run()).amps).toBeGreaterThan(0);
 });
});
