import {describe,it,expect} from 'vitest';
import {
 DC_KEY,DC_RECOVERY_KEY,DC_DAMAGED_KEY,circuitPreset,analyzeCircuit,measureDcVoltage,measureDcContinuity,
 validateCircuit,parseCircuit,serializeCircuit,addCircuitPart,updateCircuitPart,removeCircuitPart,
 addCircuitNode,removeCircuitNode,dcReadingsCsv,persistDc,readDc,restoreDc,type DcCircuit
} from '../src/engineering/dc-network';
const near=(actual:number|null,expected:number)=>{expect(actual).not.toBeNull();expect(actual!).toBeCloseTo(expected,7);};
const memory=()=>{const map=new Map<string,string>();return {map,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)}};};
describe('bounded passive DC Kirchhoff solver',()=>{
 it('solves a 1k/1k divider and 12mA branch currents',()=>{
  const c=circuitPreset('divider'),a=analyzeCircuit(c);
  near(a.volts.N1,12);near(a.volts.P24,24);near(a.volts.GND,0);
  near(a.sourceCurrentA,.012);near(a.sourcePowerW,.288);
  near(a.readings[0].currentA,.012);near(a.readings[1].currentA,.012);
  near(a.readings[0].powerW,.144);near(measureDcVoltage(a,'N1','GND'),12);
  near(measureDcVoltage(a,'GND','N1'),-12);
  expect(a.shortCircuit).toBe(false);
 });
 it('sums parallel loads correctly',()=>{
  const a=analyzeCircuit(circuitPreset('parallel'));
  near(a.sourceCurrentA,.036);near(a.sourcePowerW,.864);
  near(a.readings[0].currentA,.024);near(a.readings[1].currentA,.012);
 });
 it('balances a bridge with equal ratios and zero bridge current',()=>{
  const a=analyzeCircuit(circuitPreset('bridge'));
  near(a.volts.N1,12);near(a.volts.N2,12);
  near(a.readings[4].currentA,0);near(a.sourceCurrentA,.018);
 });
 it('solves an unbalanced bridge with KCL, not simple graph reachability',()=>{
  let c=circuitPreset('bridge');
  c=updateCircuitPart(c,'R2',{ohms:2000});
  const a=analyzeCircuit(c);
  expect(a.volts.N1).toBeGreaterThan(a.volts.N2!);
  expect(a.volts.N1).toBeLessThan(24);
  expect(a.readings[4].currentA).toBeGreaterThan(0);
 });
 it('reports an open return as zero source current without invented load flow',()=>{
  const a=analyzeCircuit(circuitPreset('open'));
  near(a.volts.N1,24);near(a.sourceCurrentA,0);near(a.readings[0].currentA,0);
  expect(a.diagnostics.some(x=>x.includes('No current'))).toBe(true);
 });
 it('flags a direct ideal source short with unknown current instead of Infinity',()=>{
  const a=analyzeCircuit(circuitPreset('short'));
  expect(a.shortCircuit).toBe(true);expect(a.sourceCurrentA).toBeNull();
  expect(a.overcurrent).toBe(true);
  expect(a.diagnostics.join(' ')).toContain('SHORT');
 });
 it('treats a closed switch as an ideal conductor, an open switch as isolation',()=>{
  let c=circuitPreset('divider');
  c=addCircuitPart(c,{id:'S1',kind:'switch',a:'N1',b:'N2',closed:true});
  c=updateCircuitPart(c,'R2',{a:'N2'});
  near(analyzeCircuit(c).volts.N1,12);
  near(analyzeCircuit(c).volts.N2,12);
  expect(measureDcContinuity(c,'N1','N2')).toBe(true);
  const opened=updateCircuitPart(c,'S1',{closed:false});
  const result=analyzeCircuit(opened);
  near(result.volts.N1,24);near(result.volts.N2,0);
  near(result.sourceCurrentA,0);
  expect(measureDcContinuity(opened,'N1','N2')).toBe(false);
 });
 it('treats a wire as zero drop and does not count resistive paths as continuity',()=>{
  const c=addCircuitPart(circuitPreset('open'),{id:'W1',kind:'wire',a:'P24',b:'N2'});
  const a=analyzeCircuit(c);
  near(a.volts.N2,24);expect(measureDcContinuity(c,'P24','N2')).toBe(true);
  expect(measureDcContinuity(c,'P24','N1')).toBe(false);
 });
 it('returns undefined voltage for a fully unreferenced resistor island',()=>{
  let c=circuitPreset('divider');
  c=addCircuitPart(c,{id:'R3',kind:'resistor',a:'N2',b:'N3',ohms:5000});
  const a=analyzeCircuit(c);
  expect(a.volts.N2).toBeNull();expect(a.volts.N3).toBeNull();
  expect(a.readings[2].currentA).toBeNull();
  expect(measureDcVoltage(a,'N2','GND')).toBeNull();
  expect(a.diagnostics.some(x=>x.includes('Floating'))).toBe(true);
 });
 it('detects source shorts through multiple closed switches and wires',()=>{
  let c=circuitPreset('open');
  c=addCircuitPart(c,{id:'W1',kind:'wire',a:'P24',b:'N2'});
  c=addCircuitPart(c,{id:'S1',kind:'switch',a:'N2',b:'GND',closed:true});
  expect(analyzeCircuit(c).shortCircuit).toBe(true);
  expect(analyzeCircuit(updateCircuitPart(c,'S1',{closed:false})).shortCircuit).toBe(false);
 });
 it('reports overcurrent for a 1-ohm load but does not simulate fuse timing',()=>{
  const c=addCircuitPart(circuitPreset('parallel'),{id:'R3',kind:'resistor',a:'P24',b:'GND',ohms:1});
  const a=analyzeCircuit(c);
  expect(a.overcurrent).toBe(true);expect(a.shortCircuit).toBe(false);
  expect(a.diagnostics.join(' ')).toContain('OVERCURRENT');
 });
 it('supports opposite resistor terminal ordering with signed branch current',()=>{
  const c=circuitPreset('divider');
  const r=updateCircuitPart(c,'R2',{a:'GND',b:'N1'});
  near(analyzeCircuit(r).readings[1].currentA,-.012);
  near(analyzeCircuit(r).sourceCurrentA,.012);
 });
 it('remains deterministic under repeat solves and never mutates its netlist',()=>{
  const c=circuitPreset('bridge'),before=JSON.stringify(c);
  expect(analyzeCircuit(c)).toEqual(analyzeCircuit(c));
  expect(JSON.stringify(c)).toBe(before);
 });
 it('validates node limits, component capacity, bounds and IDs',()=>{
  let c=circuitPreset();
  expect(()=>addCircuitPart(c,{id:'bad',kind:'resistor',a:'P24',b:'GND',ohms:0})).toThrow();
  expect(()=>addCircuitPart(c,{id:'bad',kind:'resistor',a:'P24',b:'GND',ohms:1e9})).toThrow();
  expect(()=>addCircuitPart(c,{id:'R1',kind:'resistor',a:'P24',b:'GND',ohms:1000})).toThrow();
  expect(()=>addCircuitPart(c,{id:'W1',kind:'wire',a:'P24',b:'P24'})).toThrow();
  expect(()=>addCircuitPart(c,{id:'W1',kind:'wire',a:'P24',b:'UNKNOWN'})).toThrow();
  expect(()=>validateCircuit({...c,schemaVersion:2})).toThrow();
  expect(()=>parseCircuit('bad json')).toThrow();
  expect(()=>parseCircuit('x'.repeat(30001))).toThrow('30 KB');
  c=addCircuitNode(c);
  expect(c.nodes).toContain('N4');
  c=removeCircuitNode(c,'N4');
  expect(c.nodes).not.toContain('N4');
  expect(()=>removeCircuitNode(c,'P24')).toThrow();
 });
 it('roundtrips a valid circuit and strips untrusted fields',()=>{
  const c=circuitPreset('bridge');
  const extra={...c,surprise:'untrusted',parts:[{...c.parts[0],evil:true},...c.parts.slice(1)]};
  const v=validateCircuit(extra);
  expect(v).toEqual(c);
  const result=parseCircuit(serializeCircuit(v));expect(result).toEqual(c);
  expect(serializeCircuit(v)).not.toContain('evil');
 });
 it('refuses unknown terminals during virtual meter use',()=>{
  const a=analyzeCircuit(circuitPreset());
  expect(()=>measureDcVoltage(a,'BAD','GND')).toThrow();
  expect(()=>measureDcContinuity(circuitPreset(),'P24','BAD')).toThrow();
 });
 it('exports branch voltage/current/power with no injection into CSV',()=>{
  const c=circuitPreset('divider'),report=analyzeCircuit(c);
  const csv=dcReadingsCsv(c,report);
  expect(csv).toContain('current_A');
  expect(csv).toContain('0.012');
  expect(csv.split('\r\n')).toHaveLength(3);
 });
 it('preserves previous valid project when saving a new circuit',()=>{
  const store=memory(),old=circuitPreset(),next=circuitPreset('parallel');
  persistDc(store,old);persistDc(store,next);
  expect(readDc(store).source).toBe('primary');
  expect(parseCircuit(store.getItem(DC_RECOVERY_KEY)!)).toEqual(old);
 });
 it('refuses to overwrite an unreadable primary and loads recovery read-only',()=>{
  const store=memory(),old=circuitPreset();
  store.setItem(DC_KEY,'bad-json');store.setItem(DC_RECOVERY_KEY,serializeCircuit(old));
  expect(()=>persistDc(store,circuitPreset('bridge'))).toThrow();
  expect(readDc(store).source).toBe('recovery');
  expect(store.getItem(DC_KEY)).toBe('bad-json');
 });
 it('restores only with explicit action, preserves damaged bytes',()=>{
  const store=memory(),old=circuitPreset('parallel');
  store.setItem(DC_KEY,'bad-json');store.setItem(DC_RECOVERY_KEY,serializeCircuit(old));
  expect(restoreDc(store)).toEqual(old);
  expect(store.getItem(DC_DAMAGED_KEY)).toBe('bad-json');
  expect(readDc(store).source).toBe('primary');
 });
 it('does not overwrite a healthy primary during recovery',()=>{
  const store=memory();persistDc(store,circuitPreset());
  store.setItem(DC_RECOVERY_KEY,serializeCircuit(circuitPreset('bridge')));
  expect(()=>restoreDc(store)).toThrow('already valid');
  expect(readDc(store).circuit).toEqual(circuitPreset());
 });
 it('returns a default when local storage is denied',()=>{
  const x=readDc({getItem:()=>{throw Error('blocked')}});
  expect(x.source).toBe('default');
  expect(x.warning).toBeTruthy();
 });
 it('preserves immutability when editing or removing components',()=>{
  const original=circuitPreset('divider');
  const changed=updateCircuitPart(original,'R1',{ohms:1500});
  const removed=removeCircuitPart(changed,'R2');
  expect(original.parts[0].ohms).toBe(1000);
  expect(changed.parts[0].ohms).toBe(1500);
  expect(removed.parts).toHaveLength(1);
  expect(()=>updateCircuitPart(original,'UNKNOWN',{ohms:5})).toThrow();
 });
});
