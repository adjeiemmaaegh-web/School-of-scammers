/**
 * R22 true grouping. A group is a named, persisted set of devices and/or other groups, so structures nest. Selecting any member
 * selects the whole top-level group; moving, rotating, aligning, duplicating and deleting act on the whole group; rotating a
 * group turns it about its own centre (positions and orientation together). Pure and deterministic; groups live in the project
 * file, so undo/redo, save and reload carry them.
 */
import type {PlacedComponent,ProjectFile} from '../sim/signals';

export type Group={id:string;name:string;members:string[]};
export const MAX_GROUPS=64, MAX_GROUP_DEPTH=4, MAX_GROUP_NAME=40;

const byId=(groups:readonly Group[])=>new Map(groups.map(g=>[g.id,g]));

/** Reject cycles, unknown members, shared members, over-deep nesting and empty groups. Returns undefined when there are none. */
export function validateGroups(raw:unknown,deviceIds:ReadonlySet<string>):Group[]|undefined{
 if(raw===undefined)return undefined;
 if(!Array.isArray(raw)||raw.length>MAX_GROUPS)throw new Error(`Invalid groups (at most ${MAX_GROUPS})`);
 const groups:Group[]=[];const ids=new Set<string>();
 for(const g of raw){
  if(!g||typeof g!=='object'||typeof g.id!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(g.id)||ids.has(g.id)||deviceIds.has(g.id)||
   typeof g.name!=='string'||!g.name.trim()||g.name.length>MAX_GROUP_NAME||!Array.isArray(g.members)||g.members.length<2||
   g.members.some((m:unknown)=>typeof m!=='string'))throw new Error('Invalid group');
  ids.add(g.id);groups.push({id:g.id,name:g.name,members:[...g.members]});
 }
 const owner=new Map<string,string>();
 for(const g of groups)for(const m of g.members){
  if(!deviceIds.has(m)&&!ids.has(m))throw new Error(`Group ${g.id} contains unknown member ${m}`);
  if(m===g.id)throw new Error('A group cannot contain itself');
  if(owner.has(m))throw new Error(`${m} belongs to more than one group`);
  owner.set(m,g.id);
 }
 const index=byId(groups);
 const depth=(id:string,seen:Set<string>):number=>{
  if(seen.has(id))throw new Error('Group nesting forms a cycle');
  const g=index.get(id);if(!g)return 0;
  seen.add(id);const d=1+Math.max(0,...g.members.map(m=>depth(m,new Set(seen))));return d;
 };
 for(const g of groups)if(depth(g.id,new Set())>MAX_GROUP_DEPTH)throw new Error(`Groups nest at most ${MAX_GROUP_DEPTH} deep`);
 return groups.length?groups:undefined;
}
/** The top-most group containing `id` (or undefined when it is not grouped). */
export function rootGroupOf(groups:readonly Group[]|undefined,id:string):Group|undefined{
 if(!groups)return undefined;
 let current=groups.find(g=>g.members.includes(id));
 while(current){const parent=groups.find(g=>g.members.includes(current!.id));if(!parent)break;current=parent;}
 return current;
}
/** Every device id inside a group, through nested groups, in project order. */
export function leafDevices(groups:readonly Group[],groupId:string,components:readonly PlacedComponent[]):string[]{
 const index=byId(groups);const found=new Set<string>();
 const walk=(id:string)=>{const g=index.get(id);if(!g){found.add(id);return;}g.members.forEach(walk);};
 walk(groupId);
 return components.filter(c=>found.has(c.id)).map(c=>c.id);
}
/** Selecting any member selects its whole top-level group: the ids a group-aware edit really applies to. */
export function expandSelection(project:Pick<ProjectFile,'groups'|'components'>,ids:readonly string[]):string[]{
 const out=new Set<string>();
 for(const id of ids){
  const root=rootGroupOf(project.groups,id);
  if(root)leafDevices(project.groups!,root.id,project.components).forEach(d=>out.add(d));else out.add(id);
 }
 return project.components.filter(c=>out.has(c.id)).map(c=>c.id).concat([...out].filter(id=>!project.components.some(c=>c.id===id)));
}
const freshGroupId=(project:Pick<ProjectFile,'groups'|'components'>):string=>{
 const used=new Set([...(project.groups??[]).map(g=>g.id),...project.components.map(c=>c.id)]);
 let n=1;while(used.has('group-'+n))n++;return 'group-'+n;
};
/** Group the selection: its members are the selection's top-level groups and loose devices, so existing groups nest inside. */
export function createGroup(project:ProjectFile,ids:readonly string[],name:string):ProjectFile{
 const label=name.trim().slice(0,MAX_GROUP_NAME)||'Group';
 const members:string[]=[];
 for(const id of ids){
  const member=rootGroupOf(project.groups,id)?.id??id;
  if(!members.includes(member))members.push(member);
 }
 if(members.length<2)throw new Error('Select at least two devices (or groups) to group');
 if((project.groups?.length??0)>=MAX_GROUPS)throw new RangeError(`At most ${MAX_GROUPS} groups`);
 const group:Group={id:freshGroupId(project),name:label,members};
 const next:ProjectFile={...project,groups:[...(project.groups??[]),group]};
 validateGroups(next.groups,new Set(project.components.map(c=>c.id)));
 return next;
}
/** Dissolve the top-level group(s) holding the selection; nested groups and devices become free (or stay grouped one level up). */
export function ungroup(project:ProjectFile,ids:readonly string[]):ProjectFile{
 const roots=new Set<string>();
 for(const id of ids){const r=rootGroupOf(project.groups,id);if(r)roots.add(r.id);}
 if(!roots.size)throw new Error('The selection is not grouped');
 const groups=(project.groups??[]).filter(g=>!roots.has(g.id));
 const {groups:_old,...rest}=project;
 return groups.length?{...rest,groups}:rest;
}
/** Drop a removed device from its group; a group left with fewer than two members dissolves (its last member joins the parent). */
export function pruneGroups(project:ProjectFile):ProjectFile{
 if(!project.groups)return project;
 const deviceIds=new Set(project.components.map(c=>c.id));
 let groups=project.groups.map(g=>({...g,members:g.members.filter(m=>deviceIds.has(m)||project.groups!.some(x=>x.id===m))}));
 let changed=true;
 while(changed){
  changed=false;
  for(const g of [...groups]){
   const alive=g.members.filter(m=>deviceIds.has(m)||groups.some(x=>x.id===m));
   if(alive.length<2){
    groups=groups.filter(x=>x.id!==g.id).map(x=>({...x,members:x.members.flatMap(m=>m===g.id?alive:[m])}));changed=true;break;
   }
  }
 }
 const {groups:_old,...rest}=project;
 return groups.length?{...rest,groups}:rest;
}
