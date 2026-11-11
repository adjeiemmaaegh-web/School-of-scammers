import {useState} from 'react';
import type {ProjectFile,XY} from '../../sim/signals';
import type {GridStep,WorkspaceFragment} from '../../workspace/types';
import {makeFragment} from '../../workspace/clipboard';
import {clampPlacement} from '../../workspace/geometry';
import {rotateAssemblyFragment,type AssemblyTurns} from '../../workspace/assembly-transform';
import {composeAssemblyFragments} from '../../workspace/assembly-composition';
import {
 ASSEMBLY_STORAGE_KEY,readAssemblyLibrary,encodeAssemblyLibrary,
 saveAssembly,deleteAssembly,type SavedAssembly,
} from '../../workspace/assembly-library';

type Props={
 project:ProjectFile|null;selectedIds:readonly string[];
 editable:boolean;grid:GridStep;
 onInsert:(fragment:WorkspaceFragment,at:XY)=>void;
};
const persisted=():{entries:SavedAssembly[];error:string|null}=>{
 try{return {entries:readAssemblyLibrary(
  typeof localStorage==='undefined'?null:localStorage.getItem(ASSEMBLY_STORAGE_KEY)),
  error:null};}
 catch(e){return {entries:[],error:e instanceof Error?e.message:'Cannot read saved assemblies'};}
};
/** A browser-local assembly shelf, not a remote account or independent solver.
 * Every pasted assembly is still validated by the existing worker edit path.
 */
