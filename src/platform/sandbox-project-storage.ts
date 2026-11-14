/** Conservative browser-local protection for the active sandbox project.
 * The primary key remains legacy JSON for compatibility. A second valid copy
 * protects against a corrupt primary; this is NOT atomic CAS or durable backup.
 */
import type { ProjectFile } from '../sim/signals';

export interface SandboxStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export type SandboxValidator = (value:unknown)=>ProjectFile;
export const MAX_SANDBOX_PROJECT_TEXT = 1_000_000;
export const sandboxRecoveryKey = (key:string):string => key + ':recovery-v1';
export const sandboxDamagedKey = (key:string):string => key + ':damaged-v1';

export interface SandboxReadResult {
  project:ProjectFile|null;
  source:'empty'|'primary'|'recovery'|'blocked';
  observedRaw:string|null;
  saveAllowed:boolean;
  warning?:string;
}

function parse(raw:string,validate:SandboxValidator):ProjectFile {
  if(raw.length>MAX_SANDBOX_PROJECT_TEXT)throw Error('Saved project exceeds the 1 MB browser safety limit');
  return validate(JSON.parse(raw));
}

export function readSandboxProject(store:SandboxStorage,key:string,validate:SandboxValidator):SandboxReadResult {
  const primary=store.getItem(key);
  if(primary===null)return {project:null,source:'empty',observedRaw:null,saveAllowed:true};
  try{
    return {project:parse(primary,validate),source:'primary',observedRaw:primary,saveAllowed:true};
  }catch{
    const backup=store.getItem(sandboxRecoveryKey(key));
    if(backup!==null){
      try{
        const project=parse(backup,validate);
        let preserved=false;
        try{
          store.setItem(sandboxDamagedKey(key),primary);
          preserved=store.getItem(sandboxDamagedKey(key))===primary;
        }catch{/* Do not overwrite an unpreserved damaged original. */}
        return {project,source:'recovery',observedRaw:primary,saveAllowed:preserved,
          warning:preserved
            ? 'Recovered the last valid sandbox revision. The damaged original was preserved in browser storage.'
            : 'A backup was opened read-only. The damaged original could not be preserved; export your project before changing it.'};
      }catch{/* Keep the primary and the unusable backup untouched. */}
    }
    return {project:null,source:'blocked',observedRaw:primary,saveAllowed:false,
      warning:'Saved sandbox data is invalid and has no valid recovery copy. Original browser bytes were not overwritten.'};
  }
}

/** Reject stale-tab writes; archive the previous valid raw project before saving.
 * localStorage has no transaction/CAS, so near-simultaneous multi-tab writes
 * remain a limitation and require real-browser acceptance.
 */
export function persistSandboxProject(
  store:SandboxStorage,key:string,project:ProjectFile,expectedRaw:string|null,
  validate:SandboxValidator,
):string {
  const next=JSON.stringify(validate(project));
  if(next.length>MAX_SANDBOX_PROJECT_TEXT)throw Error('Sandbox project is too large for safe local autosave');
  const previous=store.getItem(key);
  if(previous!==expectedRaw)throw Error('Sandbox project changed in another tab; export your copy before reloading.');
  if(previous===next)return next;
  if(previous!==null){
    let valid=false;
    try{parse(previous,validate);valid=true;}catch{/* Corrupt data needs its own quarantine. */}
    if(valid)store.setItem(sandboxRecoveryKey(key),previous);
    else if(store.getItem(sandboxDamagedKey(key))!==previous)
      throw Error('Damaged original is not preserved; refusing to overwrite browser data.');
  }
  store.setItem(key,next);
  return next;
}
