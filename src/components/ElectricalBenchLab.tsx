import React,{useState} from 'react';
import {PATCH_PORTS,initialPatchBench,inspectPatchBench,patchWire,setPatchSupply,setPatchSwitch,setPatchFuse,measurePatchVoltage,measurePatchContinuity,patchEvidenceCsv,
 type PatchPort,type PatchBenchState} from '../engineering/patch-bench';

function saveCsv(state:PatchBenchState){
 const blob=new Blob([patchEvidenceCsv(state)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='plc-electrical-bench-events.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/** Browser-only patch panel; voltages represent ideal conductors, NOT electric safety training. */
export function ElectricalBenchLab(){
 const [bench,setBench]=useState<PatchBenchState>(initialPatchBench);
 const [a,setA]=useState<PatchPort>('PSU-'),[b,setB]=useState<PatchPort>('H1:-');
 const [probeA,setProbeA]=useState<PatchPort>('H1:+'),[probeB,setProbeB]=useState<PatchPort>('H1:-');
 const [mode,setMode]=useState<'voltage'|'continuity'>('voltage');
 const [message,setMessage]=useState('Supply isolated. Reconnect the broken return conductor and test the lamp circuit.');
 const [verified,setVerified]=useState(false);
 const status=inspectPatchBench(bench);
 const apply=(fn:(previous:PatchBenchState)=>PatchBenchState)=>{
  try{
   const next=fn(bench);setBench(next);setVerified(false);
   setMessage(next.events[next.events.length-1]||'Bench state updated.');
  }catch(error){setMessage(String(error));}
 };
 const reading=(()=>{
  try{
   if(mode==='voltage'){const value=measurePatchVoltage(bench,probeA,probeB);return value===null?'FLOATING / UNDEFINED':value.toFixed(1)+' V DC';}
   return measurePatchContinuity(bench,probeA,probeB)?'CONTINUITY':'OPEN CIRCUIT';
  }catch(error){return error instanceof Error?error.message:String(error);}
 })();
 const verify=()=>{
  if(status.lampOn&&!status.trips){setVerified(true);setMessage('Reference lamp circuit energized with valid supply, closed switch, and connected return.');}
  else{setVerified(false);setMessage('Circuit not verified: check supply, fuse, switch, connections and trip history.');}
 };
 return <section className="portal-page patch-lab">
  <span className="eyebrow">24 V DC / SIMULATED ELECTRICAL LAB</span>
  <div className="page-heading"><div><h1>Control wiring and meter bench</h1>
   <p>Patch a simplified DC circuit, test control switch operation, diagnose an open return, and examine the effect of a short circuit. All results are from an idealized graph model.</p></div>
   <button onClick={()=>{setBench(initialPatchBench());setVerified(false);setMessage('New isolated practice circuit loaded.');}}>Reset bench</button></div>
  <div className="workspace"><div>
   <div className="panel"><h2>24 V training panel</h2>
    <div className="patch-devices">
     <div className="patch-device"><b>PSU-1</b><small>24 V isolated DC model</small><strong className={bench.supplyOn?'good':'muted'}>{bench.supplyOn?'ENERGIZED':'ISOLATED'}</strong></div>
     <div className="patch-device"><b>F1</b><small>Simulated protective fuse</small><strong className={bench.fuseClosed?'good':'warn'}>{bench.fuseClosed?'CLOSED':'OPEN'}</strong></div>
     <div className="patch-device"><b>S1</b><small>Control push switch</small><strong>{bench.switchClosed?'CLOSED':'OPEN'}</strong></div>
     <div className={'patch-device '+(status.lampOn?'patch-light-on':'')}><b>H1</b><small>24 V pilot indicator</small><strong>{status.lampOn?'● LIT':'○ DARK'}</strong></div>
    </div>
    <div className="actions">
     <button className={bench.supplyOn?'secondary':'primary'} onClick={()=>apply(s=>setPatchSupply(s,!s.supplyOn))}>{bench.supplyOn?'Isolate supply':'Energize 24 V supply'}</button>
     <button onClick={()=>apply(s=>setPatchSwitch(s,!s.switchClosed))}>{bench.switchClosed?'Open S1':'Close S1'}</button>
     <button disabled={bench.supplyOn||bench.fuseClosed} onClick={()=>apply(s=>setPatchFuse(s,true))}>Reset F1 fuse</button>
     <button onClick={verify}>Verify lamp circuit</button>
    </div>
    <p role="status" className="process-feedback">{message}</p>
    {status.trips>0&&<p className="starter-alarm" role="alert">{status.trips} simulated supply-short protection event(s). Correct the wiring while isolated before resetting F1.</p>}
    {verified&&<p className="good" role="status">✓ Reference operation verified in this session. This is not an electrical safety certificate.</p>}
   </div>
   <div className="panel"><h2>Terminal patch board</h2>
    <p>Patch connections are edited only with the simulated supply isolated. The example starts with three conductors installed and the return to H1 disconnected.</p>
    <div className="patch-ports">{PATCH_PORTS.map(port=><code key={port}>{port}</code>)}</div>
    <div className="patch-edit">
     <label>Terminal A<select aria-label="Patch terminal A" value={a} onChange={e=>setA(e.target.value as PatchPort)}>{PATCH_PORTS.map(p=><option key={p}>{p}</option>)}</select></label>
     <label>Terminal B<select aria-label="Patch terminal B" value={b} onChange={e=>setB(e.target.value as PatchPort)}>{PATCH_PORTS.map(p=><option key={p}>{p}</option>)}</select></label>
     <button disabled={bench.supplyOn||a===b} onClick={()=>apply(s=>patchWire(s,a,b,true))}>Connect wire</button>
    </div>
    <h3>Installed conductors ({bench.links.length})</h3>
    <div className="patch-wires">{bench.links.map(([x,y])=><div key={[x,y].sort().join('|')}><code>{x} ↔ {y}</code>
     <button disabled={bench.supplyOn} aria-label={'Disconnect '+x+' from '+y} onClick={()=>apply(s=>patchWire(s,x,y,false))}>Disconnect</button>
    </div>)}</div>
   </div>
   <div className="panel"><div className="topline"><h2>Simulated event evidence</h2><button onClick={()=>saveCsv(bench)}>Export CSV</button></div>
    <div className="log">{bench.events.slice(-20).map((event,i)=><p key={i}>{event}</p>)}</div>
   </div>
  </div><aside>
   <div className="panel"><h2>Virtual meter</h2>
    <label>Measurement mode<select aria-label="Meter mode" value={mode} onChange={e=>setMode(e.target.value as 'voltage'|'continuity')}>
     <option value="voltage">DC volts</option><option value="continuity">Continuity (supply isolated)</option></select></label>
    <div className="patch-edit">
     <label>Red probe<select aria-label="Red probe" value={probeA} onChange={e=>setProbeA(e.target.value as PatchPort)}>{PATCH_PORTS.map(p=><option key={p}>{p}</option>)}</select></label>
     <label>Black probe<select aria-label="Black probe" value={probeB} onChange={e=>setProbeB(e.target.value as PatchPort)}>{PATCH_PORTS.map(p=><option key={p}>{p}</option>)}</select></label></div>
    <div className="patch-meter" role="status" aria-live="polite">{reading}</div>
    <p className="muted">Ideal voltages are derived from graph reachability. Floating potentials are reported as undefined, not guessed. Continuity covers ideal wires and closed switches only and is disabled while energized.</p>
   </div>
   <div className="panel"><h2>Guide · open-return fault</h2>
    <ol><li>Keep simulated supply isolated.</li><li>Measure continuity through the fuse and identify the disconnected return.</li>
    <li>Connect <code>H1:-</code> to <code>PSU-</code>.</li><li>Close S1, energize supply, and observe H1.</li>
    <li>Measure simulated voltage across H1, then switch off and isolate.</li><li>Export an event log for review.</li></ol>
   </div>
   <div className="panel"><h2>Evidence and limitations</h2>
    <p>Supply trips are instructional abstractions. F1, S1, H1 and an ideal 24 V source do not represent real source impedance, capacitance, current flow, heat, electric shock or arc-flash risks.</p>
    <p className="muted">This is a local frontend exercise. No account, cloud service or permanent server record.</p>
   </div>
  </aside></div>
 </section>;
}