export function AssemblyLibrary({project,selectedIds,editable,grid,onInsert}:Props){
 const [initial]=useState(persisted);
 const [entries,setEntries]=useState<SavedAssembly[]>(initial.entries);
 const [error,setError]=useState<string|null>(initial.error);
 const [storageCorrupt,setStorageCorrupt]=useState(Boolean(initial.error));
 const [confirmReset,setConfirmReset]=useState(false);
 const [name,setName]=useState('');
 const [chosen,setChosen]=useState<number>(entries[0]?.id??0);
 const [x,setX]=useState('240'),[y,setY]=useState('170');
 const [quarterTurns,setQuarterTurns]=useState<AssemblyTurns>(0);
 const [composition,setComposition]=useState<number[]>([]);
 const [confirmDelete,setConfirmDelete]=useState(false);
 const [message,setMessage]=useState('');
 const current=entries.find(e=>e.id===chosen);
 const persist=(next:SavedAssembly[])=>{
  if(storageCorrupt)throw new Error('Unrecognized saved library is preserved. Reset it explicitly to continue.');
  // Storage write must succeed BEFORE updating visible library state.
  const serialized=encodeAssemblyLibrary(next);
  localStorage.setItem(ASSEMBLY_STORAGE_KEY,serialized);
  setEntries(next);setError(null);
 };
 const save=()=>{
  if(!project||!editable||!selectedIds.length||storageCorrupt)return;
  try{
   const next=saveAssembly(entries,name,makeFragment(project,selectedIds));
   persist(next);
   setChosen(next[next.length-1].id);setName('');
   setMessage('Saved '+next[next.length-1].name+' locally. No PLC state changed.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save assembly');}
 };
 const addToComposition=()=>{
  if(!current||storageCorrupt||composition.includes(current.id))return;
  if(composition.length>=4){setError('A composite can contain up to four saved cells');return;}
  setComposition(prev=>[...prev,current.id]);setError(null);
 };
 const compose=()=>{
  if(composition.length<2||!editable||storageCorrupt)return;
  try{
   const parts=composition.map(id=>{
    const saved=entries.find(entry=>entry.id===id);
    if(!saved)throw new Error('A selected assembly no longer exists');
    return saved.fragment;
   });
   const combined=composeAssemblyFragments(parts);
   const next=saveAssembly(entries,name,combined);
   persist(next);setChosen(next[next.length-1].id);
   setMessage('Created '+next[next.length-1].name+' from '+composition.length+
    ' immutable source cells. Actual insertion remains worker-validated.');
   setComposition([]);setName('');
  }catch(e){setError(e instanceof Error?e.message:'Unable to compose saved cells');}
 };
 const insert=()=>{
  if(!current||!editable)return;
  const rawX=Number(x),rawY=Number(y);
  if(!x.trim()||!y.trim()||!Number.isFinite(rawX)||!Number.isFinite(rawY)){
   setError('Enter valid insertion coordinates');return;
  }
  const at=clampPlacement({x:rawX,y:rawY},grid);
  try{
   const oriented=rotateAssemblyFragment(current.fragment,quarterTurns);
   onInsert(oriented,at);
   setError(null);setMessage('Requested '+current.name+' at '+at.x+', '+at.y+
    ' with '+quarterTurns*90+'° rotation; worker validation determines whether the paste is accepted.');
  }catch(e){setError(e instanceof Error?e.message:'Assembly rotation could not be applied');}
 };
 const remove=()=>{
  if(storageCorrupt)return;
  if(!current||!confirmDelete){setConfirmDelete(true);return;}
  try{
   const next=deleteAssembly(entries,current.id);
   persist(next);setChosen(next[0]?.id??0);
   setComposition(old=>old.filter(id=>id!==current.id));
   setConfirmDelete(false);setMessage('Removed saved assembly from this browser.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to delete assembly');}
 };
 const resetCorrupt=()=>{
  if(!storageCorrupt)return;
  if(!confirmReset){setConfirmReset(true);return;}
  try{
   // A deliberate second click is required before discarding damaged data.
   localStorage.removeItem(ASSEMBLY_STORAGE_KEY);
   setEntries([]);setChosen(0);setComposition([]);setStorageCorrupt(false);
   setConfirmReset(false);setError(null);
   setMessage('Damaged local assembly shelf reset by request.');
  }catch(e){setError(e instanceof Error?e.message:'Could not reset the local shelf');}
 };
 return <details className="sandbox-assembly-library panel" data-p7-assembly-library>
   <summary>Reusable 3D assemblies · {entries.length} saved locally</summary>
   <p className="sandbox-help">Select equipment in the workcell, then save it as an offline assembly.
     Internal wires, device settings and PLC programs travel with it.
     Inserting uses the same worker-validated paste command as normal editing.
     Rotate the entire reusable cell in quarter turns only when all saved machines support rotation.
     Combine two to four previously saved cells into a larger, offline snapshot with independent internal wiring.</p>
   <div className="sandbox-assembly-fields">
     <label>Assembly name
       <input data-assembly-name value={name} maxLength={48}
         onChange={e=>{setName(e.target.value);setError(null);}}
         placeholder="e.g. Sensor checkpoint" />
     </label>
     <button data-assembly-save type="button" className="btn ghost small"
       disabled={!editable||!project||selectedIds.length===0||storageCorrupt}
       onClick={save}>Save selected ({selectedIds.length})</button>
   </div>
   <div className="sandbox-assembly-fields">
     <label>Saved assembly
       <select data-assembly-select value={current?.id??0}
         onChange={e=>{setChosen(Number(e.target.value));setConfirmDelete(false);}}>
         <option value={0}>Choose an assembly</option>
         {entries.map(e=><option key={e.id} value={e.id}>
           {e.name} ({e.fragment.components.length} devices)</option>)}
       </select>
     </label>
     <label>Insert X
       <input data-assembly-x type="number" min={0} max={910}
         value={x} onChange={e=>setX(e.target.value)}/>
     </label>
     <label>Y
       <input data-assembly-y type="number" min={0} max={450}
         value={y} onChange={e=>setY(e.target.value)}/>
     </label>
     <label>Assembly orientation
       <select data-assembly-rotation value={quarterTurns}
         onChange={e=>setQuarterTurns(Number(e.target.value) as AssemblyTurns)}>
         <option value={0}>Original</option><option value={1}>90° clockwise</option>
         <option value={2}>180°</option><option value={3}>270° clockwise</option>
       </select>
     </label>
     <button data-assembly-insert type="button" className="btn ghost small"
       disabled={!current||!editable} onClick={insert}>Insert into workcell</button>
     <button data-assembly-delete type="button" className="btn ghost small"
       disabled={!current} onClick={remove}>{confirmDelete?'Confirm delete':'Delete saved'}</button>
   </div>
   <div className="sandbox-assembly-fields" data-p8-assembly-composition>
     <button type="button" className="btn ghost small" data-assembly-compose-add
       disabled={!current||composition.includes(current.id)||composition.length>=4||storageCorrupt}
       onClick={addToComposition}>Add saved cell to combination</button>
     <span data-assembly-compose-stack className="sandbox-help">
       {composition.length?composition.map(id=>entries.find(entry=>entry.id===id)?.name??'Deleted').join(' + '):
       'Choose two or more saved cells, using the selector above'}</span>
     <button type="button" className="btn ghost small" data-assembly-compose-save
       disabled={composition.length<2||!editable||storageCorrupt||!name.trim()}
       onClick={compose}>Save combined cell</button>
     <button type="button" className="btn ghost small" data-assembly-compose-clear
       disabled={!composition.length} onClick={()=>setComposition([])}>Clear combination</button>
   </div>
   {storageCorrupt&&<div className="sandbox-assembly-fields">
     <p className="sandbox-help">Existing damaged assembly data has not been overwritten.
       Reset this local shelf only after checking any backups.</p>
     <button type="button" data-assembly-reset className="btn ghost small"
       onClick={resetCorrupt}>{confirmReset?'Confirm local reset':'Reset unreadable shelf'}</button>
   </div>}
   {error&&<p role="alert" className="sandbox-error">{error}</p>}
   {message&&<p role="status" className="sandbox-help">{message}</p>}
   <p className="sandbox-help">Saved only in this browser. Export the full project JSON
     for portable backup. Physical overlaps and PLC correctness are not guaranteed by a saved assembly.</p>
 </details>;
}
