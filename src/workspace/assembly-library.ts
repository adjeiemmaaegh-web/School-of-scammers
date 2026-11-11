/**
 * Offline reusable PLC workcell assemblies. No network or authentication.
 * Store selected device fragments, internal wires, per-device parameters and
 * PLC programs; actual insertion goes through the existing worker edit gate.
 */
import type {WorkspaceFragment} from './types';
export type SavedAssembly={id:number;name:string;fragment:WorkspaceFragment};
export const ASSEMBLY_STORAGE_KEY='plc-sandbox-local-assemblies-v1';
export const MAX_SAVED_ASSEMBLIES=12;
export const MAX_ASSEMBLY_BYTES=120000;
export const MAX_LIBRARY_BYTES=450000;
export const normalizedAssemblyName=(value:string):string=>value.trim().replace(/\s+/g,' ');
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function validFragment(value:unknown):value is WorkspaceFragment{
 if(!object(value)||value.version!==1||
   !Array.isArray(value.components)||!Array.isArray(value.wires)||
   value.components.length<1||value.components.length>60||
   value.wires.length>250)return false;
 const components=new Set<string>();
 for(const c of value.components){
  if(!object(c)||typeof c.id!=='string'||!c.id||
    typeof c.kind!=='string'||!Number.isFinite(c.x)||!Number.isFinite(c.y)||
    typeof c.pressed!=='boolean'||components.has(c.id))return false;
  components.add(c.id);
 }
 for(const w of value.wires){
  if(!object(w)||typeof w.id!=='string'||typeof w.from!=='string'||
    typeof w.to!=='string'||!components.has(w.from.split('.')[0])||
    !components.has(w.to.split('.')[0]))return false;
 }
 return true;
}
export function validateAssemblyLibrary(items:unknown):SavedAssembly[]{
 if(!Array.isArray(items)||items.length>MAX_SAVED_ASSEMBLIES)
  throw new Error('Invalid or oversized local assembly library');
 const usedIds=new Set<number>(),usedNames=new Set<string>();
 return items.map(value=>{
  if(!object(value)||!Number.isSafeInteger(value.id)||
     (value.id as number)<1||usedIds.has(value.id as number)||
     typeof value.name!=='string'||normalizedAssemblyName(value.name)!==value.name||
     value.name.length<1||value.name.length>48||
     usedNames.has(value.name.toLowerCase())||!validFragment(value.fragment))
    throw new Error('Invalid saved factory assembly');
  const serialized=JSON.stringify(value.fragment);
  if(serialized.length>MAX_ASSEMBLY_BYTES)throw new Error('Saved assembly is too large');
  usedIds.add(value.id as number);usedNames.add(value.name.toLowerCase());
  return value as SavedAssembly;
 });
}
export function readAssemblyLibrary(raw:string|null):SavedAssembly[]{
 if(raw===null)return [];
 if(raw.length>MAX_LIBRARY_BYTES)throw new Error('Local assembly library exceeds safety limit');
 let decoded:unknown;
 try{decoded=JSON.parse(raw);}
 catch{throw new Error('Local assembly library contains damaged JSON');}
 return validateAssemblyLibrary(decoded);
}
export function encodeAssemblyLibrary(entries:readonly SavedAssembly[]):string{
 const out=JSON.stringify(validateAssemblyLibrary([...entries]));
 if(out.length>MAX_LIBRARY_BYTES)throw new Error('Local assembly library is full');
 return out;
}
export function saveAssembly(
 entries:readonly SavedAssembly[],name:string,fragment:WorkspaceFragment,
):SavedAssembly[]{
 const title=normalizedAssemblyName(name);
 if(!title||title.length>48)throw new Error('Assembly name must contain 1–48 characters');
 if(entries.length>=MAX_SAVED_ASSEMBLIES)throw new Error('At most 12 saved assemblies');
 if(entries.some(e=>e.name.toLowerCase()===title.toLowerCase()))
  throw new Error('An assembly already uses that name');
 if(!validFragment(fragment))throw new Error('Select valid devices to save an assembly');
 const copy=JSON.parse(JSON.stringify(fragment)) as WorkspaceFragment;
 if(JSON.stringify(copy).length>MAX_ASSEMBLY_BYTES)throw new Error('Assembly is too large for local storage');
 const id=Math.max(0,...entries.map(e=>e.id))+1;
 const result=[...entries,{id,name:title,fragment:copy}];
 validateAssemblyLibrary(result);
 return result;
}
export function deleteAssembly(entries:readonly SavedAssembly[],id:number):SavedAssembly[]{
 return entries.filter(e=>e.id!==id);
}
