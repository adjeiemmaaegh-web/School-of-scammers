import {describe,it,expect} from 'vitest';
import {
 defaultLayout,validateLayout,parseLayout,serializeLayout,addEquipment,updateEquipment,
 moveEquipment,rotateEquipment,removeEquipment,initialScan,stepWorkcell,deviceSignals,
 persistLayout,readLayout,restoreLayoutFromRecovery,WORKCELL_STORAGE_KEY,WORKCELL_RECOVERY_KEY,WORKCELL_DAMAGED_KEY
} from '../src/engineering/workcell-layout';
const memory=()=>{const m=new Map<string,string>();return {
 getItem:(k:string)=>m.get(k)??null,
 setItem:(k:string,v:string)=>{m.set(k,v);},
 map:m
};};
describe('offline factory workcell authoring',()=>{
 it('validates a baseline scene and round-trips without extra properties',()=>{
  const d=defaultLayout();expect(validateLayout(d)).toEqual(d);
  const encoded=serializeLayout({...d,evil:'ignored'} as typeof d);
  expect(parseLayout(encoded)).toEqual(d);
  expect(encoded).not.toContain('evil');
 });
 it('adds a unique device and maps a unique IO base tag',()=>{
  const l=addEquipment(defaultLayout(),'pump');
  expect(l.equipment).toHaveLength(5);
  expect(new Set(l.equipment.map(x=>x.tag)).size).toBe(l.equipment.length);
  expect(l.equipment.at(-1)?.kind).toBe('pump');
 });
 it('rejects overlapping positions, duplicate IDs and duplicate tags',()=>{
  const d=defaultLayout();
  expect(()=>validateLayout({...d,equipment:[...d.equipment,{...d.equipment[0],id:'other',tag:'OTHER'}]})).toThrow('positions');
  expect(()=>validateLayout({...d,equipment:[...d.equipment,{...d.equipment[0],tag:'OTHER',x:5,z:5}]})).toThrow('unique');
  expect(()=>validateLayout({...d,equipment:[...d.equipment,{...d.equipment[0],id:'other',x:5,z:5}]})).toThrow('unique');
 });
 it('moves, rotates and deletes without mutating the original',()=>{
  const d=defaultLayout();
  const moved=moveEquipment(d,'cv1',0,1);
  expect(moved.equipment[0].z).toBe(1);expect(d.equipment[0].z).toBe(0);
  const rotated=rotateEquipment(moved,'cv1');expect(rotated.equipment[0].rotation).toBe(1);
  const removed=removeEquipment(rotated,'cv1');expect(removed.equipment.some(x=>x.id==='cv1')).toBe(false);
 });
 it('blocks out-of-grid motion and invalid movement sizes',()=>{
  const d=defaultLayout();
  expect(()=>moveEquipment(d,'cv1',2,0)).toThrow();
  expect(()=>moveEquipment(d,'cv1',0.5,0)).toThrow();
  const e=updateEquipment(d,'cv1',{x:6,z:6});
  expect(()=>moveEquipment(e,'cv1',1,0)).toThrow();
 });
 it('rejects potentially hostile or oversized scene imports',()=>{
  expect(()=>parseLayout('{bad JSON')).toThrow('JSON');
  expect(()=>parseLayout('x'.repeat(40001))).toThrow('40 KB');
  const d=defaultLayout();
  expect(()=>validateLayout({...d,equipment:[{...d.equipment[0],label:''}]})).toThrow();
  expect(()=>validateLayout({...d,equipment:[{...d.equipment[0],tag:'BAD.TAG'}]})).toThrow();
  expect(()=>validateLayout({...d,equipment:Array.from({length:33},(_,i)=>({...d.equipment[0],id:'item'+i,tag:'TAG'+i,x:i%13-6,z:Math.floor(i/13)-6}))})).toThrow('capacity');
 });
 it('uses known fields only and rejects future schema',()=>{
  const d=defaultLayout();expect(()=>validateLayout({...d,schemaVersion:2})).toThrow();
  const crafted={...d,equipment:[{...d.equipment[0],__extra:'arbitrary'}]};
  expect(validateLayout(crafted).equipment[0]).not.toHaveProperty('__extra');
 });
 it('evolves a deterministic conveyor belt and cylinder in bounded scan time',()=>{
  const layout=defaultLayout(),cmd={cv1:true,cy1:true};
  const first=stepWorkcell(layout,initialScan(),cmd,100);
  const second=stepWorkcell(layout,first,cmd,100);
  expect(second.timeMs).toBe(200);
  expect(second.devices.cv1.value).toBeGreaterThan(first.devices.cv1.value);
  expect(second.devices.cy1.value).toBeGreaterThan(first.devices.cy1.value);
  expect(stepWorkcell(layout,first,cmd,100)).toEqual(second);
 });
 it('retains motor control isolation from mutable input command state',()=>{
  const layout=defaultLayout(),cmd={cy1:true};
  const a=stepWorkcell(layout,initialScan(),cmd,100);
  const b=stepWorkcell(layout,a,{cy1:false},100);
  expect(b.devices.cy1.value).toBeLessThan(a.devices.cy1.value);
  expect(b.devices.cy1.active).toBe(false);
  expect(cmd.cy1).toBe(true);
 });
 it('maps meaningful feedback for tank, cylinder and conveyor',()=>{
  let l=defaultLayout();l=addEquipment(l,'tank');const t=l.equipment.at(-1)!;
  const scan=stepWorkcell(l,initialScan(),{cy1:true,cv1:true,[t.id]:true},100);
  const tags=deviceSignals(l,scan);
  expect(tags.CV1_ACTIVE).toBe(true);
  expect(typeof tags.CV1_BELT_PHASE).toBe('number');
  expect(typeof tags.CY1_EXTENDED).toBe('boolean');
  expect(tags[t.tag+'_LEVEL_PERCENT']).toBeGreaterThan(0);
 });
 it('rejects corrupt scan state and invalid scan duration',()=>{
  const d=defaultLayout();
  expect(()=>stepWorkcell(d,initialScan(),{},1)).toThrow();
  expect(()=>stepWorkcell(d,{timeMs:-10,devices:{}},{},100)).toThrow();
  expect(()=>stepWorkcell(d,{timeMs:Number.MAX_SAFE_INTEGER,devices:{}},{},100)).toThrow();
 });
 it('saves revisions while preserving valid previous state for recovery',()=>{
  const store=memory(),d=defaultLayout();persistLayout(store,d);
  const next=addEquipment(d,'pump');persistLayout(store,next);
  expect(readLayout(store).layout).toEqual(next);
  expect(parseLayout(store.getItem(WORKCELL_RECOVERY_KEY)!)).toEqual(d);
 });
 it('refuses to overwrite unreadable saved data',()=>{
  const store=memory();store.setItem(WORKCELL_STORAGE_KEY,'broken');
  expect(()=>persistLayout(store,defaultLayout())).toThrow();
  expect(store.getItem(WORKCELL_STORAGE_KEY)).toBe('broken');
 });
 it('reads backup without modifying damaged source data',()=>{
  const store=memory(),d=defaultLayout();
  store.setItem(WORKCELL_STORAGE_KEY,'broken');
  store.setItem(WORKCELL_RECOVERY_KEY,serializeLayout(d));
  const snapshot=readLayout(store);
  expect(snapshot.source).toBe('recovery');expect(snapshot.layout).toEqual(d);
  expect(store.getItem(WORKCELL_STORAGE_KEY)).toBe('broken');
 });
 it('restores valid recovery while retaining exact damaged primary bytes',()=>{
  const store=memory(),backup=addEquipment(defaultLayout(),'pump');
  store.setItem(WORKCELL_STORAGE_KEY,'unreadable primitive text');
  store.setItem(WORKCELL_RECOVERY_KEY,serializeLayout(backup));
  const restored=restoreLayoutFromRecovery(store);
  expect(restored).toEqual(backup);
  expect(readLayout(store).source).toBe('primary');
  expect(store.getItem(WORKCELL_DAMAGED_KEY)).toBe('unreadable primitive text');
 });
 it('refuses recovery over a valid primary and leaves both copies unchanged',()=>{
  const store=memory(),primary=serializeLayout(defaultLayout());
  store.setItem(WORKCELL_STORAGE_KEY,primary);
  store.setItem(WORKCELL_RECOVERY_KEY,serializeLayout(addEquipment(defaultLayout(),'pump')));
  expect(()=>restoreLayoutFromRecovery(store)).toThrow('valid');
  expect(store.getItem(WORKCELL_STORAGE_KEY)).toBe(primary);
  expect(store.getItem(WORKCELL_DAMAGED_KEY)).toBeNull();
 });
 it('handles browser storage denial without crashing a lab',()=>{
  const store={getItem:(_key:string):string|null=>{throw new Error('storage blocked');}};
  const result=readLayout(store);
  expect(result.source).toBe('default');
  expect(result.warning).toContain('unavailable');
 });
});
