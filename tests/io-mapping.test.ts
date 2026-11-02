import {describe,it,expect} from 'vitest';
import {parseDiscreteAddress,validateIoMapping,resolveIoPoints} from '../src/engineering/io-mapping';
import {workcellLadder} from '../src/engineering/workcell';
describe('discrete terminal map',()=>{
 it('parses byte and bit and rejects invalid bits',()=>{expect(parseDiscreteAddress('i0.7')?.canonical).toBe('I0.7');expect(parseDiscreteAddress('I0.8')).toBeNull();expect(parseDiscreteAddress('Q-1.0')).toBeNull();});
 it('rejects duplicate terminal ownership',()=>expect(validateIoMapping({...workcellLadder,symbols:{Start:{description:'start',address:'I0.0'},Stop:{description:'stop',address:'I0.0'}}}).length).toBeGreaterThan(0));
 it('rejects writing coils to input terminals',()=>expect(validateIoMapping({...workcellLadder,symbols:{RunLatch:{description:'run',address:'I0.5'}}}).length).toBeGreaterThan(0));
 it('maps live inputs without fabricating signal values',()=>{const points=resolveIoPoints(workcellLadder,{SensorOK:true,Start:false},{});expect(points.find(p=>p.tag==='SensorOK')?.address).toBe('I0.2');expect(points.find(p=>p.tag==='Start')?.value).toBe(false);});
});
