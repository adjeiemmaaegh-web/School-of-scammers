import {describe,expect,it} from 'vitest';
import {threePhaseConnections,threePhaseWireError,isThreePhaseWire} from '../src/electrical/three-phase-netlist';
import {readPhaseMeter} from '../src/electrical/phase-instruments';
const parts=[{id:'mains',kind:'three-phase-supply'},{id:'drive',kind:'star-delta-drive'},
 {id:'control',kind:'supply'},{id:'plc',kind:'plc16'}];
const wires=[
 {from:'mains.L1',to:'drive.L1'},{from:'mains.L2',to:'drive.L2'},
 {from:'mains.L3',to:'drive.L3'},{from:'mains.PE',to:'drive.PE'},
];
describe('P4 strict three-phase domain and isolated measurements',()=>{
 it('requires actual matching phase conductors and reports missing lines',()=>{
  const c=threePhaseConnections(parts,wires).drive;
  expect(c.hasL1&&c.hasL2&&c.hasL3&&c.hasPE).toBe(true);
  expect(readPhaseMeter(c)).toEqual({L1:230,L2:230,L3:230,lineToLine:400,status:'live'});
  const missing=threePhaseConnections(parts,wires.slice(0,2)).drive;
  expect(readPhaseMeter(missing).status).toBe('phase-loss');
 });
 it('rejects 24V / mains cross connection, phase inversion and same-device shorts',()=>{
  const owner=Object.fromEntries(parts.map(p=>[p.id,p.kind]));
  expect(threePhaseWireError('control.P24','drive.L1',owner)).toMatch(/cannot connect/);
  expect(threePhaseWireError('mains.L1','drive.L2',owner)).toMatch(/crossings/);
  expect(threePhaseWireError('drive.L1','drive.L2',owner)).toMatch(/crossings/);
  expect(isThreePhaseWire({from:'mains.L1',to:'drive.L1'})).toBe(true);
  expect(isThreePhaseWire({from:'control.P24',to:'plc.L+'})).toBe(false);
  expect(threePhaseConnections(parts,[{from:'mains.L1',to:'drive.L2'}]).drive.crossed).toBe(true);
 });
 it('does not fabricate mains voltage with no source or an isolated source',()=>{
  expect(readPhaseMeter(null).status).toBe('isolated');
  expect(readPhaseMeter(threePhaseConnections(parts,wires).drive,false).lineToLine).toBeNull();
 });
});
