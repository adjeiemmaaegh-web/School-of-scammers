import {describe,it,expect} from 'vitest';
import {evaluateStarter,initialStarterFaults,changeStarterFault} from '../src/engineering/control-panel';
import {initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
describe('educational motor starter',()=>{
 it('energizes healthy coil and contactor',()=>{const s=evaluateStarter(true,true,true,initialStarterFaults());expect(s.motorPowered).toBe(true);expect(s.feedback).toBe(true)});
 it('open fuse blocks power',()=>{const s=evaluateStarter(true,true,true,{...initialStarterFaults(),fuseOpen:true});expect(s.motorPowered).toBe(false);expect(s.voltages.F1_OUT).toBe(0)});
 it('overload interrupts motor power',()=>expect(evaluateStarter(true,true,true,{...initialStarterFaults(),overloadTripped:true}).motorPowered).toBe(false));
 it('broken coil prevents pull-in',()=>expect(evaluateStarter(true,true,true,{...initialStarterFaults(),coilOpen:true}).contactorClosed).toBe(false));
 it('auxiliary fault separates feedback from actual contact state',()=>{const s=evaluateStarter(true,true,true,{...initialStarterFaults(),auxiliaryStuckOpen:true});expect(s.motorPowered).toBe(true);expect(s.feedback).toBe(false)});
 it('welded contacts can remain closed without command',()=>{const s=evaluateStarter(true,false,true,{...initialStarterFaults(),contactorWelded:true});expect(s.motorPowered).toBe(true);expect(s.diagnostics.join(' ')).toMatch(/welded/)});
 it('fault changes require power isolation',()=>expect(changeStarterFault(initialStarterFaults(),'coilOpen',true,true,false).error).toBeTruthy());
 it('workcell rejects energized injection and accepts isolated injection',()=>{let s=initialWorkcell();s=stepWorkcell(s,{kind:'starter-fault',fault:'coilOpen',active:true});expect(s.starter.faults.coilOpen).toBe(false);s=stepWorkcell(s,'isolate-power');s=stepWorkcell(s,{kind:'starter-fault',fault:'coilOpen',active:true});expect(s.starter.faults.coilOpen).toBe(true)});
});
