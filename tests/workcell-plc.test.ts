import {describe,it,expect} from 'vitest';
import {defaultLayout,initialScan} from '../src/engineering/workcell-layout';
import {DEMO_WORKCELL_PROGRAM,DEFAULT_OPERATOR_PANEL,initialWorkcellPlcState,stepWorkcellPlc} from '../src/engineering/workcell-plc';
import type {LadderDocument} from '../src/engineering/ladder';
const unsafe:LadderDocument={id:'unsafe-program',version:'1',rungs:[
 {id:'force-conveyor',elements:[{type:'contact',tag:'AlwaysOn'}],coil:'CV1_CMD'}
]};
describe('authored ladder / factory workcell integration',()=>{
 it('samples the field sensor, energizes ladder coils, advances conveyor and cylinder',()=>{
  const result=stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe1:true},100);
  expect(result.outputs.CV1_CMD).toBe(true);
  expect(result.outputs.CY1_CMD).toBe(true);
  expect(result.plant.devices.cv1.active).toBe(true);
  expect(result.plant.devices.cy1.value).toBeGreaterThan(0);
  expect(result.plant.devices.pe1.active).toBe(true);
  expect(result.trace).toHaveLength(2);
 });
 it('stops motion when an actual field input is false',()=>{
  const result=stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe1:false});
  expect(result.outputs.CV1_CMD).toBe(false);
  expect(result.plant.devices.cv1.active).toBe(false);
 });
 it('enforces command inhibition even if authored logic omits safety contacts',()=>{
  const result=stepWorkcellPlc(defaultLayout(),unsafe,initialWorkcellPlcState(),{...DEFAULT_OPERATOR_PANEL,EStopOK:false},{},100);
  // The program sees its own uncontrolled coil condition as false here; explicitly energize input in feedback case below.
  expect(result.plant.devices.cv1.active).toBe(false);
  const forced:LadderDocument={...unsafe,rungs:[{...unsafe.rungs[0],elements:[{type:'contact',tag:'GuardClosed'}]}]};
  const held=stepWorkcellPlc(defaultLayout(),forced,initialWorkcellPlcState(),{...DEFAULT_OPERATOR_PANEL,AutoEnable:false},{},100);
  expect(held.outputs.CV1_CMD).toBe(true);
  expect(held.plant.devices.cv1.active).toBe(false);
 });
 it('turns off actuator outputs on guard open, preserving bounded plant state',()=>{
  const a=stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe1:true},100);
  const b=stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,a,{...DEFAULT_OPERATOR_PANEL,GuardClosed:false},{pe1:true},100);
  expect(b.outputs.CV1_CMD).toBe(false);expect(b.plant.devices.cv1.active).toBe(false);
  expect(b.plant.timeMs).toBe(200);
 });
 it('preserves deterministic memory from scan to scan',()=>{
  const doc:LadderDocument={id:'delay',version:'1',rungs:[{id:'start-delay',elements:[{type:'contact',tag:'PE1_ACTIVE'}],coil:'CV1_CMD',operation:{kind:'ton',presetMs:200}}]};
  const s1=stepWorkcellPlc(defaultLayout(),doc,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe1:true},100);
  const s2=stepWorkcellPlc(defaultLayout(),doc,s1,DEFAULT_OPERATOR_PANEL,{pe1:true},100);
  expect(s1.outputs.CV1_CMD).toBe(false);
  expect(s2.outputs.CV1_CMD).toBe(true);
  expect(s2.memory['start-delay'].elapsedMs).toBe(200);
 });
 it('rejects malformed runtime control inputs',()=>{
  expect(()=>stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),{...DEFAULT_OPERATOR_PANEL,GuardClosed:'yes' as unknown as boolean},{})).toThrow();
  expect(()=>stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{},0)).toThrow();
 });
 it('replays identical device feedback and rung execution for identical inputs',()=>{
  const run=()=>stepWorkcellPlc(defaultLayout(),DEMO_WORKCELL_PROGRAM,initialWorkcellPlcState(),DEFAULT_OPERATOR_PANEL,{pe1:true},100);
  expect(run()).toEqual(run());
 });
});
