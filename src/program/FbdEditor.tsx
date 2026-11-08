import { useEffect, useMemo, useState } from 'react';
import { compileFbd, MAX_FBD_NODES, type FbdComparator, type FbdDocument, type FbdKind, type FbdNode } from '../engineering/fbd';
import type { RenderSnapshot } from '../sim/signals';
import { LEGACY_NAMES } from '../sim/plc-io';
import { FBD_ARITY, FBD_KINDS, initialFbdNode, addFbdNode, removeFbdNode, replaceFbdNode } from './fbd-editor-model';

type IoPoint = { terminal:string; tag:string };
export type FbdIo = { inputs:IoPoint[]; outputs:IoPoint[]; numericInputs?: {tag:string}[] };
type Props = { document:FbdDocument; snapshot:RenderSnapshot; disabled:boolean;
  onActivate:(doc:FbdDocument)=>void; showExamples?:boolean; io?:FbdIo };

/**
 * Visual graph and explicit connection editor for the authoritative FBD engine.
 * Editing a draft never changes PLC state. Only "Compile & activate" sends a graph
 * to the simulator worker, which validates again before accepting it.
 */
export function FbdEditor({document,snapshot,disabled,onActivate,showExamples=true,io}:Props) {
  const [draft,setDraft] = useState<FbdDocument>(document);
  const [kind,setKind] = useState<FbdKind>('and');
  const [editingError,setEditingError] = useState('');
  useEffect(()=>{setDraft(document);setEditingError('');},[document]);
  const names = useMemo(()=>io ? {
    inputs:io.inputs.map(p=>p.tag),outputs:io.outputs.map(p=>p.tag),
    numericInputs:io.numericInputs?.map(p=>p.tag)??[],requireRun:io.outputs.some(p=>p.tag==='Run'),
  } : LEGACY_NAMES,[io]);
  const result = useMemo(()=>{
    try {compileFbd(draft,names);return {ok:true,message:'Graph validated for the selected PLC'};}
    catch(e){return {ok:false,message:e instanceof Error?e.message:String(e)};}
  },[draft,names]);
  const live = new Map<string,(typeof snapshot.fbdSteps)[number]>(snapshot.fbdSteps.map(step=>[step.nodeId,step] as const));
  const positions = new Map<string,{x:number;y:number}>(draft.nodes.map((node,i)=>[
    node.id,{x:node.x??(50+Math.floor(i/5)*220),y:node.y??(50+(i%5)*90)},
  ] as const));
  const width = Math.max(900,...[...positions.values()].map(p=>p.x+155));
  const height = Math.max(440,...[...positions.values()].map(p=>p.y+100));
  const alter = (node:FbdNode) => {setDraft(doc=>replaceFbdNode(doc,node));setEditingError('');};
  const add = () => {
    try {const node=initialFbdNode(draft,kind,names);setDraft(doc=>addFbdNode(doc,node));setEditingError('');}
    catch(e){setEditingError(e instanceof Error?e.message:String(e));}
  };
  const rename = (node:FbdNode, name:string) => {
    if(!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name))return;
    const old=node.id;
    if(old===name||draft.nodes.some(n=>n.id===name))return;
    setDraft(doc=>({...doc,nodes:doc.nodes.map(n=>({
      ...n,id:n.id===old?name:n.id,
      ...(n.inputs?{inputs:n.inputs.map(id=>id===old?name:id)}:{}),
    }))}));
  };
  const numeric = draft.nodes.filter(n=>n.kind!=='output');
  return <section className="sandbox-fbd-editor" aria-label="Function Block Diagram programming editor">
    <header className="sandbox-section-head"><div><span className="eyebrow">PLC program · connected blocks</span>
      <h2>Function Block Diagram (FBD)</h2></div>
      <span className="status-pill is-idle">Deterministic 50 ms PLC scan</span>
    </header>
    <p className="sandbox-help">Blocks are wired by selecting a source for each input pin. Their connections are displayed below. Feedback uses an INPUT block reading a previously published output tag, never an unbounded graph cycle. This is an educational subset, not vendor PLC hardware.</p>
    <div className="sandbox-fbd-actions">
      <label>Insert block
        <select aria-label="New FBD block type" value={kind}
          onChange={event=>setKind(event.target.value as FbdKind)} disabled={disabled}>
          {FBD_KINDS.map(type=><option key={type} value={type}>{type.toUpperCase()}</option>)}
        </select>
      </label>
      <button type="button" className="btn ghost small" disabled={disabled||draft.nodes.length>=MAX_FBD_NODES}
        onClick={add}>Add block</button>
      {showExamples&&<button type="button" className="btn ghost small" disabled={disabled}
        onClick={()=>setDraft({id:'fbd-demo',version:'1.0',nodes:[
          {id:'source',kind:'input',tag:names.inputs[0]},{id:'coil',kind:'output',tag:names.outputs[0],inputs:['source']},
        ]})}>Simple I/O example</button>}
    </div>
    <div className="sandbox-fbd-canvas" role="region" aria-label="FBD signal flow connections" tabIndex={0}>
      <svg viewBox={'0 0 '+width+' '+height} width={width} height={height} role="img" aria-label="Connections between named function blocks">
        <defs><marker id="fbd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
        {draft.nodes.flatMap(node=>(node.inputs??[]).map((src,port)=>{
          const a=positions.get(src),b=positions.get(node.id);
          if(!a||!b)return null;
          const fromX=a.x+124,toX=b.x-3,fromY=a.y+28,toY=b.y+20+port*16;
          return <path key={node.id+'-'+src+'-'+port}
            d={'M'+fromX+' '+fromY+' C'+(fromX+45)+' '+fromY+' '+(toX-45)+' '+toY+' '+toX+' '+toY}
            stroke="#709eb8" strokeWidth={2} fill="none" markerEnd="url(#fbd-arrow)" />;
        }))}
        {draft.nodes.map((node,i)=>{
          const position=positions.get(node.id)!;
          const monitor=live.get(node.id);
          return <g key={node.id} transform={'translate('+position.x+' '+position.y+')'}>
            <rect width={124} height={56} rx={8}
              fill={monitor?.on===true?'#124f40':'#1b3041'} stroke={monitor?.on?'#2ddcab':'#7896aa'} strokeWidth={2}/>
            <text x={8} y={17} fill="#dcecf6" fontSize="11" fontWeight="bold">{node.kind.toUpperCase()}</text>
            <text x={8} y={32} fill="#b8d3e3" fontSize="10">{node.tag??node.id}</text>
            <text x={8} y={47} fill="#b8d3e3" fontSize="9">{monitor?(monitor.on?'TRUE':'FALSE'):node.id}</text>
            <title>{node.id+' ('+node.kind+'), '+(monitor?(monitor.on?'TRUE':'FALSE'):'awaiting scan')}</title>
          </g>;
        })}
      </svg>
    </div>
    <div className="sandbox-fbd-blocks">
      {draft.nodes.map(node=><fieldset key={node.id} className="sandbox-fbd-block">
        <legend>{node.id} · {node.kind.toUpperCase()} {live.has(node.id)?(live.get(node.id)?.on?'· TRUE':'· FALSE'):''}</legend>
        <label>Node ID <input aria-label={'FBD node ID '+node.id} disabled={disabled} defaultValue={node.id}
          key={node.id} onBlur={e=>rename(node,e.target.value.trim())}/></label>
        {node.kind==='input'&&<label>BOOL tag
          <select disabled={disabled} value={node.tag??''}
            aria-label={'FBD input tag '+node.id} onChange={e=>alter({...node,tag:e.target.value})}>
            {[...names.inputs,...names.outputs].map(tag=><option key={tag} value={tag}>{tag}</option>)}
          </select></label>}
        {node.kind==='output'&&<label>PLC output tag
          <select disabled={disabled} value={node.tag??''}
            aria-label={'FBD output tag '+node.id} onChange={e=>alter({...node,tag:e.target.value})}>
            {names.outputs.map(tag=><option key={tag} value={tag}>{tag}</option>)}
          </select></label>}
        {node.kind==='constant'&&<label>BOOL value
          <select disabled={disabled} value={node.value?'true':'false'}
            onChange={e=>alter({...node,value:e.target.value==='true'})}>
            <option value="false">FALSE</option><option value="true">TRUE</option>
          </select></label>}
        {node.kind==='compare'&&<>
          <label>Numeric input tag
            <select disabled={disabled} value={node.tag??''}
              onChange={e=>alter({...node,tag:e.target.value})}>
              {(names.numericInputs??[]).map(tag=><option key={tag} value={tag}>{tag}</option>)}
            </select></label>
          <label>Comparator
            <select disabled={disabled} value={node.comparator??'ge'}
              onChange={e=>alter({...node,comparator:e.target.value as FbdComparator})}>
              {['eq','ne','lt','le','gt','ge'].map(op=><option key={op} value={op}>{op.toUpperCase()}</option>)}
            </select></label>
          <label>Threshold
            <input type="number" disabled={disabled} step="any" min="-1000000000" max="1000000000"
              value={node.threshold??0} onChange={e=>alter({...node,threshold:Number(e.target.value)})}/>
          </label>
        </>}
        {['ton','tof','tp','ctu','ctd'].includes(node.kind)&&<label>{node.kind.startsWith('ct')?'Preset count':'Preset milliseconds'}
          <input type="number" disabled={disabled} min={1} max={node.kind.startsWith('ct')?100000000:86400000}
            value={node.preset??1} onChange={e=>alter({...node,preset:Number(e.target.value)})}/>
        </label>}
        {(node.inputs??[]).map((input,index)=><label key={index}>{node.kind==='ctu'&&index===1?'Reset pin':node.kind==='ctd'&&index===1?'Load pin':
          ['sr','rs'].includes(node.kind)?(index===0?'Set pin':'Reset pin'):'Input pin '+(index+1)}
          <select disabled={disabled} value={input} aria-label={'FBD '+node.id+' input '+index}
            onChange={e=>alter({...node,inputs:node.inputs!.map((id,j)=>j===index?e.target.value:id)})}>
            <option value="">Choose source</option>
            {numeric.filter(src=>src.id!==node.id).map(src=><option key={src.id} value={src.id}>
              {src.id} ({src.kind})</option>)}
          </select></label>)}
        <label>X <input aria-label={'FBD layout x '+node.id} type="number" min={0} max={2000}
          disabled={disabled} value={node.x??(50+Math.floor(draft.nodes.indexOf(node)/5)*220)}
          onChange={e=>alter({...node,x:Number(e.target.value)})}/></label>
        <label>Y <input aria-label={'FBD layout y '+node.id} type="number" min={0} max={2000}
          disabled={disabled} value={node.y??(50+(draft.nodes.indexOf(node)%5)*90)}
          onChange={e=>alter({...node,y:Number(e.target.value)})}/></label>
        <button type="button" className="btn ghost small" disabled={disabled||draft.nodes.length<=2}
          onClick={()=>setDraft(current=>removeFbdNode(current,node.id))}>Remove block</button>
      </fieldset>)}
    </div>
    {editingError&&<p role="alert">{editingError}</p>}
    <p className="sandbox-fbd-validation" role="status">
      <strong>{result.ok?'Compiler OK':'Compiler error'}</strong> · {result.message}</p>
    <div className="sandbox-actions">
      <button type="button" className="btn primary small"
        disabled={disabled||!result.ok||JSON.stringify(document)===JSON.stringify(draft)}
        onClick={()=>onActivate(draft)}>Compile &amp; activate FBD</button>
      <button type="button" className="btn ghost small" disabled={disabled||JSON.stringify(document)===JSON.stringify(draft)}
        onClick={()=>setDraft(document)}>Discard edits</button>
    </div>
    <p className="sandbox-help">Supported: BOOL logic, SR/RS, TON/TOF/TP, CTU/CTD, numeric input comparisons and output blocks. Invalid loops, dangling pins, duplicate outputs and unsupported types are refused; the worker independently revalidates the saved document.</p>
  </section>;
}
