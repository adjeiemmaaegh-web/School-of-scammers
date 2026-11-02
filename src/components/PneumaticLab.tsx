import React,{useState} from 'react';
import {DEFAULT_PNEUMATIC_INPUT,initialPneumatic,stepPneumatic,pneumaticSample,pneumaticCsv,evaluateCylinderCycle,PNEUMATIC_FAULTS,type PneumaticInput,type PneumaticFault,type PneumaticTrace,type PneumaticState} from '../engineering/pneumatic-cylinder';
function csv(rows:readonly PneumaticTrace[]){const blob=new Blob([pneumaticCsv(rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='plc-pneumatic-commissioning.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function PneumaticLab(){
 const [inputs,setInputs]=useState<PneumaticInput>(DEFAULT_PNEUMATIC_INPUT);
 const [model,setModel]=useState<PneumaticState>(initialPneumatic);
 const [rows,setRows]=useState<PneumaticTrace[]>([]);
 const [notice,setNotice]=useState('Start with air available and guard closed. Extend, retract and verify both limit switches.');
 const report=evaluateCylinderCycle(rows);
 const isolate=!inputs.airOn;
 const change=(p:Partial<PneumaticInput>)=>setInputs(s=>({...s,...p}));
 const run=(command:PneumaticInput['command'],scans=1)=>{
  try{
   const input={...inputs,command};
   let s=model;const updates:PneumaticTrace[]=[];
   for(let i=0;i<scans;i++){s=stepPneumatic(s,input,100);updates.push(pneumaticSample(s));}
   setModel(s);setRows(old=>[...old,...updates].slice(-3000));change({command});
   setNotice(s.alarm??(s.extendLimit?'At extended limit.':s.retractLimit?'At retracted limit.':'Cylinder in transit.'));
  }catch(error){setNotice(String(error));}
 };
 const reset=()=>{setInputs(DEFAULT_PNEUMATIC_INPUT);setModel(initialPneumatic());setRows([]);setNotice('New commissioning exercise.');};
 const reference=()=>{
  try{
   let s=initialPneumatic();const samples:PneumaticTrace[]=[];
   for(const [command,scans] of [['extend',13],['neutral',2],['retract',11],['neutral',1]] as const){
    for(let i=0;i<scans;i++){s=stepPneumatic(s,{...DEFAULT_PNEUMATIC_INPUT,command},100);samples.push(pneumaticSample(s));}
   }
   setModel(s);setRows(samples);setInputs(DEFAULT_PNEUMATIC_INPUT);setNotice('Reference demonstration: full extension, neutral valve, full retraction and isolated output commands.');
  }catch(error){setNotice(String(error));}
 };
 return <section className="portal-page">
 <span className="eyebrow">MACHINE COMMISSIONING / SIMULATED PNEUMATICS</span>
 <div className="page-heading"><div><h1>Pneumatic cylinder commissioning</h1><p>Operate an idealized double-acting cylinder with a 5/3 spring-centred valve, two limit switches, emergency/guard permissives, air isolation, fault injection and timed PLC evidence.</p></div><button onClick={reset}>Reset exercise</button></div>
 <div className="metric-grid">
  <div className="metric"><b>{(model.position*100).toFixed(1)}%</b><span>Rod extension</span></div>
  <div className="metric"><b>{model.pressureBar.toFixed(1)} bar</b><span>Illustrative supply pressure</span></div>
  <div className="metric"><b>{model.extendLimit?'ON':'OFF'} / {model.retractLimit?'ON':'OFF'}</b><span>Extended / retracted switches</span></div>
  <div className="metric"><b>{rows.length}</b><span>Retained PLC scans</span></div>
 </div>
 <div className="workspace"><div>
  <div className="panel"><h2>Double-acting actuator / CY-101</h2>
   <svg viewBox="0 0 640 235" role="img" aria-label={'Cylinder '+(model.position*100).toFixed(1)+' percent extended; '+model.pressureBar+' bar pressure'} style={{width:'100%',background:'#0d2030',borderRadius:12}}>
    <rect x="78" y="75" width="350" height="90" rx="12" fill="#18374d" stroke="#95b3c9" strokeWidth="5"/>
    <rect x={90+310*model.position} y="81" width="20" height="78" rx="5" fill="#6fd9c2"/>
    <rect x={110+310*model.position} y="112" width={350-310*model.position} height="16" rx="4" fill="#c6d7e6"/>
    <rect x="428" y="110" width="100" height="20" rx="5" fill="#c6d7e6"/>
    <circle cx="78" cy="120" r="13" fill={model.retractLimit?'#4ce0b5':'#63788c'}/><circle cx="428" cy="120" r="13" fill={model.extendLimit?'#4ce0b5':'#63788c'}/>
    <path d="M120 164 V205 H245 M380 164 V205 H300" fill="none" stroke="#a0d7f0" strokeWidth="6"/>
    <rect x="245" y="183" width="55" height="43" rx="5" stroke="#b4d3e4" fill={model.extendCoil||model.retractCoil?'#1a836d':'#29425c'}/>
    <text x="275" y="208" fill="white" fontSize="12" textAnchor="middle">5/3</text>
    <text x="85" y="52" fill="#bed9e8" fontSize="15">RETRACT</text><text x="365" y="52" fill="#bed9e8" fontSize="15">EXTEND</text>
   </svg>
   <div className="actions"><button className="primary" onClick={()=>run('extend',1)}>EXTEND / 100 ms</button><button onClick={()=>run('retract',1)}>RETRACT / 100 ms</button><button onClick={()=>run('neutral',1)}>CENTRE VALVE</button><button onClick={()=>run(inputs.command,10)}>Advance 1 s</button><button onClick={reference}>Reference commissioning sequence</button></div>
   <p role="status" className="process-feedback">{notice}</p>{model.alarm&&<p className="starter-alarm" role="alert">{model.alarm}</p>}
   <p className="muted">The commanded valve is de-energized when the guard opens or E-stop is active. Real pneumatic stopping behavior depends on stored pressure, mechanical design and risk assessment; this simulation cannot certify machine safety.</p>
  </div>
  <div className="panel"><div className="topline"><h2>Recorded scan evidence</h2><button disabled={!rows.length} onClick={()=>csv(rows)}>Export CSV</button></div>
   <div className="starter-table-wrap"><table><thead><tr><th>ms</th><th>Position</th><th>Valve</th><th>Y1</th><th>Y2</th><th>Ext</th><th>Ret</th><th>Alarm</th></tr></thead><tbody>{rows.slice(-14).map((r,i)=><tr key={i}><td>{r.timeMs}</td><td>{(r.position*100).toFixed(1)}%</td><td>{r.command}</td><td>{r.extendCoil?'1':'0'}</td><td>{r.retractCoil?'1':'0'}</td><td>{r.extended?'1':'0'}</td><td>{r.retracted?'1':'0'}</td><td>{r.alarm||'—'}</td></tr>)}</tbody></table></div>
   <p className="muted">CSV contains at most 3,000 retained simulated scans. Actual PLC/hardware timestamps are not claimed.</p>
  </div>
 </div><aside><div className="panel"><h2>Fault injection and permissives</h2>
  <label style={{display:'block'}}>Fault<select aria-label="Pneumatic fault" value={inputs.fault} disabled={!isolate} onChange={e=>change({fault:e.target.value as PneumaticFault})}>{PNEUMATIC_FAULTS.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
  <p className="muted">Isolate simulated air to change failure modes.</p>
  <label style={{display:'block'}}><input type="checkbox" checked={inputs.airOn} onChange={e=>change({airOn:e.target.checked})}/> Air supply ON</label>
  <label style={{display:'block'}}><input type="checkbox" checked={inputs.guardClosed} onChange={e=>change({guardClosed:e.target.checked})}/> Guard CLOSED</label>
  <label style={{display:'block'}}><input type="checkbox" checked={inputs.emergencyStop} onChange={e=>change({emergencyStop:e.target.checked})}/> E-stop ACTIVE</label>
  <button onClick={()=>{change({resetAlarm:true,command:'neutral'});try{const s=stepPneumatic(model,{...inputs,command:'neutral',resetAlarm:true},100);setModel(s);setRows(old=>[...old,pneumaticSample(s)].slice(-3000));setNotice(s.alarm??'Alarm reset under neutral command.');}catch(e){setNotice(String(e));}change({resetAlarm:false,command:'neutral'});}}>Reset alarm (valve neutral)</button>
 </div><div className="panel"><h2>Factory acceptance checklist</h2>
  <p className={report.passed?'good':'warn'}>{report.passed?'PASS — demonstrated extension and retraction without alarms':'NOT YET PASSED'}</p>
  {report.reasons.map(s=><p key={s} className="muted">• {s}</p>)}
  <p className="muted">Success requires both valve commands and end-position feedback after extension and return. This is simulated acceptance only.</p>
  <h3>Event trace</h3><div className="log">{model.events.slice(-12).map((x,i)=><p key={i}>{x}</p>)}</div>
 </div></aside></div></section>;
}
