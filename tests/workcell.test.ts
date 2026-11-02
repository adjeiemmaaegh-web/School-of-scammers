import {describe,it,expect} from 'vitest';
import {initialWorkcell,stepWorkcell,replayWorkcell} from '../src/engineering/workcell';
const run=(...actions: Parameters<typeof stepWorkcell>[1][])=>replayWorkcell(actions);
describe('integrated electrical → PLC → machine simulation',()=>{
 it('starts with a disconnected sensor and stopped motor',()=>{const s=run('press-start');expect(s.motor).toBe(false);expect(s.plcInputs.SensorOK).toBe(false);});
 it('rejects wiring repair while energized',()=>{const s=run('connect-sensor');expect(s.sensorConnected).toBe(false);expect(s.events.join(' ')).toContain('REJECTED');});
 it('repairs isolated circuit and energizes the motor on start',()=>{const s=run('isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start');expect(s.motor).toBe(true);expect(s.plcInputs.SensorOK).toBe(true);expect(s.rungTrace[0].energized).toBe(true);});
 it('latches after releasing the momentary start',()=>expect(run('isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','release-start').motor).toBe(true));
 it('stop removes motor power and unlatches',()=>expect(run('isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','release-start','press-stop','release-stop').motor).toBe(false));
 it('guard interlock removes motor power',()=>expect(run('isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','open-guard').motor).toBe(false));
 it('power isolation removes motor power',()=>expect(run('isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','isolate-power').motor).toBe(false));
 it('replay is deterministic',()=>{const actions=['isolate-power','connect-sensor',{kind:'wire-sensor',target:'I0.2'},'restore-power','press-start','release-start'] as const;expect(replayWorkcell(actions)).toEqual(replayWorkcell(actions));});
 it('rejects invalid scan duration',()=>expect(()=>stepWorkcell(initialWorkcell(),'tick',0)).toThrow(RangeError));
});
