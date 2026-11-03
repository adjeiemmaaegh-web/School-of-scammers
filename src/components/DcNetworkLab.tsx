import React,{useMemo,useState} from 'react';
import {DC_PRESETS,circuitPreset,addCircuitPart,updateCircuitPart,removeCircuitPart,addCircuitNode,removeCircuitNode,analyzeCircuit,measureDcVoltage,measureDcContinuity,dcReadingsCsv,serializeCircuit,parseCircuit,persistDc,readDc,restoreDc,
 type DcCircuit,type DcKind,type DcPreset,type DcPart} from '../engineering/dc-network';
import './dc-network-lab.css';
function download(name:string,text:string,type:string){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const exampleNames:Record<DcPreset,string>={divider:'Series voltage divider',parallel:'Parallel loads',bridge:'Balanced bridge network',open:'Open return circuit',short:'Direct supply short'};
const typeNames:Record<DcKind,string>={resistor:'Resistor',switch:'Isolating switch',wire:'Ideal conductor'};
const makeInitial=()=>{
 if(typeof window==='undefined')return {circuit:circuitPreset(),source:'default' as const,warning:null};
 return readDc(window.localStorage);
};
export function DcNetworkLab(){
 const [start]=useState(makeInitial);
 const [dc,setDc]=useState<DcCircuit>(start.circuit);
 const [powered,setPowered]=useState(false);
 const [source,setSource]=useState<'primary'|'recovery'|'default'>(start.source);
 const [notice,setNotice]=useState(start.warning??'Supply isolated. Select a reference circuit or edit nodes and components, then energize and measure.');
 const [kind,setKind]=useState<DcKind>('resistor');
 const [a,setA]=useState('P24'),[b,setB]=useState('GND');
 const [ohms,setOhms]=useState('1000'),[closed,setClosed]=useState(true);
 const [probeA,setProbeA]=useState('P24'),[probeB,setProbeB]=useState('GND');
 const [meter,setMeter]=useState<'voltage'|'continuity'>('voltage');
 const [logs,setLogs]=useState<string[]>([]);
 const report=useMemo(()=>analyzeCircuit(dc),[dc]);
 const log=(s:string)=>setLogs(old=>[...old.slice(-199),s]);
 const commit=(next:DcCircuit,info:string)=>{
  if(powered){setNotice('Isolate the simulated supply before editing.');return;}
  try{
   setDc(next);setNotice(info);
   try{persistDc(window.localStorage,next);setSource('primary');log(info);}
   catch(e){setNotice(info+' — LOCAL SAVE BLOCKED: '+String(e)+'; export the circuit JSON to preserve your changes.');}
  }catch(e){setNotice('Circuit update rejected: '+String(e));}
 };
 const edit=(fn:()=>DcCircuit,message:string)=>{if(powered){setNotice('Isolate supply before changing circuit elements.');return;}try{commit(fn(),message)}catch(e){setNotice('Circuit update rejected: '+String(e));}};
 const preset=(name:DcPreset)=>edit(()=>circuitPreset(name),'Loaded '+exampleNames[name]+' exercise (supply isolated).');
 const togglePower=()=>{
  if(!powered&&report.shortCircuit){setNotice('Cannot energize: ideal source short detected. Remove the fault under isolation.');log('Energization BLOCKED: ideal supply short');return;}
  setPowered(!powered);setNotice(powered?'Simulated supply isolated. Circuit can now be edited and continuity can be measured.':'Simulated 24 V supply energized. Edit controls are locked until isolation.');log(powered?'SUPPLY ISOLATED':'SUPPLY ENERGIZED');
 };
 const newPart=()=>{
  const name=(kind==='resistor'?'R':kind==='switch'?'S':'W');
  let n=1;while(dc.parts.some(p=>p.id===name+n))n++;
  const part:DcPart={id:name+n,kind,a,b,...(kind==='resistor'?{ohms:Number(ohms)}:{}),...(kind==='switch'?{closed}:{})};
  edit(()=>addCircuitPart(dc,part),'Connected '+part.id+' from '+a+' to '+b+'.');
 };
 const toggleSwitch=(part:DcPart)=>edit(()=>updateCircuitPart(dc,part.id,{closed:!part.closed}),part.id+' '+(part.closed?'OPENED':'CLOSED'));
 const changeResistance=(part:DcPart,newOhms:string)=>edit(()=>updateCircuitPart(dc,part.id,{ohms:Number(newOhms)}),'Adjusted '+part.id+' to '+newOhms+' Ω.');
 const importCircuit=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const f=event.target.files?.[0];event.target.value='';
  if(!f)return;if(powered){setNotice('Isolate supply before importing a circuit.');return;}
  try{if(f.size>30000)throw RangeError('Circuit import exceeds 30 KB');
   const loaded=parseCircuit(await f.text());commit(loaded,'Validated DC circuit imported.');
  }catch(e){setNotice('Import rejected: '+String(e));}
 };
 const restore=()=>{
  if(powered){setNotice('Isolate supply before restoring.');return;}
  if(!window.confirm('Restore the last valid saved circuit? Export unsaved edits before replacing them.'))return;
  try{const restored=restoreDc(window.localStorage);setDc(restored);setSource('primary');setNotice('Recovered circuit; original damaged bytes retained separately.');log('Restored validated DC circuit from recovery.');}
  catch(e){setNotice('Recovery failed: '+String(e));}
 };
 const measured=()=>{
  if(meter==='voltage'){
   if(!powered)return 'SUPPLY ISOLATED';
   const value=measureDcVoltage(report,probeA,probeB);
   return value===null?'FLOATING / UNDEFINED':value.toFixed(3)+' V DC';
  }
  if(powered)return 'ISOLATE SUPPLY FIRST';
  return measureDcContinuity(dc,probeA,probeB)?'CONTINUITY (ideal)':'OPEN / RESISTIVE PATH';
 };
 return <section className="portal-page dc-lab">
  <span className="eyebrow">ELECTRICAL SIMULATION / DETERMINISTIC DC NODAL ANALYSIS</span>
  <div className="page-heading"><div><h1>DC circuit engineering studio</h1>
   <p>Build a small resistor network with open/closed switches and ideal conductors. Measure node voltage, component voltage drop, branch current and power using a bounded 24 V nodal solver.</p></div>
   <div className="actions"><button onClick={()=>download('plc-dc-circuit.json',serializeCircuit(dc),'application/json;charset=utf-8')}>Export circuit JSON</button>
    <label className="dc-import">Import circuit JSON<input type="file" accept=".json,application/json" onChange={importCircuit}/></label></div>
  </div>
  <p className="muted">This idealized direct-current resistive model is educational only: no transient behavior, AC, component tolerances, temperature, arcing, shock, protective-device trip timing or certified electrical safety.</p>
  <div className="metric-grid">
   <div className="metric"><b>{powered?'24.0 V':'ISOLATED'}</b><span>Ideal DC source</span></div>
   <div className="metric"><b>{report.shortCircuit?'SHORT':powered&&report.sourceCurrentA!==null?(report.sourceCurrentA*1000).toFixed(3)+' mA':'—'}</b><span>Source current (ideal)</span></div>
   <div className="metric"><b>{powered&&report.sourcePowerW!==null?report.sourcePowerW.toFixed(3)+' W':'—'}</b><span>Delivered DC power</span></div>
   <div className="metric"><b>{dc.parts.length} / 40</b><span>Installed components</span></div>
  </div>
  <div className="workspace"><div>
   <div className="panel"><div className="topline"><h2>Reference experiments</h2><button className={powered?'secondary':'primary'} onClick={togglePower}>{powered?'Isolate 24 V supply':'Energize 24 V supply'}</button></div>
    <div className="actions">{DC_PRESETS.map(name=><button disabled={powered} key={name} onClick={()=>preset(name)}>{exampleNames[name]}</button>)}</div>
    {report.shortCircuit&&<p role="alert" className="starter-alarm">IDEAL SOURCE SHORT DETECTED — simulated supply cannot be energized. Remove direct high-to-ground wiring.</p>}
    {report.overcurrent&&!report.shortCircuit&&<p role="alert" className="starter-alarm">Educational overcurrent warning: theoretical source current exceeds 2 A. Isolate and inspect resistor values.</p>}
    <p role="status" className="process-feedback">{notice}</p>
    <div className="dc-schematic" role="img" aria-label={'Simplified node and component diagram with '+dc.nodes.length+' nodes and '+dc.parts.length+' components'}>
     <div className="dc-rail"><strong>P24</strong><span>+24 V</span></div>
     <div className="dc-schematic-branches">
      {dc.parts.length?dc.parts.map(part=><div className="dc-schematic-part" key={part.id}>
       <code>{part.a}</code><span className="dc-branch-line"/>
       <strong>{part.id} · {part.kind==='resistor'?part.ohms+' Ω':part.kind==='switch'?(part.closed?'CLOSED':'OPEN'):'WIRE'}</strong>
       <span className="dc-branch-line"/><code>{part.b}</code>
      </div>):<p>No circuit elements installed</p>}
     </div><div className="dc-rail ground"><strong>GND</strong><span>0 V</span></div>
    </div>
    <p className="muted">A connectivity list, not a true scaled electrical schematic. Components can connect any two selected nodes, forming series, parallel or bridge networks.</p>
   </div>
   <div className="panel"><h2>Component workbench</h2>
    <p className="muted">Edits are blocked while the virtual supply is on. Ideal wires or closed switches connect nodes without resistance; resistors carry modeled DC current.</p>
    <div className="dc-part-editor">
     <label>Part type<select aria-label="DC part type" value={kind} disabled={powered} onChange={e=>setKind(e.target.value as DcKind)}>{(['resistor','switch','wire'] as const).map(v=><option key={v} value={v}>{typeNames[v]}</option>)}</select></label>
     <label>Node A<select aria-label="DC component node A" value={a} disabled={powered} onChange={e=>setA(e.target.value)}>{dc.nodes.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     <label>Node B<select aria-label="DC component node B" value={b} disabled={powered} onChange={e=>setB(e.target.value)}>{dc.nodes.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     {kind==='resistor'&&<label>Resistance Ω<input aria-label="DC resistance ohms" type="number" min="1" max="1000000" step="1" value={ohms} onChange={e=>setOhms(e.target.value)} disabled={powered}/></label>}
     {kind==='switch'&&<label><input type="checkbox" checked={closed} disabled={powered} onChange={e=>setClosed(e.target.checked)}/> Initially closed</label>}
     <button disabled={powered||a===b||dc.parts.length>=40} onClick={newPart}>Add component</button>
     <button disabled={powered||dc.nodes.length>=12} onClick={()=>edit(()=>addCircuitNode(dc),'Added new intermediate circuit node.')}>Add node</button>
    </div>
    <div className="dc-table-wrap"><table><thead><tr><th>Part / terminals</th><th>Model</th><th>V drop</th><th>DC current</th><th>Power</th><th>Actions (isolated)</th></tr></thead><tbody>{dc.parts.map((part,i)=>{const row=report.readings[i];return <tr key={part.id}>
     <td><strong>{part.id}</strong><small>{part.a} → {part.b}</small></td>
     <td>{part.kind==='resistor'?part.ohms+' Ω':part.kind==='switch'?(part.closed?'CLOSED':'OPEN'):'WIRE'}</td>
     <td>{powered&&row.voltageV!==null?row.voltageV.toFixed(3)+' V':'—'}</td>
     <td>{powered&&row.currentA!==null?(row.currentA*1000).toFixed(3)+' mA':'—'}</td>
     <td>{powered&&row.powerW!==null?row.powerW.toFixed(3)+' W':'—'}</td>
     <td>{part.kind==='switch'&&<button disabled={powered} onClick={()=>toggleSwitch(part)}>{part.closed?'Open':'Close'} {part.id}</button>}
      {part.kind==='resistor'&&<button disabled={powered} onClick={()=>{const answer=window.prompt('Enter new resistance in ohms (1–1,000,000)',String(part.ohms));if(answer!==null)changeResistance(part,answer);}}>Edit Ω</button>}
      <button disabled={powered} onClick={()=>edit(()=>removeCircuitPart(dc,part.id),'Removed '+part.id+'.')}>Remove</button></td>
    </tr>})}</tbody></table></div>
   </div>
   <div className="panel"><div className="topline"><h2>Electrical evidence</h2><button onClick={()=>download('plc-dc-analysis.csv',dcReadingsCsv(dc,report),'text/csv;charset=utf-8')}>Export branch CSV</button></div>
    <div className="log">{logs.length?logs.slice(-18).map((x,i)=><p key={i}>{x}</p>):<p>No actions recorded in this session.</p>}</div>
   </div>
  </div><aside>
   <div className="panel"><h2>Virtual digital multimeter</h2>
    <label>Function<select aria-label="DC meter function" value={meter} onChange={e=>setMeter(e.target.value as 'voltage'|'continuity')}>
     <option value="voltage">DC voltage</option><option value="continuity">Continuity (isolated)</option></select></label>
    <label>Red probe<select aria-label="DC red probe" value={probeA} onChange={e=>setProbeA(e.target.value)}>{dc.nodes.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <label>Black probe<select aria-label="DC black probe" value={probeB} onChange={e=>setProbeB(e.target.value)}>{dc.nodes.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <div role="status" className="dc-meter" aria-live="polite">{measured()}</div>
    <p className="muted">Red minus black. Floating nodes have undefined absolute voltage; unknown readings are never substituted with 0 V. Continuity measures ideal conductors and closed switch contacts only.</p>
   </div>
   <div className="panel"><h2>Node voltages</h2>
    <div className="dc-node-list">{dc.nodes.map(n=><div key={n}><code>{n}</code><strong>{powered?report.volts[n]===null?'FLOATING':report.volts[n]?.toFixed(3)+' V':'ISOLATED'}</strong>
     {n!=='P24'&&n!=='GND'&&<button disabled={powered} onClick={()=>{edit(()=>removeCircuitNode(dc,n),'Removed '+n+' and its connected elements.');if(a===n)setA('P24');if(b===n)setB('GND');if(probeA===n)setProbeA('P24');if(probeB===n)setProbeB('GND');}}>Remove</button>}</div>)}</div>
    <h3>Diagnostic summary</h3>{report.diagnostics.length?report.diagnostics.map(d=><p key={d} className="warn">{d}</p>):<p className="good">No ideal-source or floating-node diagnostics.</p>}
   </div>
   <div className="panel"><h2>Commissioning challenge</h2>
    <ol><li>Select the <b>series voltage divider</b> experiment.</li><li>With supply isolated, measure continuity through the ideal paths, then energize.</li>
     <li>Measure <code>N1</code> relative to <code>GND</code>. Expect <b>12.000 V</b>.</li>
     <li>Read each 1 kΩ resistor current: expect <b>12.000 mA</b>.</li>
     <li>Compare with the parallel-load example and the balanced bridge.</li>
     <li>Isolate the supply, select the direct short, and verify energization is refused.</li></ol>
    <p className="muted">The challenge teaches ideal DC Kirchhoff/nodal reasoning; do not use these figures to rate real breakers, fuses or conductors.</p>
   </div>
   <div className="panel"><h2>Local project integrity</h2>
    <p>{source==='recovery'?'Recovered read-only fallback loaded. Export JSON before attempting overwrite.':'Validated JSON schema, bounded nodes and parts, local revision backup.'}</p>
    {source==='recovery'&&<button disabled={powered} onClick={restore}>Restore last valid circuit</button>}
    <p className="muted">No account, database or external machine control. Browser storage can be cleared; export your scene for independent backup.</p>
   </div>
  </aside></div>
 </section>;
}
