import React,{useMemo,useState} from 'react';
import {STARTER_INPUTS,initialStarter,stepStarDelta,starterSample,starterCsv,injectStarterFault,
 type StarterFault,type StarterInputs,type StarterSample,type StarterState} from '../engineering/star-delta';

function exportCsv(rows:readonly StarterSample[]){
 const blob=new Blob([starterCsv(rows)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='plc-star-delta-evidence.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function coil(label:string,command:boolean,feedback:boolean){
 return <div className={'starter-coil '+(feedback?'energized':'')} key={label}>
  <strong>{label}</strong><span>Coil: {command?'ON':'OFF'}</span><small>Auxiliary feedback: {feedback?'CLOSED':'OPEN'}</small>
 </div>;
}
/** Simulated control-state exercise, not a physical motor starter or wiring procedure. */
export function StarDeltaLab(){
 const [model,setModel]=useState<StarterState>(initialStarter);
 const [signals,setSignals]=useState<StarterInputs>(STARTER_INPUTS);
 const [records,setRecords]=useState<StarterSample[]>([]);
 const [notice,setNotice]=useState('Energize the simulated supply, then operate START and advance the scan clock.');
 const [showHints,setShowHints]=useState(true);
 const current=starterSample(model);
 const isIsolated=!signals.supplyOn;
 const review=useMemo(()=>{
  const phases=new Set(records.map(r=>r.phase));
  const overlap=records.some(r=>r.star&&r.delta);
  const faultHazard=records.some(r=>r.hazard);
  const stopped=records.some((r,i)=>i>0&&r.phase==='idle'&&records[i-1].phase!=='idle');
  return {phases,overlap,faultHazard,stopped,passed:phases.has('star')&&phases.has('deadtime')&&phases.has('delta')&&stopped&&!overlap&&!faultHazard};
 },[records]);
 const update=(key:keyof StarterInputs,value:boolean)=>{
  setSignals(previous=>{
   const next={...previous,[key]:value};
   if(key==='supplyOn'&&!value){
    setModel(s=>stepStarDelta(s,next,100));
    setNotice('Simulated supply isolated. Changes to fault condition can now be made.');
   }
   return next;
  });
 };
 const advance=(scans:number,overrides?:StarterInputs)=>{
  const input=overrides??signals;
  let next=model;const addition:StarterSample[]=[];
  try{
   for(let n=0;n<scans;n++){next=stepStarDelta(next,input,100);addition.push(starterSample(next));}
   setModel(next);setRecords(rows=>[...rows,...addition].slice(-3000));
   setNotice(next.hazard?'Hazardous contactor feedback detected. Simulate isolation and repair before restart.':next.message);
  }catch(error){setNotice(String(error));}
 };
 const pulse=(key:'start'|'stop'|'reset')=>{
  const active={...signals,[key]:true};
  advance(1,active);
 };
 const faultChange=(f:StarterFault)=>{
  try{const next=injectStarterFault(model,f,isIsolated);setModel(next);setNotice(next.message);}
  catch(error){setNotice(String(error));}
 };
 const restart=()=>{setModel(initialStarter());setSignals(STARTER_INPUTS);setRecords([]);setNotice('Exercise reset. No attempt is stored on a server.');};
 const demonstration=()=>{
  try{
   const input={...STARTER_INPUTS};let s=initialStarter();const rows:StarterSample[]=[];
   const run=(i:StarterInputs,count:number)=>{for(let n=0;n<count;n++){s=stepStarDelta(s,i,100);rows.push(starterSample(s));}};
   run({...input,start:true},1);run(input,40);run({...input,stop:true},1);
   setModel(s);setSignals(input);setRecords(rows);setNotice('Reference demonstration complete: STAR, transition gap, DELTA, STOP. Inspect the recorded timing.');
  }catch(error){setNotice(String(error));}
 };
 return <section className="portal-page starter-lab">
  <span className="eyebrow">CONTROL SYSTEMS / EDUCATIONAL SIMULATION</span>
  <div className="page-heading"><div><h1>Star–delta motor starting</h1>
   <p>Practice a three-contactor starting sequence with a simulated transition delay, permissives, mechanical feedback and injected defects. Control and contacts are simplified models, not power-wiring instructions.</p></div>
   <button onClick={restart}>Reset exercise</button>
  </div>
  <div className="metric-grid">
   <div className="metric"><b>{current.phase.toUpperCase()}</b><span>Current state</span></div>
   <div className="metric"><b>{model.timeMs/1000} s</b><span>Simulated elapsed time</span></div>
   <div className="metric"><b>{model.speedPercent.toFixed(0)}%</b><span>Illustrative motor speed</span></div>
   <div className="metric"><b>{records.length}</b><span>Recorded scans</span></div>
  </div>
  <div className="workspace">
   <div>
    <div className="panel">
     <h2>Motor starter / control cabinet</h2>
     <div className="starter-control-diagram" aria-label="Simulated starter contactor indicators">
      {coil('KM1 MAIN',current.main,current.main)}
      {coil('KM2 STAR',current.star,current.starFeedback)}
      {coil('KM3 DELTA',current.delta,current.deltaFeedback)}
     </div>
     <p className="muted">Control-state model: STAR and DELTA commands are never allowed simultaneously. Welded auxiliary feedback can remain closed after coil de-energization. This cannot establish real contactor electrical isolation.</p>
     {current.hazard&&<p className="starter-alarm" role="alert">HAZARDOUS FEEDBACK — isolate the simulated supply and clear the fault before restarting.</p>}
     <div className="starter-progress"><div style={{width:model.speedPercent+'%'}}/></div>
     <div className="actions">
      <button className="primary" onClick={()=>pulse('start')} disabled={isIsolated}>Press START</button>
      <button onClick={()=>pulse('stop')}>Press STOP</button>
      <button onClick={()=>pulse('reset')} disabled={isIsolated}>Reset trip</button>
      <button onClick={()=>advance(1)} disabled={isIsolated}>Advance 100 ms</button>
      <button onClick={()=>advance(10)} disabled={isIsolated}>Advance 1 s</button>
      <button onClick={demonstration}>Run reference sequence</button>
     </div>
     <p className="process-feedback" role="status">{notice}</p>
    </div>
    <div className="panel">
     <div className="topline"><h2>PLC scan timeline</h2><button disabled={!records.length} onClick={()=>exportCsv(records)}>Export timing CSV</button></div>
     <p className="muted">Latest 18 retained scans are displayed. Export includes up to 3,000 captured scans, without silently inventing earlier history.</p>
     <div className="starter-table-wrap"><table><thead><tr><th>Time</th><th>State</th><th>Main</th><th>Star</th><th>Delta</th><th>Feedback</th><th>Message</th></tr></thead>
      <tbody>{records.slice(-18).map((r,i)=><tr key={r.timeMs+'-'+i}><td>{r.timeMs} ms</td><td>{r.phase}</td><td>{r.main?'ON':'OFF'}</td><td>{r.star?'ON':'OFF'}</td><td>{r.delta?'ON':'OFF'}</td><td>{r.starFeedback?'STAR ':''}{r.deltaFeedback?'DELTA':''}</td><td>{r.hazard?'⚠ ':''}{r.message}</td></tr>)}</tbody></table></div>
     {!records.length&&<p>No scans captured. Press START and advance the clock.</p>}
    </div>
    <div className="panel">
     <h2>Commissioning exercise review</h2>
     <p>{review.passed?'REFERENCE SEQUENCE OBSERVED':'Not yet complete'}. This checklist checks the recorded exercise only; it is not an independently reviewed or certified acceptance test.</p>
     <ul><li>STAR phase captured: {review.phases.has('star')?'Yes':'No'}</li>
      <li>Dead-time transition captured: {review.phases.has('deadtime')?'Yes':'No'}</li>
      <li>DELTA phase captured: {review.phases.has('delta')?'Yes':'No'}</li>
      <li>STOP from an active phase: {review.stopped?'Yes':'No'}</li>
      <li>Command overlap: {review.overlap?'DETECTED':'Not observed'}</li>
      <li>Hazardous feedback: {review.faultHazard?'DETECTED':'Not observed'}</li></ul>
    </div>
   </div>
   <aside>
    <div className="panel">
     <h2>Simulated protection / permissives</h2>
     {([['supplyOn','Control supply energized'],['estopOk','E-stop permissive healthy'],['guardClosed','Guard closed'],['overloadOk','Overload healthy']] as const).map(([key,label])=>
      <label className="starter-check" key={key}><input type="checkbox" checked={signals[key]} onChange={e=>update(key,e.target.checked)}/> {label}</label>)}
     <p className="muted">Switching off supply interrupts the active simulation. Defect changes require isolation and a stopped or tripped state.</p>
    </div>
    <div className="panel"><h2>Fault injection</h2>
     <label>Simulated fault
      <select aria-label="Star-delta fault" value={model.fault} disabled={!isIsolated} onChange={e=>faultChange(e.target.value as StarterFault)}>
       <option value="none">Healthy (repair)</option>
       <option value="star-welded">KM2 star contact welded</option>
       <option value="delta-welded">KM3 delta contact welded</option>
       <option value="timer-stuck">Transition relay stuck</option>
       <option value="overload-trip">Overload trip</option>
      </select>
     </label>
     <p className="muted">Experiment: isolate power, inject a stuck STAR contact, restore supply and start the sequence. Observe why DELTA is blocked.</p>
    </div>
    <div className="panel"><h2>Learning guidance</h2>
     <button onClick={()=>setShowHints(v=>!v)} aria-expanded={showHints}>{showHints?'Hide':'Show'} guidance</button>
     {showHints&&<ol><li>Verify control supply, E-stop, guard and overload permissives.</li>
     <li>Start the motor, inspect KM1 and KM2 feedback.</li>
     <li>Advance four seconds and find the interval with neither STAR nor DELTA.</li>
     <li>Verify DELTA without a simultaneous STAR command.</li>
     <li>Stop, isolate power and investigate simulated contact faults.</li></ol>}
    </div>
   </aside>
  </div>
  <p className="muted">Safety note: this exercise represents only a control-state sequence. It does not model three-phase wiring, arc energy, motor current, safe torque-off, protective device coordination or formal industrial certification.</p>
 </section>;
}
