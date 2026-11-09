/** Pure, bounded Ladder tag editing helpers (no UI, electrical netlist or runtime mutation). */
import { validateLadder, type LadderDocument, type RungOperation, type NumericOperand, type SymbolDefinition } from '../engineering/ladder';
import { validateSandboxProgram } from './p2-contract';
import type { IoNames } from '../sim/plc-io';

const allowedTag = /^[A-Za-z][A-Za-z0-9_.]{0,39}$/;
const ban = new Set(['constructor','prototype','__proto__']);
const mapped = (tag:string,from:string,to:string):string => tag===from?to:tag;
const rewriteOperand = (op:NumericOperand,from:string,to:string):NumericOperand =>
  op.kind==='tag'&&op.name===from?{kind:'tag',name:to}:op;
function rewriteOperation(op:RungOperation|undefined,from:string,to:string):RungOperation|undefined {
  if(!op)return undefined;
  if(op.kind==='compare')return {...op,left:rewriteOperand(op.left,from,to),right:rewriteOperand(op.right,from,to)};
  if(op.kind==='move')return {...op,target:mapped(op.target,from,to),left:rewriteOperand(op.left,from,to)};
  if(['add','sub','mul','div'].includes(op.kind)){
    const calc=op as Extract<RungOperation,{kind:'add'|'sub'|'mul'|'div'}>;
    return {...calc,target:mapped(calc.target,from,to),
      left:rewriteOperand(calc.left,from,to),right:rewriteOperand(calc.right,from,to)};
  }
  if(op.kind==='rto'||op.kind==='ctu')
    return {...op,...(op.resetTag?{resetTag:mapped(op.resetTag,from,to)}:{})};
  if(op.kind==='ctd')return {...op,loadTag:mapped(op.loadTag,from,to)};
  return op;
}
/** Renames only declared LOCAL symbols, never a physical I/O mapping or wire. */
export function renameLocalTag(doc:LadderDocument,from:string,to:string,names:IoNames):LadderDocument {
  if(!doc.symbols?.[from])throw new Error('Unknown local tag '+from);
  if(!allowedTag.test(to)||ban.has(to.toLowerCase())||
    [...names.inputs,...names.outputs,'Unused',...Object.keys(doc.symbols)].some(name=>name.toLowerCase()===to.toLowerCase()&&name!==from))
    throw new Error('Tag name is invalid, duplicate or reserved for a physical terminal');
  const symbols:Record<string,SymbolDefinition>={};
  for(const [name,definition] of Object.entries(doc.symbols))
    symbols[mapped(name,from,to)]={...definition};
  const rungs=doc.rungs.map(rung=>({
    ...rung,coil:mapped(rung.coil,from,to),
    elements:rung.elements.map(element=>element.type==='contact'?
      {...element,tag:mapped(element.tag,from,to)} :
      {...element,alternatives:element.alternatives.map(path=>
        path.map(contact=>({...contact,tag:mapped(contact.tag,from,to)}))) }),
    ...(rung.operation?{operation:rewriteOperation(rung.operation,from,to)}:{}),
  }));
  const next:LadderDocument={...doc,symbols,rungs};
  const errors=validateSandboxProgram(next,names);
  if(errors.length)throw new Error(errors.join('; '));
  return next;
}
export function updateLocalTag(doc:LadderDocument,tag:string,patch:Partial<SymbolDefinition>,names:IoNames):LadderDocument {
  const current=doc.symbols?.[tag];
  if(!current)throw new Error('Unknown local tag');
  if(patch.type!==undefined && patch.type!==current.type)throw new Error('Change the tag type by creating a new tag');
  const nextDef={...current,...patch};
  if(typeof nextDef.description!=='string'||nextDef.description.length>120)
    throw new Error('Tag description is limited to 120 characters');
  if(nextDef.address==='')delete nextDef.address;
  const next:LadderDocument={...doc,symbols:{...doc.symbols,[tag]:nextDef}};
  const errors=[...validateLadder(next),...validateSandboxProgram(next,names)];
  if(errors.length)throw new Error(errors.join('; '));
  return next;
}
