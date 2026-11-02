import {describe,it,expect} from 'vitest';
import {initialTerminalWiring,changeTerminalWiring,sampleTerminals,measureDcVoltage} from '../src/engineering/terminal-wiring';
import {initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
describe('virtual PLC terminal strip',()=>{
 it('isolates power before rewiring',()=>{expect(changeTerminalWiring(initialTerminalWiring(),{sensorPositive:'I0.2'},true,false).error).toBeTruthy();});
 it('samples correct and incorrect input terminals',()=>{const a=sampleTerminals({sensorPositive:'I0.2',sensorReturnConnected:true},true,true);expect(a.inputs['I0.2']).toBe(true);expect(a.inputs['I0.1']).toBe(false);expect(measureDcVoltage(a,'I0.2','M0')).toBe(24);});
 it('detects open sensor return',()=>{const a=sampleTerminals({sensorPositive:'I0.2',sensorReturnConnected:false},true,true);expect(a.inputs['I0.2']).toBe(false);expect(a.diagnostics).toHaveLength(1);});
 it('miswiring cannot energize intended input',()=>{const a=sampleTerminals({sensorPositive:'I0.1',sensorReturnConnected:true},true,true);expect(a.inputs['I0.2']).toBe(false);expect(a.inputs['I0.1']).toBe(true);});
 it('integrates wiring into PLC motor logic',()=>{let s=initialWorkcell();s=stepWorkcell(s,'isolate-power');s=stepWorkcell(s,'connect-sensor');s=stepWorkcell(s,{kind:'wire-sensor',target:'I0.2'});s=stepWorkcell(s,'restore-power');s=stepWorkcell(s,'press-start');expect(s.motor).toBe(true);});
 it('rejects live rewiring without changing state',()=>{let s=initialWorkcell();s=stepWorkcell(s,{kind:'wire-sensor',target:'I0.2'});expect(s.terminalWiring.sensorPositive).toBe('UNCONNECTED');expect(s.events.some(e=>e.includes('REJECTED'))).toBe(true);});
});
