/** Offline-first visual factory layout authoring and deterministic educational device scan.
 * These abstractions are teaching models, not mechanical, electrical or safety-rated plant models.
 */
export const WORKCELL_FORMAT='plc-skills-workcell' as const;
export const WORKCELL_STORAGE_KEY='plc-skills-workcell-layout-v1';
export const WORKCELL_RECOVERY_KEY='plc-skills-workcell-layout-recovery-v1';
export type EquipmentKind='conveyor'|'tank'|'cylinder'|'pump'|'photoeye'|'control-panel'|'fence';
export const EQUIPMENT_KINDS:readonly EquipmentKind[]=['conveyor','tank','cylinder','pump','photoeye','control-panel','fence'];
export type Equipment={id:string;kind:EquipmentKind;label:string;tag:string;x:number;z:number;rotation:0|1|2|3};
export type WorkcellLayout={format:typeof WORKCELL_FORMAT;schemaVersion:1;name:string;equipment:Equipment[]};
export type DeviceScan={value:number;active:boolean};
export type WorkcellScan={timeMs:number;devices:Readonly<Record<string,DeviceScan>>};
export type WorkcellCommands=Readonly<Record<string,boolean>>;
export type WorkcellStorage={getItem(key:string):string|null;setItem(key:string,value:string):void};
const idPattern=/^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const tagPattern=/^[A-Z][A-Z0-9_]{0,23}$/;
const kinds=new Set<string>(EQUIPMENT_KINDS);
const plain=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(reason:string):never=>{throw new Error(reason);};
export const defaultLayout=():WorkcellLayout=>({
 format:WORKCELL_FORMAT,schemaVersion:1,name:'Commissioning workcell',
 equipment:[
  {id:'cv1',kind:'conveyor',label:'Main conveyor',tag:'CV1',x:-2,z:0,rotation:0},
  {id:'pe1',kind:'photoeye',label:'Entry photoeye',tag:'PE1',x:0,z:-2,rotation:0},
  {id:'cy1',kind:'cylinder',label:'Sort diverter',tag:'CY1',x:2,z:0,rotation:1},
  {id:'cp1',kind:'control-panel',label:'Control station',tag:'CP1',x:0,z:2,rotation:0}
 ]});
