import { useState } from 'react';
import { validateLadder, type LadderDocument, type Contact, type Rung } from '../engineering/ladder';
import { insertElement, moveElement, moveRung } from '../engineering/editor-operations';
import {exportPlcopenLadder,importPlcopenLadder} from '../engineering/plcopen-ld-xml';

const inputs = ['PowerOK', 'GuardClosed', 'SensorOK', 'Stop', 'Start', 'RunLatch', 'TimerDone', 'OffDelayDone', 'CountDone', 'PulseDone', 'ZeroReached', 'Aux1', 'Aux2', 'Enable', 'Sensor', 'ResetCount', 'LoadCount', 'ResetTimer', 'Photoeye', 'ExitSensor', 'MotorFeedback', 'K1Feedback', 'BatchDone', 'RetainDone', 'Rising', 'Falling', 'Diverter', 'ExitPulse'];
const outputs = ['RunLatch', 'TimerDone', 'OffDelayDone', 'CountDone', 'PulseDone', 'ZeroReached', 'Aux1', 'Aux2', 'BatchDone', 'RetainDone', 'Rising', 'Falling', 'Diverter', 'ExitPulse'];
const clone = (doc: LadderDocument): LadderDocument => ({ ...doc, rungs: doc.rungs.map(r => ({ ...r, elements: r.elements.map(e => e.type === 'contact' ? { ...e } : { ...e, alternatives: e.alternatives.map(a => a.map(c => ({ ...c }))) }) })) });
export function LadderEditor({ document, onChange }: { document: LadderDocument; onChange: (doc: LadderDocument) => void }) {
  const [draft, setDraft] = useState('');
  const [dragged, setDragged] = useState<{ rung: number; element: number } | null>(null);
  const [message, setMessage] = useState('');
  const symbols = document.symbols ?? {};
  const [symbolTag, setSymbolTag] = useState('Start');
  const [newSymbolTag,setNewSymbolTag]=useState('');
  const [symbolDescription, setSymbolDescription] = useState('');
  const [symbolAddress, setSymbolAddress] = useState('');
  const documentedTags=document.rungs.flatMap(r=>[r.coil,...r.elements.flatMap(e=>e.type==='contact'?[e.tag]:e.alternatives.flatMap(path=>path.map(x=>x.tag)))]);
  const availableTags=[...new Set([...inputs,...outputs,...Object.keys(symbols),...documentedTags])];
  const coilTags=[...new Set([...outputs,...document.rungs.map(r=>r.coil),...Object.keys(symbols)])];
  const tagOptions = availableTags.map(tag => <option key={tag} value={tag}>{symbols[tag]?.description ? `${tag} — ${symbols[tag].description}` : tag}</option>);
  const editBranchContact = (ri:number, ei:number, pi:number, ci:number, patch:Partial<Contact>) => editRung(ri, r=>({...r, elements:r.elements.map((e,i)=>i!==ei || e.type!=='branch'?e:{...e,alternatives:e.alternatives.map((path,p)=>p!==pi?path:path.map((c,j)=>j!==ci?c:{...c,...patch}))})}));
  const editBranch = (ri:number, ei:number, update:(paths:readonly (readonly Contact[])[])=>readonly (readonly Contact[])[]) => editRung(ri,r=>({...r,elements:r.elements.map((e,i)=>i!==ei || e.type!=='branch'?e:{...e,alternatives:update(e.alternatives)})}));
  const errors = validateLadder(document);
  const editRung = (index: number, update: (r: Rung) => Rung) => {
    const d = clone(document);
    const rungs = [...d.rungs];
    rungs[index] = update(rungs[index]);
    onChange({ ...d, rungs });
  };
  const editContact = (rungIndex: number, contactIndex: number, patch: Partial<Contact>) => editRung(rungIndex, r => ({ ...r, elements: r.elements.map((e, i) => i === contactIndex && e.type === 'contact' ? { ...e, ...patch } : e) }));
  const exportProgram = () => { setDraft(JSON.stringify(document, null, 2)); setMessage('Program exported to JSON text below.'); };
  const exportLdXml=()=>{
    try{
      const metadata=Object.keys(symbols).length>0;
      if(metadata&&!window.confirm('PLCopen LD subset does not preserve rung IDs or symbol descriptions/addresses. Use project JSON for a lossless backup. Export XML anyway?'))return;
      const xml=exportPlcopenLadder(document,'TrainingLadder',{allowSymbolMetadataLoss:metadata});
      const url=URL.createObjectURL(new Blob([xml],{type:'application/xml;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='plc-ladder-tc6-0201.xml';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('PLCopen LD XML exported (BOOL contact/coil subset). Keep project JSON for complete program metadata.');
    }catch(error){setMessage('PLCopen LD export rejected: '+String(error));}
  };
  const importLdXml=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      if(file.size>150000)throw Error('XML file exceeds 150 KB limit');
      const doc=importPlcopenLadder(await file.text());
      onChange(clone(doc));setMessage('Validated PLCopen LD XML imported: '+doc.rungs.length+' rung(s). Existing program and scan memory must be reset.');
    }catch(error){setMessage('PLCopen LD XML import rejected: '+String(error));}
  };
  const importProgram = () => {
    try {
      const parsed: unknown = JSON.parse(draft);
      if (!parsed || typeof parsed !== 'object' || !('rungs' in parsed) || !Array.isArray(parsed.rungs)) throw new Error('Missing rungs');
      const candidate = parsed as LadderDocument;
      const validation = validateLadder(candidate);
      if (validation.length) throw new Error(validation.join('; '));
      onChange(clone(candidate)); setMessage('Program imported successfully.');
    } catch (error) { setMessage(`Import rejected: ${error instanceof Error ? error.message : 'Invalid JSON'}`); }
  };
  return <div className="panel"><h2>Editable ladder program</h2><p className="muted">Contacts are evaluated left to right; branch paths are OR conditions. Each rung writes its coil in top-to-bottom order.</p>
    {document.rungs.map((rung, ri) => <div className="ladder-rung" key={rung.id}>
      <div className="topline"><strong>Rung {ri + 1}: {rung.id}</strong><button disabled={ri===0} onClick={() => onChange(moveRung(document,ri,ri-1))} aria-label={`Move rung ${ri+1} up`}>↑ Rung</button><button disabled={ri===document.rungs.length-1} onClick={() => onChange(moveRung(document,ri,ri+1))} aria-label={`Move rung ${ri+1} down`}>↓ Rung</button><button onClick={() => onChange({ ...document, rungs: document.rungs.filter((_, i) => i !== ri) })} disabled={document.rungs.length === 1}>Remove rung</button></div>
      <div className="ladder-elements">{rung.elements.map((element, ei) => element.type === 'contact' ? <div className="ladder-element" key={ei} draggable onDragStart={() => setDragged({rung:ri,element:ei})} onDragEnd={() => setDragged(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged?.rung===ri)onChange(moveElement(document,ri,dragged.element,ei));setDragged(null)}}><span title="Drag to reorder">⠿</span><button disabled={ei===0} onClick={()=>onChange(moveElement(document,ri,ei,ei-1))} aria-label={`Move element ${ei+1} left`}>←</button><button disabled={ei===rung.elements.length-1} onClick={()=>onChange(moveElement(document,ri,ei,ei+1))} aria-label={`Move element ${ei+1} right`}>→</button>
        <select aria-label={`Rung ${ri + 1} contact ${ei + 1} tag`} value={element.tag} onChange={e => editContact(ri, ei, { tag: e.target.value })}>{tagOptions}</select>
        <select aria-label={`Rung ${ri + 1} contact ${ei + 1} type`} value={element.normallyClosed ? 'NC' : 'NO'} onChange={e => editContact(ri, ei, { normallyClosed: e.target.value === 'NC' })}><option>NO</option><option>NC</option></select>
        <button aria-label={`Remove contact ${ei + 1}`} onClick={() => editRung(ri, r => ({ ...r, elements: r.elements.filter((_, i) => i !== ei) }))} disabled={rung.elements.length === 1}>×</button>
      </div> : <div className="ladder-element" key={ei} draggable onDragStart={()=>setDragged({rung:ri,element:ei})} onDragEnd={()=>setDragged(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged?.rung===ri)onChange(moveElement(document,ri,dragged.element,ei));setDragged(null)}}><span title="Drag to reorder">⠿</span><button disabled={ei===0} onClick={()=>onChange(moveElement(document,ri,ei,ei-1))}>←</button><button disabled={ei===rung.elements.length-1} onClick={()=>onChange(moveElement(document,ri,ei,ei+1))}>→</button><div className="branch-paths"><strong>Parallel paths (OR)</strong>{element.alternatives.map((path,pi)=><div className="branch-path" key={pi}><span>Path {pi+1} (AND)</span>{path.map((c,ci)=><span className="branch-contact" key={ci}><select aria-label={`Rung ${ri+1} path ${pi+1} contact ${ci+1} tag`} value={c.tag} onChange={e=>editBranchContact(ri,ei,pi,ci,{tag:e.target.value})}>{tagOptions}</select><select aria-label={`Rung ${ri+1} path ${pi+1} contact ${ci+1} type`} value={c.normallyClosed?'NC':'NO'} onChange={e=>editBranchContact(ri,ei,pi,ci,{normallyClosed:e.target.value==='NC'})}><option>NO</option><option>NC</option></select><button aria-label={`Remove path ${pi+1} contact ${ci+1}`} disabled={path.length===1} onClick={()=>editBranch(ri,ei,paths=>paths.map((p,i)=>i===pi?p.filter((_,j)=>j!==ci):p))}>×</button></span>)}<button onClick={()=>editBranch(ri,ei,paths=>paths.map((p,i)=>i===pi?[...p,{type:'contact',tag:'Start'}]:p))}>+ Series contact</button><button disabled={element.alternatives.length<=2} onClick={()=>editBranch(ri,ei,paths=>paths.filter((_,i)=>i!==pi))}>Remove path</button></div>)}<button onClick={()=>editBranch(ri,ei,paths=>[...paths,[{type:'contact',tag:'Start'}]])}>+ Parallel path</button></div><button onClick={() => editRung(ri, r => ({ ...r, elements: r.elements.filter((_, i) => i !== ei) }))}>×</button></div>)}</div>
      <div className="actions"><label>Instruction <select aria-label={`Rung ${ri + 1} instruction`} value={rung.operation?.kind ?? 'coil'} onChange={e => editRung(ri, r => ({ ...r, operation: e.target.value === 'ton' || e.target.value === 'tof' || e.target.value === 'rto' || e.target.value === 'tp' ? {kind:e.target.value as 'ton'|'tof'|'rto'|'tp',presetMs:1000,...(e.target.value==='rto'?{resetTag:'ResetTimer'}:{})} : e.target.value === 'ctu' ? {kind:'ctu',preset:3,resetTag:'ResetCount'} : e.target.value === 'ctd' ? {kind:'ctd',preset:3,loadTag:'LoadCount'} : e.target.value==='osr'||e.target.value==='osf'?{kind:e.target.value as 'osr'|'osf'}:{kind:'coil'} }))}><option value="coil">Coil</option><option value="ton">TON (on delay)</option><option value="tof">TOF (off delay)</option><option value="rto">RTO (retentive timer)</option><option value="tp">TP (fixed pulse)</option><option value="ctu">CTU (count rising edges)</option><option value="ctd">CTD (load/down counter)</option><option value="osr">OSR (rising-edge pulse)</option><option value="osf">OSF (falling-edge pulse)</option></select></label>{(rung.operation?.kind === 'ton' || rung.operation?.kind === 'tof' || rung.operation?.kind === 'rto' || rung.operation?.kind === 'tp') && <label>Preset ms <input aria-label={`Rung ${ri + 1} timer preset`} type="number" min="1" max="86400000" value={rung.operation.presetMs} onChange={e => editRung(ri,r=>({...r,operation:{...rung.operation!,presetMs:Number(e.target.value)} as typeof rung.operation}))}/></label>}{(rung.operation?.kind === 'ctu' || rung.operation?.kind === 'ctd') && <label>Count preset <input aria-label={`Rung ${ri + 1} counter preset`} type="number" min="1" max="100000000" value={rung.operation.preset} onChange={e => editRung(ri,r=>({...r,operation:{...rung.operation!,preset:Number(e.target.value)}}))}/></label>}{(rung.operation?.kind === 'rto' || rung.operation?.kind === 'ctu') && <label>Reset input <select aria-label={`Rung ${ri+1} reset input`} value={rung.operation.resetTag ?? ''} onChange={e=>editRung(ri,r=>({...r,operation:{...rung.operation!,resetTag:e.target.value||undefined} as typeof rung.operation}))}><option value="">No reset input</option>{availableTags.filter(t=>t!==rung.coil).map(t=><option key={t} value={t}>{t}</option>)}</select></label>}
      {rung.operation?.kind === 'ctd' && <label>Load input <select aria-label={`Rung ${ri+1} load input`} value={rung.operation.loadTag} onChange={e=>editRung(ri,r=>({...r,operation:{...rung.operation!,loadTag:e.target.value} as typeof rung.operation}))}>{availableTags.filter(t=>t!==rung.coil).map(t=><option key={t} value={t}>{t}</option>)}</select></label>}</div>
      <div className="actions"><button onClick={() => onChange(insertElement(document,ri,0,{type:'contact',tag:'Start'}))}>+ Contact at start</button><button onClick={() => editRung(ri, r => ({ ...r, elements: [...r.elements, { type: 'contact', tag: 'Start' }] }))}>+ Contact</button><button onClick={() => editRung(ri, r => ({ ...r, elements: [...r.elements, { type: 'branch', alternatives: [[{ type: 'contact', tag: 'Start' }], [{ type: 'contact', tag: 'RunLatch' }]] }] }))}>+ Start/RunLatch branch</button><label>Coil <select value={rung.coil} onChange={e => editRung(ri, r => ({ ...r, coil: e.target.value }))}>{coilTags.map(tag => <option key={tag}>{tag}</option>)}</select></label></div>
    </div>)}
    <div className="actions"><button onClick={() => onChange({ ...document, rungs: [...document.rungs, { id: `rung-${document.rungs.length + 1}-${document.rungs.map(r => r.id).join('').length}`, elements: [{ type: 'contact', tag: 'Start' }], coil: 'RunLatch' }] })}>+ Add rung</button><button onClick={exportProgram}>Export JSON</button><button onClick={importProgram}>Import JSON</button><button onClick={exportLdXml}>Export PLCopen LD XML</button><label>Import PLCopen LD XML <input type="file" accept=".xml,text/xml,application/xml" aria-label="Import PLCopen LD XML" onChange={importLdXml}/></label></div>
    <p className="muted">PLCopen graphical LD interchange is limited to BOOL NO/NC contacts, series/parallel branches and ordinary coils. Timers, counters, edge instructions, multi-POU programs and vendor-specific elements are rejected. XML loses rung IDs, addresses and symbol descriptions; the complete JSON project remains the lossless format.</p>
    <fieldset><legend>Symbol descriptions (local editor metadata)</legend>
      <div className="actions"><label>New custom signal<input aria-label="New custom PLC tag" value={newSymbolTag} maxLength={80} onChange={e=>setNewSymbolTag(e.target.value)} placeholder="e.g. ConveyorReady"/></label><button onClick={()=>{
       const tag=newSymbolTag.trim();
       if(!/^[A-Za-z][\w.]{0,79}$/.test(tag)){setMessage('New tag must begin with a letter and use up to 80 letters/digits/underscores/dots.');return;}
       if(availableTags.some(t=>t.toUpperCase()===tag.toUpperCase())){setMessage('Tag already exists: '+tag);return;}
       onChange({...document,symbols:{...symbols,[tag]:{description:'Custom PLC tag'}}});
       setSymbolTag(tag);setSymbolDescription('Custom PLC tag');setSymbolAddress('');setNewSymbolTag('');setMessage('Custom tag created; choose it in a contact or coil.');
      }}>Add custom tag</button></div><p className="muted">Descriptions and optional addresses are saved with the program. Addresses are informational until hardware mapping is implemented; they do not change runtime behavior.</p><div className="actions"><select aria-label="Symbol tag" value={symbolTag} onChange={e=>{setSymbolTag(e.target.value);setSymbolDescription(symbols[e.target.value]?.description??'');setSymbolAddress(symbols[e.target.value]?.address??'')}}>{availableTags.map(t=><option key={t}>{t}</option>)}</select><input aria-label="Symbol description" maxLength={80} value={symbolDescription} onChange={e=>setSymbolDescription(e.target.value)} placeholder="e.g. Start pushbutton"/><input aria-label="Symbol address" value={symbolAddress} onChange={e=>setSymbolAddress(e.target.value)} placeholder="e.g. I0.0"/><button onClick={()=>onChange({...document,symbols:{...symbols,[symbolTag]:{description:symbolDescription.trim(),...(symbolAddress.trim()?{address:symbolAddress.trim()}: {})}}})}>Save symbol</button></div><div className="io">{availableTags.map(tag=><div key={tag}><code>{tag}</code><span>{symbols[tag]?.address || '—'} · {symbols[tag]?.description || 'No description'}</span></div>)}</div></fieldset>
    {errors.length > 0 && <p className="warn" role="alert">{errors.join('; ')}</p>}
    <label htmlFor="ladder-json">Program JSON</label><textarea id="ladder-json" rows={5} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Export a program, edit JSON, then import" style={{ width: '100%' }} />
    <p aria-live="polite">{message}</p>
  </div>;
}
