/** Offline project library. Data stays in this browser profile; export backups regularly. */
import {parseProject,serializeProject,type EngineeringProject} from './project-file';
export const LIBRARY_KEY='plc-skills-lab:engineering-project-library:v1';
export interface SavedProject {id:string;revision:number;createdAt:string;updatedAt:string;project:EngineeringProject}
export interface ProjectLibrary {format:'plc-skills-lab-library';schemaVersion:1;items:SavedProject[]}
export const emptyLibrary=():ProjectLibrary=>({format:'plc-skills-lab-library',schemaVersion:1,items:[]});
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const iso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);
export function validateLibrary(input:unknown):ProjectLibrary {
 if(!isRecord(input)||input.format!=='plc-skills-lab-library'||input.schemaVersion!==1||!Array.isArray(input.items)||input.items.length>50)throw Error('Invalid library format or capacity');
 const ids=new Set<string>();const items:SavedProject[]=[];
 for(const raw of input.items){
  if(!isRecord(raw)||!validId(raw.id)||!Number.isSafeInteger(raw.revision)||Number(raw.revision)<1||!iso(raw.createdAt)||!iso(raw.updatedAt)||Date.parse(raw.updatedAt)<Date.parse(raw.createdAt)||ids.has(raw.id))throw Error('Invalid or duplicate saved project');
  ids.add(raw.id);items.push({id:raw.id,revision:raw.revision as number,createdAt:raw.createdAt,updatedAt:raw.updatedAt,project:parseProject(JSON.stringify(raw.project))});
 }
 return {format:'plc-skills-lab-library',schemaVersion:1,items};
}
export function parseLibrary(text:string):ProjectLibrary {if(text.length>12_000_000)throw Error('Library backup exceeds 12 MB');return validateLibrary(JSON.parse(text))}
export function serializeLibrary(value:ProjectLibrary):string{return JSON.stringify(validateLibrary(value),null,2)}
export function saveProject(library:ProjectLibrary,project:EngineeringProject,now:string,id:string,expectedRevision?:number):ProjectLibrary {
 const safe=validateLibrary(library),validated=parseProject(serializeProject(project));
 if(!validId(id)||!iso(now))throw Error('Invalid project identifier or date');
 const found=safe.items.find(x=>x.id===id);
 if(found){
  if(expectedRevision!==found.revision)throw Error('Project changed since it was opened; reload before overwriting');
  if(Date.parse(now)<Date.parse(found.updatedAt))throw Error('Save timestamp predates last revision');
  return {...safe,items:safe.items.map(x=>x.id===id?{...x,revision:x.revision+1,updatedAt:now,project:validated}:x)};
 }
 if(expectedRevision!==undefined)throw Error('Cannot overwrite a missing project');
 if(safe.items.length>=50)throw Error('Library is full (50 projects)');
 return {...safe,items:[...safe.items,{id,revision:1,createdAt:now,updatedAt:now,project:validated}]};
}
export function removeProject(library:ProjectLibrary,id:string,expectedRevision:number):ProjectLibrary {
 const safe=validateLibrary(library),found=safe.items.find(x=>x.id===id);
 if(!found||found.revision!==expectedRevision)throw Error('Project changed or no longer exists');
 return {...safe,items:safe.items.filter(x=>x.id!==id)};
}
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void}
export function loadLibrary(storage:StorageLike):ProjectLibrary {const value=storage.getItem(LIBRARY_KEY);return value===null?emptyLibrary():parseLibrary(value)}
/** Write once, without deleting the previous value first. Storage quota failures propagate. */
export function persistLibrary(storage:StorageLike,library:ProjectLibrary):void {storage.setItem(LIBRARY_KEY,serializeLibrary(library))}

/** A second local copy protects against a damaged primary value, not disk loss. */
export const LIBRARY_RECOVERY_KEY='plc-skills-lab:engineering-project-library:recovery:v1';
export const LIBRARY_DAMAGED_KEY='plc-skills-lab:engineering-project-library:damaged:v1';
export type LibraryReadResult={library:ProjectLibrary;source:'primary'|'recovery'|'empty';warning?:string};
export function readLibraryWithRecovery(storage:StorageLike):LibraryReadResult {
 const raw=storage.getItem(LIBRARY_KEY);
 if(raw===null)return {library:emptyLibrary(),source:'empty'};
 try{return {library:parseLibrary(raw),source:'primary'}}catch(primaryError){
  const backup=storage.getItem(LIBRARY_RECOVERY_KEY);
  if(backup!==null){try{return {library:parseLibrary(backup),source:'recovery',warning:`Primary library is damaged (${String(primaryError)}). Recovery is read-only until explicitly restored.`}}catch{/* preserve both */}}
  throw Error(`Primary library is damaged and no valid recovery copy exists: ${String(primaryError)}`);
 }
}
/** Store last-known-good primary before replacing it; never silently repair corrupt data. */
export function persistLibrarySafely(storage:StorageLike,library:ProjectLibrary):void {
 const serialized=serializeLibrary(library);
 const existing=storage.getItem(LIBRARY_KEY);
 if(existing!==null){parseLibrary(existing);storage.setItem(LIBRARY_RECOVERY_KEY,existing)}
 storage.setItem(LIBRARY_KEY,serialized);
}
export function restoreLibraryFromRecovery(storage:StorageLike):ProjectLibrary {
 const primary=storage.getItem(LIBRARY_KEY);
 if(primary!==null){let valid=false;try{parseLibrary(primary);valid=true}catch{/* damaged primary */}if(valid)throw Error('Primary library is valid; recovery restoration is unnecessary')}
 const backup=storage.getItem(LIBRARY_RECOVERY_KEY);
 if(backup===null)throw Error('No recovery copy is available');
 const restored=parseLibrary(backup);
 if(primary!==null)storage.setItem(LIBRARY_DAMAGED_KEY,primary);
 storage.setItem(LIBRARY_KEY,serializeLibrary(restored));
 return restored;
}
export interface ProjectChangeSummary {nameChanged:boolean;ladderChanged:boolean;wiringChanged:boolean;partsBefore:number;partsAfter:number;wiresBefore:number;wiresAfter:number}
/** Semantic project comparison; intentionally excludes volatile simulation state. */
export function compareProjects(a:EngineeringProject,b:EngineeringProject):ProjectChangeSummary {
 const left=parseProject(serializeProject(a)),right=parseProject(serializeProject(b));
 return {nameChanged:left.name!==right.name,ladderChanged:JSON.stringify(left.program)!==JSON.stringify(right.program),wiringChanged:JSON.stringify(left.board)!==JSON.stringify(right.board),partsBefore:left.board.parts.length,partsAfter:right.board.parts.length,wiresBefore:left.board.wires.length,wiresAfter:right.board.wires.length};
}