export function validateLayout(value:unknown):WorkcellLayout{
 if(!plain(value)||value.format!==WORKCELL_FORMAT||value.schemaVersion!==1||typeof value.name!=='string'||value.name.trim().length<1||value.name.length>60||!Array.isArray(value.equipment)||value.equipment.length>32)fail('Invalid scene header or capacity (max 32 devices)');
 const ids=new Set<string>(),tags=new Set<string>(),places=new Set<string>();
 const equipment:Equipment[]=[];
 for(const unknownDevice of value.equipment){
  if(!plain(unknownDevice))fail('Invalid equipment record');
  const {id,kind,label,tag,x,z,rotation}=unknownDevice;
  if(typeof id!=='string'||!idPattern.test(id)||typeof kind!=='string'||!kinds.has(kind)||typeof label!=='string'||label.trim().length<1||label.length>48||typeof tag!=='string'||!tagPattern.test(tag)||!Number.isInteger(x)||!Number.isInteger(z)||Number(x)<-6||Number(x)>6||Number(z)<-6||Number(z)>6||![0,1,2,3].includes(Number(rotation)))fail('Invalid equipment fields');
  if(ids.has(id)||tags.has(tag))fail('Equipment IDs and I/O tags must be unique');
  const slot=String(x)+':'+String(z);
  if(places.has(slot))fail('Equipment anchor positions must be unique');
  ids.add(id);tags.add(tag);places.add(slot);
  equipment.push({id,kind:kind as EquipmentKind,label,tag,x:x as number,z:z as number,rotation:rotation as 0|1|2|3});
 }
 return {format:WORKCELL_FORMAT,schemaVersion:1,name:value.name as string,equipment};
}
export function parseLayout(text:string):WorkcellLayout{
 if(typeof text!=='string'||text.length>40000)throw RangeError('Workcell layout must be at most 40 KB');
 let data:unknown;try{data=JSON.parse(text);}catch{throw new Error('Layout is not valid JSON');}
 return validateLayout(data);
}
export function serializeLayout(layout:WorkcellLayout):string{return JSON.stringify(validateLayout(layout),null,2);}
export function addEquipment(layout:WorkcellLayout,kind:EquipmentKind):WorkcellLayout{
 const valid=validateLayout(layout);
 if(!kinds.has(kind))throw new Error('Unknown equipment type');
 if(valid.equipment.length===32)throw new RangeError('Workcell is full (32 devices)');
 const occupied=new Set(valid.equipment.map(x=>x.x+':'+x.z));
 let slot:{x:number;z:number}|null=null;
 for(let z=-5;z<=5&&!slot;z++)for(let x=-5;x<=5&&!slot;x++)if(!occupied.has(x+':'+z))slot={x,z};
 if(!slot)throw new RangeError('No available grid position');
 let serial=1;
 while(valid.equipment.some(x=>x.id==='item'+serial||x.tag==='IO'+serial))serial++;
 const device:Equipment={id:'item'+serial,tag:'IO'+serial,label:kind.replace('-',' ')+' '+serial,kind,x:slot.x,z:slot.z,rotation:0};
 return {...valid,equipment:[...valid.equipment,device]};
}
export function updateEquipment(layout:WorkcellLayout,id:string,changes:Partial<Pick<Equipment,'label'|'tag'|'x'|'z'|'rotation'>>):WorkcellLayout{
 const valid=validateLayout(layout);
 if(!valid.equipment.some(item=>item.id===id))throw new Error('Equipment not found');
 const equipment=valid.equipment.map(item=>item.id===id?{...item,...changes}:item);
 return validateLayout({...valid,equipment});
}
export function removeEquipment(layout:WorkcellLayout,id:string):WorkcellLayout{
 const valid=validateLayout(layout);
 return validateLayout({...valid,equipment:valid.equipment.filter(item=>item.id!==id)});
}
export function moveEquipment(layout:WorkcellLayout,id:string,dx:number,dz:number):WorkcellLayout{
 if(!Number.isInteger(dx)||!Number.isInteger(dz)||Math.abs(dx)>1||Math.abs(dz)>1)throw new RangeError('Movement must be one grid step');
 const obj=layout.equipment.find(x=>x.id===id);if(!obj)throw new Error('Equipment not found');
 return updateEquipment(layout,id,{x:obj.x+dx,z:obj.z+dz});
}
export function rotateEquipment(layout:WorkcellLayout,id:string):WorkcellLayout{
 const obj=layout.equipment.find(x=>x.id===id);if(!obj)throw new Error('Equipment not found');
 return updateEquipment(layout,id,{rotation:((obj.rotation+1)%4) as 0|1|2|3});
}
export function initialScan():WorkcellScan{return {timeMs:0,devices:{}};}
export function stepWorkcell(layout:WorkcellLayout,previous:WorkcellScan,commands:WorkcellCommands,deltaMs=100):WorkcellScan{
 const valid=validateLayout(layout);
 if(!Number.isSafeInteger(deltaMs)||deltaMs<10||deltaMs>1000)throw new RangeError('Invalid scan interval');
 if(!previous||!Number.isSafeInteger(previous.timeMs)||previous.timeMs<0||!plain(previous.devices))throw new TypeError('Invalid scan state');
 if(previous.timeMs+deltaMs>Number.MAX_SAFE_INTEGER)throw RangeError('Scan clock overflow');
 const devices:Record<string,DeviceScan>={};
 for(const item of valid.equipment){
  const old=previous.devices[item.id];
  const oldValue=old&&Number.isFinite(old.value)?Math.min(1,Math.max(0,old.value)):0;
  const active=commands[item.id]===true;
  let value=oldValue;
  if(item.kind==='conveyor')value=(value+(active?deltaMs/1800:0))%1; // normalized belt phase
  else if(item.kind==='tank')value=Math.min(1,Math.max(0,value+(active?deltaMs/20000:-deltaMs/60000))); // bounded teaching level
  else if(item.kind==='cylinder')value=Math.min(1,Math.max(0,value+(active?deltaMs/1500:-deltaMs/1200))); // end-stop stroke
  else if(item.kind==='pump'||item.kind==='photoeye'||item.kind==='control-panel')value=active?1:0;
  else value=0;
  devices[item.id]={value:Math.round(value*1000000)/1000000,active:active&&item.kind!=='fence'};
 }
 return {timeMs:previous.timeMs+deltaMs,devices};
}
export function deviceSignals(layout:WorkcellLayout,scan:WorkcellScan):Readonly<Record<string,boolean|number>>{
 const valid=validateLayout(layout);const result:Record<string,boolean|number>={};
 for(const item of valid.equipment){
  const state=scan.devices[item.id]??{value:0,active:false};
  result[item.tag+'_ACTIVE']=state.active;
  if(item.kind==='cylinder'){result[item.tag+'_EXTENDED']=state.value>=0.999;result[item.tag+'_RETRACTED']=state.value<=0.001;}
  if(item.kind==='tank')result[item.tag+'_LEVEL_PERCENT']=Math.round(state.value*1000)/10;
  if(item.kind==='conveyor')result[item.tag+'_BELT_PHASE']=Math.round(state.value*1000)/1000;
 }
 return result;
}
/** Refuse to overwrite damaged data; back up last valid scene before replacing. */
export function persistLayout(store:WorkcellStorage,layout:WorkcellLayout):void{
 const text=serializeLayout(layout);
 const existing=store.getItem(WORKCELL_STORAGE_KEY);
 if(existing!==null){parseLayout(existing);store.setItem(WORKCELL_RECOVERY_KEY,existing);}
 store.setItem(WORKCELL_STORAGE_KEY,text);
}
export function readLayout(store:Pick<WorkcellStorage,'getItem'>):{layout:WorkcellLayout;source:'primary'|'recovery'|'default';warning:string|null}{
 let damaged=false;
 for(const [key,source] of [[WORKCELL_STORAGE_KEY,'primary'],[WORKCELL_RECOVERY_KEY,'recovery']] as const){
  let content:string|null;
  try{content=store.getItem(key);}catch{return {layout:defaultLayout(),source:'default',warning:'Browser storage is unavailable; export your layout before closing this page.'};}
  if(content!==null)try{return {layout:parseLayout(content),source,warning:source==='recovery'?'Primary layout is invalid; using read-only last valid recovery. Export a copy before restoring.':null};}catch{damaged=true;}
 }
 return {layout:defaultLayout(),source:'default',warning:damaged?'Local layout is damaged. Preserved stored bytes; starting an unsaved default scene.':null};
}
