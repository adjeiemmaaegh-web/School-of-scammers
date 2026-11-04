import {validateLadder, type LadderDocument, type Contact} from './ladder';

export type AuditFinding = {code:string; severity:'error'|'warning'|'info'; rungId?:string; tag?:string; message:string};
export type LadderAudit = {findings:AuditFinding[]; dependencies:Record<string,string[]>; evaluationOrder:string[]; externalInputs:string[]; internalOutputs:string[]; hasCycle:boolean};
/** Static, read-only analysis. A finding never rewrites or energizes a PLC program. */
export function auditLadder(doc:LadderDocument):LadderAudit {
 const findings:AuditFinding[]=[];
 const errors=validateLadder(doc);
 for(const message of errors)findings.push({code:'INVALID_DOCUMENT',severity:'error',message});
 if(errors.length)return {findings,dependencies:{},evaluationOrder:[],externalInputs:[],internalOutputs:[],hasCycle:false};
 const outputs=new Set(doc.rungs.map(r=>r.coil));
 const byOutput=new Map(doc.rungs.map(r=>[r.coil,r]));
 const deps:Record<string,string[]>={}; const external=new Set<string>();
 for(const rung of doc.rungs){
  const contacts:Contact[]=rung.elements.flatMap(e=>e.type==='contact'?[e]:e.alternatives.flatMap(a=>a));
  const tags=new Set(contacts.map(c=>c.tag));
  if(rung.operation && 'resetTag' in rung.operation && rung.operation.resetTag)tags.add(rung.operation.resetTag);
  if(rung.operation?.kind==='ctd')tags.add(rung.operation.loadTag);
  deps[rung.coil]=[...tags].filter(t=>outputs.has(t)).sort();
  for(const tag of tags)if(!outputs.has(tag))external.add(tag);
  if(tags.has(rung.coil))findings.push({code:'SELF_REFERENCE',severity:'info',rungId:rung.id,tag:rung.coil,message:`${rung.coil} feeds its own rung; verify intentional seal-in or feedback behavior.`});
  if(contacts.some(c=>c.tag===rung.coil&&c.normallyClosed))findings.push({code:'NEGATED_FEEDBACK',severity:'warning',rungId:rung.id,tag:rung.coil,message:`Normally-closed feedback of ${rung.coil} can alternate across scans.`});
  const contactsByTag=new Map<string,Set<boolean>>();
  for(const c of contacts){const states=contactsByTag.get(c.tag)??new Set<boolean>();states.add(c.normallyClosed===true);contactsByTag.set(c.tag,states);}
  for(const [tag,states] of contactsByTag)if(states.size===2)findings.push({code:'MIXED_POLARITY',severity:'info',rungId:rung.id,tag,message:`${tag} is used with both contact polarities; inspect parallel paths.`});
 }
 // Tarjan SCC identifies inter-rung feedback loops. Self references are reported separately.
 let index=0;const indices=new Map<string,number>();const low=new Map<string,number>();const stack:string[]=[];const stacked=new Set<string>();const components:string[][]=[];
 const visit=(tag:string)=>{indices.set(tag,index);low.set(tag,index++);stack.push(tag);stacked.add(tag);
  for(const dep of deps[tag]??[]){if(!indices.has(dep)){visit(dep);low.set(tag,Math.min(low.get(tag)!,low.get(dep)!));}else if(stacked.has(dep))low.set(tag,Math.min(low.get(tag)!,indices.get(dep)!));}
  if(low.get(tag)===indices.get(tag)){const group:string[]=[];let item:string;do{item=stack.pop()!;stacked.delete(item);group.push(item);}while(item!==tag);components.push(group.sort());}
 };
 for(const tag of outputs)if(!indices.has(tag))visit(tag);
 const cycles=components.filter(c=>c.length>1);
 for(const cycle of cycles)findings.push({code:'FEEDBACK_CYCLE',severity:'warning',tag:cycle.join(','),message:`Inter-rung feedback cycle: ${cycle.join(' → ')}. Scan order may affect results.`});
 const position=new Map(doc.rungs.map((r,i)=>[r.coil,i]));
 for(const rung of doc.rungs)for(const dep of deps[rung.coil])if(dep!==rung.coil && position.get(dep)!>position.get(rung.coil)!)findings.push({code:'PREVIOUS_SCAN_VALUE',severity:'info',rungId:rung.id,tag:dep,message:`${rung.id} reads ${dep} before its writer rung executes; previous-scan value is used.`});
 for(const tag of external)if(byOutput.has(tag))throw new Error('Internal audit invariant');
 return {findings,dependencies:deps,evaluationOrder:doc.rungs.map(r=>r.coil),externalInputs:[...external].sort(),internalOutputs:[...outputs],hasCycle:cycles.length>0};
}
export function auditCsv(audit:LadderAudit):string {
 const esc=(s:string)=>`"${s.replace(/"/g,'""')}"`;
 return ['severity,code,rung,tag,message',...audit.findings.map(f=>[f.severity,f.code,f.rungId??'',f.tag??'',f.message].map(esc).join(','))].join('\r\n')+'\r\n';
}
