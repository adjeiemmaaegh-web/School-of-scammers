import {describe,it,expect} from 'vitest';
import {DEFAULT_PNEUMATIC_INPUT,initialPneumatic,stepPneumatic,pneumaticSample,evaluateCylinderCycle,pneumaticCsv} from '../src/engineering/pneumatic-cylinder';
const advance=(state:ReturnType<typeof initialPneumatic>,command:'extend'|'retract'|'neutral',scans:number,extra:Partial<typeof DEFAULT_PNEUMATIC_INPUT>={})=>{
 let s=state;const rows=[];
 for(let i=0;i<scans;i++){s=stepPneumatic(s,{...DEFAULT_PNEUMATIC_INPUT,...extra,command},100);rows.push(pneumaticSample(s));}
 return {s,rows};
};
describe('pneumatic cylinder teaching model',()=>{
 it('reaches extended and retracted end switches with command exclusivity',()=>{
  const a=advance(initialPneumatic(),'extend',13);expect(a.s.extendLimit).toBe(true);expect(a.s.retractLimit).toBe(false);
  const b=advance(a.s,'retract',11);expect(b.s.retractLimit).toBe(true);expect(b.s.extendLimit).toBe(false);
  expect(evaluateCylinderCycle([...a.rows,...b.rows]).passed).toBe(true);
 });
 it('holds a spring-centred valve with no movement',()=>{
  const a=advance(initialPneumatic(),'extend',4);
  const b=advance(a.s,'neutral',8);expect(b.s.position).toBe(a.s.position);
  expect(b.s.extendCoil||b.s.retractCoil).toBe(false);
 });
 it('de-energizes both valve coils on guard open or E-stop',()=>{
  for(const input of [{guardClosed:false},{emergencyStop:true}]){
   const s=stepPneumatic(initialPneumatic(),{...DEFAULT_PNEUMATIC_INPUT,...input,command:'extend'});
   expect(s.extendCoil).toBe(false);expect(s.retractCoil).toBe(false);expect(s.position).toBe(0);expect(s.alarm).toContain('INTERLOCK');
  }
 });
 it('holds at no air pressure and reports the loss',()=>{
  const s=stepPneumatic(initialPneumatic(),{...DEFAULT_PNEUMATIC_INPUT,airOn:false,command:'extend'});
  expect(s.position).toBe(0);expect(s.pressureBar).toBe(0);expect(s.alarm).toContain('AIR PRESSURE');
 });
 it('catches a jam through bounded travel timeout without fabricating end feedback',()=>{
  const a=advance(initialPneumatic(),'extend',27,{fault:'rod-jammed'});
  expect(a.s.position).toBe(0);expect(a.s.extendLimit).toBe(false);expect(a.s.alarm).toContain('TIMEOUT');
  expect(evaluateCylinderCycle(a.rows).passed).toBe(false);
 });
 it('distinguishes sensor failure from physical cylinder travel',()=>{
  const a=advance(initialPneumatic(),'extend',13,{fault:'extend-sensor-stuck'});
  expect(a.s.position).toBe(1);expect(a.s.extendLimit).toBe(false);
 });
 it('rejects invalid inputs and absurd simulation scan durations',()=>{
  expect(()=>stepPneumatic(initialPneumatic(),{...DEFAULT_PNEUMATIC_INPUT,command:'bad' as 'extend'})).toThrow();
  expect(()=>stepPneumatic(initialPneumatic(),DEFAULT_PNEUMATIC_INPUT,0)).toThrow();
  expect(()=>stepPneumatic({...initialPneumatic(),position:2},DEFAULT_PNEUMATIC_INPUT)).toThrow();
 });
 it('exports deterministic machine state evidence',()=>{
  const rows=advance(initialPneumatic(),'extend',2).rows;
  const csv=pneumaticCsv(rows);
  expect(csv).toContain('time_ms');expect(csv).toContain('100');expect(csv).toContain('200');
 });
});
