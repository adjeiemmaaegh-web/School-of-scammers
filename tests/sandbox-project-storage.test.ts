import {describe,it,expect} from 'vitest';
import {newProject,validateProject} from '../src/sim/orchestrator';
import {readSandboxProject,persistSandboxProject,sandboxRecoveryKey,sandboxDamagedKey,MAX_SANDBOX_PROJECT_TEXT} from '../src/platform/sandbox-project-storage';

const KEY='efo-open-sandbox-project-v1';
function store(block?: (key:string)=>boolean){
 const map=new Map<string,string>();
 return {map,getItem:(key:string)=>map.get(key)??null,
  setItem:(key:string,value:string)=>{if(block?.(key))throw Error('Quota exceeded');map.set(key,value);}};
}
const project=()=>newProject();
const withSupply=()=>({...newProject(),components:[{id:'supply1',kind:'supply' as const,x:15,y:25,pressed:false}]});

describe('sandbox project recovery and stale-write protection',()=>{
 it('starts empty without inventing project data',()=>{
  const s=store();const r=readSandboxProject(s,KEY,validateProject);
  expect(r.source).toBe('empty');expect(r.project).toBeNull();expect(r.saveAllowed).toBe(true);
  expect(s.map.size).toBe(0);
 });
 it('reads existing valid legacy JSON without overwriting it',()=>{
  const s=store();const raw=JSON.stringify(withSupply());s.setItem(KEY,raw);
  const r=readSandboxProject(s,KEY,validateProject);
  expect(r.source).toBe('primary');expect(r.observedRaw).toBe(raw);
  expect(r.project?.components).toHaveLength(1);
  expect(s.getItem(KEY)).toBe(raw);
 });
 it('writes a prior valid revision to the backup before updating the primary',()=>{
  const s=store();
  const first=persistSandboxProject(s,KEY,project(),null,validateProject);
  expect(s.getItem(sandboxRecoveryKey(KEY))).toBeNull();
  const second=persistSandboxProject(s,KEY,withSupply(),first,validateProject);
  expect(second).not.toBe(first);
  expect(s.getItem(sandboxRecoveryKey(KEY))).toBe(first);
  expect(readSandboxProject(s,KEY,validateProject).project?.components).toHaveLength(1);
 });
 it('preserves corrupt primary bytes before restoring a valid recovery copy',()=>{
  const s=store();const original='{bad primary';
  const backup=JSON.stringify(withSupply());s.setItem(KEY,original);s.setItem(sandboxRecoveryKey(KEY),backup);
  const loaded=readSandboxProject(s,KEY,validateProject);
  expect(loaded.source).toBe('recovery');expect(loaded.saveAllowed).toBe(true);
  expect(loaded.project?.components).toHaveLength(1);
  expect(s.getItem(sandboxDamagedKey(KEY))).toBe(original);
  persistSandboxProject(s,KEY,loaded.project!,loaded.observedRaw,validateProject);
  expect(s.getItem(sandboxDamagedKey(KEY))).toBe(original);
  expect(s.getItem(sandboxRecoveryKey(KEY))).toBe(backup);
  expect(readSandboxProject(s,KEY,validateProject).source).toBe('primary');
 });
 it('blocks autosave when the primary is invalid and no recovery exists',()=>{
  const s=store();s.setItem(KEY,'not JSON');
  const loaded=readSandboxProject(s,KEY,validateProject);
  expect(loaded.source).toBe('blocked');expect(loaded.saveAllowed).toBe(false);
  expect(s.getItem(KEY)).toBe('not JSON');
  expect(()=>persistSandboxProject(s,KEY,project(),'not JSON',validateProject)).toThrow(/not preserved/);
 });
 it('opens recovery read-only if damaged original cannot be quarantined due to quota',()=>{
  const s=store(key=>key===sandboxDamagedKey(KEY));
  s.setItem(KEY,'{broken');s.setItem(sandboxRecoveryKey(KEY),JSON.stringify(withSupply()));
  const r=readSandboxProject(s,KEY,validateProject);
  expect(r.source).toBe('recovery');expect(r.saveAllowed).toBe(false);
  expect(s.getItem(KEY)).toBe('{broken');
  expect(()=>persistSandboxProject(s,KEY,r.project!,r.observedRaw,validateProject)).toThrow(/not preserved/);
 });
 it('rejects overwrite when another tab changes the primary after opening',()=>{
  const s=store();const prior=JSON.stringify(project());s.setItem(KEY,prior);
  const opened=readSandboxProject(s,KEY,validateProject);
  const secondTab=JSON.stringify(withSupply());s.setItem(KEY,secondTab);
  expect(()=>persistSandboxProject(s,KEY,project(),opened.observedRaw,validateProject)).toThrow(/another tab/);
  expect(s.getItem(KEY)).toBe(secondTab);
 });
 it('a quota failure during backup rotation leaves primary intact',()=>{
  let refuse=false;const s=store(key=>refuse&&key===sandboxRecoveryKey(KEY));
  const old=JSON.stringify(project());s.setItem(KEY,old);refuse=true;
  expect(()=>persistSandboxProject(s,KEY,withSupply(),old,validateProject)).toThrow(/Quota/);
  expect(s.getItem(KEY)).toBe(old);
 });
 it('rejects a saved primary exceeding the bounded parser size',()=>{
  const s=store();s.setItem(KEY,'x'.repeat(MAX_SANDBOX_PROJECT_TEXT+1));
  expect(readSandboxProject(s,KEY,validateProject).source).toBe('blocked');
  expect(s.getItem(KEY)?.length).toBe(MAX_SANDBOX_PROJECT_TEXT+1);
 });
});
