import { useMemo, useState } from 'react';
import type { LadderDocument } from '../engineering/ladder';
import { compileStructuredText } from '../engineering/structured-text';
import type { ProjectFile, RenderSnapshot } from '../sim/signals';
import { LEGACY_IO, LEGACY_NAMES } from '../sim/plc-io';
import { renameLocalTag, updateLocalTag } from './tag-table';
import type { FbdIo } from './FbdEditor';

type Props={project:ProjectFile;snapshot:RenderSnapshot;disabled:boolean;io?:FbdIo;
  onLadder:(document:LadderDocument)=>void};
const shown = (value:unknown):string => typeof value==='boolean'?(value?'TRUE':'FALSE'):
  value===undefined?'—':String(value);
export function PlcTagTable({project,snapshot,disabled,io,onLadder}:Props) {
  const [selected,setSelected]=useState('');
  const [newName,setNewName]=useState('');
  const [description,setDescription]=useState('');
  const [address,setAddress]=useState('');
  const [error,setError]=useState<string|null>(null);
  const nameMap=useMemo(()=>io?{
    inputs:io.inputs.map(p=>p.tag),outputs:io.outputs.map(p=>p.tag),
    requireRun:io.outputs.some(p=>p.tag==='Run'),
    numericInputs:io.analogInputs?.map(p=>p.tag)??[],
  }:LEGACY_NAMES,[io]);
  const symbols=project.program.symbols??{};
  const local=Object.keys(symbols);
  const selectedTag=local.includes(selected)?selected:'';
  const select=(tag:string)=>{
    setSelected(tag);setNewName(tag);setDescription(symbols[tag]?.description??'');
    setAddress(symbols[tag]?.address??'');setError(null);
  };
  const apply=()=>{
    if(!selectedTag||disabled)return;
    try {
      let doc=project.program;
      const tag=newName.trim();
      if(tag!==selectedTag)doc=renameLocalTag(doc,selectedTag,tag,nameMap);
      doc=updateLocalTag(doc,tag,{description,address:address.trim()},nameMap);
      onLadder(doc);setError(null);setSelected(tag);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  let stDeclarations:ReturnType<typeof compileStructuredText>['declarations']=[];
  if((project.language??'ladder')==='st'){
    try{stDeclarations=compileStructuredText(project.stSource??'').declarations;}
    catch{/* The Structured Text editor displays the compiler's detailed error. */}
  }
  const physicalInputs=io?.inputs??Object.entries(LEGACY_IO.inputs).map(([terminal,tag])=>({terminal,tag}));
  const physicalOutputs=io?.outputs??Object.entries(LEGACY_IO.outputs).map(([terminal,tag])=>({terminal,tag}));
  return <details className="sandbox-p2-tag-table">
    <summary>PLC tag table · live address and variable reference</summary>
    <p className="sandbox-help">The physical tag/address table is a view of the authoritative PLC input/output image. Ladder local address fields are descriptive metadata, NOT additional wired terminals. Remap real PLC16 I/O separately in the I/O mapping panel.</p>
    <div className="sandbox-p2-tag-grid" role="table" aria-label="Physical mapped PLC tags">
      <div role="row" className="sandbox-monitor-header">
        <strong role="columnheader">Address</strong><strong role="columnheader">Tag</strong>
        <strong role="columnheader">Type</strong><strong role="columnheader">Live</strong></div>
      {physicalInputs.map(p=><div role="row" key={'i'+p.terminal}>
        <code role="cell">{p.terminal}</code><code role="cell">{p.tag}</code>
        <span role="cell">DI · BOOL</span><strong role="cell">{shown(snapshot.tagValues[p.tag])}</strong></div>)}
      {(io?.numericInputs??[]).map(p=><div role="row" key={'a'+p.tag}>
        <code role="cell">Analog</code><code role="cell">{p.tag}</code>
        <span role="cell">Numeric process</span><strong role="cell">{shown(snapshot.tagValues[p.tag])}</strong></div>)}
      {physicalOutputs.map(p=><div role="row" key={'o'+p.terminal}>
        <code role="cell">{p.terminal}</code><code role="cell">{p.tag}</code>
        <span role="cell">DO · BOOL</span><strong role="cell">{shown(snapshot.tagValues[p.tag])}</strong></div>)}
    </div>
    <h3>Program-local variables</h3>
    {project.language==='st' ? <>
      <p className="sandbox-help">ST variables are declared and edited in source using VAR_INPUT, VAR_OUTPUT and VAR blocks. Their types are shown here read-only.</p>
      <div className="sandbox-p2-tag-grid" role="table" aria-label="Structured Text declared tags">
        {stDeclarations.map(d=><div key={d.name} role="row">
          <code role="cell">{d.name}</code><span role="cell">{d.type} · {d.scope}</span>
          <strong role="cell">{shown(snapshot.tagValues[d.name])}</strong></div>)}
      </div>
    </> : project.language==='fbd' ? <>
      <p className="sandbox-help">FBD memory is held in its timer, counter and set/reset blocks. Edit their types, presets and connections in the FBD editor.</p>
      <div className="sandbox-p2-tag-grid" role="table" aria-label="FBD live block outputs">
        {snapshot.fbdSteps.map(step=><div key={step.nodeId} role="row">
          <code role="cell">{step.nodeId}</code><span role="cell">{step.kind.toUpperCase()}</span>
          <strong role="cell">{shown(step.on)}{step.elapsedMs!==undefined?' · '+step.elapsedMs+' ms':''}
            {step.count!==undefined?' · CV '+step.count:''}</strong></div>)}
      </div>
    </> : <>
      <p className="sandbox-help">Local Ladder variables are stored with the saved PLC program. Choose one to safely rename it across all rung references or edit its description/address metadata. Editing resets the simulated PLC scan memory.</p>
      <div className="sandbox-p2-tag-grid" role="table" aria-label="Ladder local tag table">
        {local.map(tag=><button type="button" key={tag} role="row" className={tag===selectedTag?'selected':''}
          disabled={disabled} onClick={()=>select(tag)}>
          <code role="cell">{tag}</code>
          <span role="cell">{symbols[tag].type??'BOOL'}</span>
          <span role="cell">{symbols[tag].address??'Memory'}</span>
          <strong role="cell">{shown(snapshot.tagValues[tag]??symbols[tag].initial)}</strong>
        </button>)}
        {!local.length&&<p className="sandbox-help">No local Ladder tags yet; create them using the Ladder editor.</p>}
      </div>
      {selectedTag&&<div className="sandbox-p2-tag-settings">
        <label>Name <input value={newName} disabled={disabled} maxLength={40}
          onChange={e=>setNewName(e.target.value)}/></label>
        <label>Description <input value={description} disabled={disabled} maxLength={120}
          onChange={e=>setDescription(e.target.value)}/></label>
        <label>Address annotation <input value={address} disabled={disabled} maxLength={80}
          onChange={e=>setAddress(e.target.value)} placeholder="e.g. M1.0 (informational)"/></label>
        <button type="button" className="btn ghost small" disabled={disabled}
          onClick={apply}>Validate &amp; save local tag</button>
      </div>}
      {error&&<p role="alert">{error}</p>}
    </>}
  </details>;
}
