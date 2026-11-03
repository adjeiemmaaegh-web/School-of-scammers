import React,{useState} from 'react';
import './process-control.css';
import {initialTank,stepTank,tankSample,tankSamplesCsv,simulateTank,DEFAULT_TANK_CONFIG,DEFAULT_TANK_CONTROL,type TankControl,type TankFault,type TankState,type TankSample} from '../engineering/analog-tank';
import {ST_DEMO,compileStructuredText,executeStructuredText,type STSignals,type STValue} from '../engineering/structured-text';

export const ST_TANK_SAMPLE=`(* Educational pump permissive: not a safety function *)
IF NOT EStopOK OR TankHigh THEN
  PumpEnable := FALSE;
ELSE
  PumpEnable := TRUE;
END_IF;
`;

function saveCsv(rows:readonly TankSample[]){const file=new Blob([tankSamplesCsv(rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download='plc-tank-level-evidence.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function levelColor(level:number){return level>=95?'#ef7373':level>75?'#f3c764':'#43d5bd';}
function TankSchematic({state,control}:{state:TankState;control:TankControl}){
 const level=state.actualPercent;const surface=230-1.75*level;
 return <svg viewBox="0 0 620 330" width="100%" role="img" aria-label={`Simulated tank at ${level.toFixed(1)} percent actual level, ${state.measuredPercent.toFixed(1)} percent indicated, pump ${Math.round(state.duty*100)} percent output`}>
  <defs><linearGradient id="tankWall" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#61849b" stopOpacity=".18"/><stop offset=".5" stopColor="#a9c5cf" stopOpacity=".05"/><stop offset="1" stopColor="#52728c" stopOpacity=".24"/></linearGradient><linearGradient id="tankFluid" x1="0" y1="0" x2="0" y2="1"><stop stopColor={levelColor(level)} stopOpacity=".88"/><stop offset="1" stopColor="#166d94" stopOpacity=".96"/></linearGradient><clipPath id="tankClip"><rect x="200" y="52" width="192" height="178" rx="14"/></clipPath></defs>
  <rect x="0" y="0" width="620" height="330" rx="14" fill="#0b1d2d"/>
  <g fill="none" stroke="#6e9fb5" strokeWidth="9" strokeLinecap="round"><path d="M55 170 H100 V76 H200"/><path d="M392 190 H480 V268 H574"/></g>
  <circle cx="103" cy="170" r="27" fill={state.duty>0?'#126b63':'#283b4d'} stroke="#74aeae" strokeWidth="3"/><path d="M94 157 L119 170 L94 183 Z" fill={state.duty>0?'#99f7de':'#8295a4'}/>
  <text x="103" y="218" textAnchor="middle" fill="#e3edf7" fontSize="13">P-101 pump</text><text x="103" y="237" textAnchor="middle" fill="#a4e5de" fontSize="13">{Math.round(state.duty*100)}% duty</text>
  <g clipPath="url(#tankClip)"><rect x="200" y={surface} width="192" height={Math.max(0,230-surface)} fill="url(#tankFluid)"/><path d={`M200 ${surface+2} Q248 ${surface-2} 296 ${surface+2} T392 ${surface+2}`} fill="none" stroke="#cdfbe7" strokeWidth="2" opacity=".7"/></g>
  <rect x="200" y="52" width="192" height="178" rx="14" fill="url(#tankWall)" stroke="#bed4e3" strokeWidth="4"/>
  <text x="296" y="40" textAnchor="middle" fill="#e6f4fa" fontSize="17" fontWeight="700">T-101 • LEVEL CONTROL</text>
  {[0,25,50,75,100].map(p=><g key={p}><path d={`M396 ${230-1.78*p} h12`} stroke="#bbdae7" strokeWidth="2"/><text x="415" y={234-1.78*p} fontSize="12" fill="#d8eafa">{p}%</text></g>)}
  <path d={`M195 ${230-1.78*control.setpointPercent} H392`} stroke="#ffdf86" strokeDasharray="7 4" strokeWidth="2"/>
  <text x="296" y="150" textAnchor="middle" fill="#fff" fontSize="33" fontWeight="bold">{level.toFixed(1)}%</text>
  <text x="296" y="176" textAnchor="middle" fill="#e6f4fa" fontSize="12">true process level</text>
  <text x="296" y="269" textAnchor="middle" fill="#ffd785" fontSize="12">Target: {control.setpointPercent}%</text>
  <text x="296" y="288" textAnchor="middle" fill="#c4e8f4" fontSize="12">LT-101 sensor: {state.measuredPercent.toFixed(1)}%</text>
  <text x="488" y="217" fill="#e5edf7" fontSize="12">OUTLET</text>
  <text x="37" y="110" fill="#e5edf7" fontSize="12">INLET</text>
  {state.highHighTrip&&<g><rect x="176" y="296" width="240" height="25" rx="6" fill="#982c36"/><text x="296" y="313" fill="white" textAnchor="middle" fontSize="12" fontWeight="700">HIGH-HIGH TRIP — PUMP HELD OFF</text></g>}
 </svg>;
}
function TrendChart({rows,target}:{rows:readonly TankSample[];target:number}){
 const view=rows.slice(-200);if(view.length<2)return <div className="muted" role="status">Run at least two simulated seconds to see the trend.</div>;
 const px=(i:number)=>50+i/(view.length-1)*510,py=(n:number)=>210-n/100*170;
 const points=(select:(r:TankSample)=>number)=>view.map((r,i)=>`${px(i).toFixed(1)},${py(select(r)).toFixed(1)}`).join(' ');
 return <svg width="100%" viewBox="0 0 600 260" role="img" aria-label={`Recent tank trend for ${view.length} samples, actual, sensor and setpoint levels`}><rect width="600" height="260" rx="12" fill="#0b1d2d"/>
  {[0,25,50,75,100].map(p=><g key={p}><line x1="50" x2="560" y1={py(p)} y2={py(p)} stroke="#325067" strokeDasharray="3 5"/><text x="36" y={py(p)+4} fill="#b9d3e3" fontSize="11" textAnchor="end">{p}</text></g>)}
  <polyline points={points(r=>r.setpointPercent)} fill="none" stroke="#f5cc79" strokeWidth="2" strokeDasharray="7 4"/>
  <polyline points={points(r=>r.measuredPercent)} fill="none" stroke="#a9b9ff" strokeWidth="2" strokeDasharray="4 3"/>
  <polyline points={points(r=>r.actualPercent)} fill="none" stroke="#4bdac4" strokeWidth="3"/>
  <text x="56" y="245" fill="#d4e6f0" fontSize="12">Simulated {view[0].second.toFixed(0)}–{view[view.length-1].second.toFixed(0)} s</text>
  <text x="558" y="245" textAnchor="end" fill="#4bdac4" fontSize="11">● Actual</text><text x="465" y="245" textAnchor="end" fill="#a9b9ff" fontSize="11">Sensor</text><text x="405" y="245" textAnchor="end" fill="#f5cc79" fontSize="11">Target</text>
 </svg>;
}
const INITIAL_ST_INPUTS:Record<string,STValue>={Start:false,Stop:false,EStopOK:true,GuardClosed:true,TankLevel:20,TankHigh:false,TankLow:false};
function validNumber(value:string,min:number,max:number,current:number){const parsed=Number(value);return value.trim()===''||!Number.isFinite(parsed)?current:Math.max(min,Math.min(max,parsed));}
export function ProcessControlLab(){
 const [tab,setTab]=useState<'tank'|'st'>('tank');
 const [tank,setTank]=useState<TankState>(()=>initialTank());const [settings,setSettings]=useState<TankControl>(DEFAULT_TANK_CONTROL);
 const [trace,setTrace]=useState<TankSample[]>([]);const [error,setError]=useState('');const [challenge,setChallenge]=useState('');
 const [logic,setLogic]=useState(ST_TANK_SAMPLE);const [useST,setUseST]=useState(false);const [stMemory,setSTMemory]=useState<STSignals>({PumpEnable:false});
 const [editor,setEditor]=useState(ST_DEMO);const [stInputs,setSTInputs]=useState<Record<string,STValue>>(INITIAL_ST_INPUTS);const [stOutputs,setSTOutputs]=useState<STSignals>({Run:false});const [stTrace,setSTTrace]=useState('No scan yet.');
 const setNum=(key:'setpointPercent'|'kp'|'ki'|'kd'|'manualDuty'|'demandOutflow',min:number,max:number)=>(event:React.ChangeEvent<HTMLInputElement>)=>setSettings(s=>({...s,[key]:validNumber(event.target.value,min,max,s[key])}));
 const reset=()=>{setTank(initialTank());setTrace([]);setSTMemory({PumpEnable:false});setError('');setChallenge('');};
 const advance=(seconds:number)=>{
  try{
   const compiled=useST?compileStructuredText(logic):null;
   const pumpTag=compiled?.assignedOutputs.find(tag=>tag.toUpperCase()==='PUMPENABLE');
   if(compiled&&!pumpTag)throw new Error('Structured Text pump permissive must assign PumpEnable.');
   let current=tank;let outputs:STSignals={...stMemory};const newRows:TankSample[]=[];
   for(let i=0;i<seconds;i++){
    let permit=settings.permitPump;
    if(compiled){
     const signals:STSignals={TankLevel:current.measuredPercent,TankHigh:current.actualPercent>=95,TankLow:current.actualPercent<=10,EStopOK:!settings.emergencyStop};
     outputs=executeStructuredText(compiled,signals,outputs).outputs;
     const pumpEnable=outputs[pumpTag!];
     if(typeof pumpEnable!=='boolean')throw new TypeError('PumpEnable must be BOOL; program outputs are not safe to execute.');
     permit=permit&&pumpEnable;
    }
    current=stepTank(current,{...settings,permitPump:permit,resetTrip:i===0&&settings.resetTrip});newRows.push(tankSample(current,settings));
   }
   setTank(current);setSTMemory(outputs);setTrace(previous=>[...previous,...newRows].slice(-900));if(settings.resetTrip)setSettings(previous=>({...previous,resetTrip:false}));setChallenge('');setError('');
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 const evaluateChallenge=()=>{
  try{
   const trial=simulateTank(initialTank(),{...settings,mode:'auto',fault:'none',emergencyStop:false,permitPump:true,resetTrip:false},120);
   const finalError=Math.abs(trial.end.actualPercent-settings.setpointPercent);
   const steady=trial.rows.slice(-30).every(row=>Math.abs(row.actualPercent-settings.setpointPercent)<=5);
   const success=steady&&!trial.tripScans&&trial.end.spilledLiters===0;
   setChallenge(`${success?'PASS':'REVIEW'}: 120 simulated seconds; final error ${finalError.toFixed(2)} percentage points, overshoot ${trial.overshootPercent.toFixed(2)} points, high-high trip scans ${trial.tripScans}. ${success?'Level remained within ±5 points for the final 30 seconds.':'Tune gains to remain within ±5 points for the last 30 seconds without a trip.'} Educational score only.`);setError('');
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 const executeST=()=>{
  try{
   const program=compileStructuredText(editor);
   const result=executeStructuredText(program,stInputs,stOutputs);
   setSTOutputs(result.outputs);setSTTrace(result.assignments.length?result.assignments.map(a=>`${a.tag} := ${String(a.value)}`).join(' · '):'No assignments in this scan; previous output state retained.');setError('');
  }catch(e){setError(e instanceof Error?e.message:String(e));setSTTrace('Compile or execution failed; outputs were not changed.');}
 };
 return <section className="portal-page process-lab">
  <div className="page-heading"><div><span className="eyebrow">ANALOG CONTROL • IEC ST TEACHING SUBSET</span><h1>Industrial process-control laboratory</h1><p>Operate a tank, tune a deterministic PID loop, introduce instrument faults and run a bounded Structured Text scan interpreter—all locally in your browser.</p></div></div>
  <div className="actions process-tabs" role="tablist" aria-label="Process control workspaces"><button type="button" role="tab" aria-selected={tab==='tank'} onClick={()=>{setTab('tank');setError('')}}>Tank & PID control</button><button type="button" role="tab" aria-selected={tab==='st'} onClick={()=>{setTab('st');setError('')}}>Structured Text editor</button></div>
  {error&&<p role="alert" className="process-error">{error}</p>}
  {tab==='tank'?<div className="process-layout"><div className="process-stack">
   <div className="panel"><div className="topline"><h2>T-101 • water level plant</h2><span className={tank.highHighTrip?'warn':'good'}>{tank.highHighTrip?'INTERLOCK TRIPPED':'SIMULATING'}</span></div><TankSchematic state={tank} control={settings}/><div className="process-metrics"><div><small>Actual level</small><strong>{tank.actualPercent.toFixed(1)}%</strong></div><div><small>LT-101 sensor</small><strong>{tank.measuredPercent.toFixed(1)}%</strong></div><div><small>Inlet pump</small><strong>{Math.round(tank.duty*100)}%</strong></div><div><small>Simulated time</small><strong>{(tank.timeMs/1000).toFixed(0)} s</strong></div></div>{tank.alarm&&<p role="alert" className="process-error">{tank.alarm}</p>}<div className="actions"><button onClick={()=>advance(1)}>+1 s / scan</button><button onClick={()=>advance(10)}>Run 10 s</button><button className="primary" onClick={()=>advance(60)}>Run 60 s</button><button onClick={reset}>Reset tank</button></div><p className="muted">Pump flow {DEFAULT_TANK_CONFIG.inletLitersPerSecond} L/s max • tank {DEFAULT_TANK_CONFIG.capacityLiters} L • high-high trip at 98% • manual reset only at or below 90%.</p></div>
   <div className="panel"><div className="topline"><h2>Trend and measured evidence</h2><button disabled={!trace.length} onClick={()=>saveCsv(trace)}>Export CSV</button></div><TrendChart rows={trace} target={settings.setpointPercent}/>{trace.length>0&&<p className="muted">{trace.length} retained samples. Current simulation: {tank.totalInletLiters.toFixed(1)} L inlet / {tank.totalOutletLiters.toFixed(1)} L outlet / {tank.spilledLiters.toFixed(1)} L spilled.</p>}</div>
  </div><aside className="process-stack"><div className="panel"><h2>Controller setup</h2><label>Control mode<select value={settings.mode} onChange={e=>setSettings(s=>({...s,mode:e.target.value as TankControl['mode']}))}><option value="auto">PID automatic</option><option value="manual">Manual pump</option></select></label><label>Level setpoint (%)<input type="number" min="0" max="95" step="1" value={settings.setpointPercent} onChange={setNum('setpointPercent',0,95)}/></label><div className="process-controls"><label>Kp<input type="number" min="0" max="2" step="0.005" value={settings.kp} onChange={setNum('kp',0,2)}/></label><label>Ki<input type="number" min="0" max="0.5" step="0.001" value={settings.ki} onChange={setNum('ki',0,.5)}/></label><label>Kd<input type="number" min="0" max="3" step="0.005" value={settings.kd} onChange={setNum('kd',0,3)}/></label></div><label>Manual pump duty ({Math.round(settings.manualDuty*100)}%)<input type="range" min="0" max="1" step="0.05" value={settings.manualDuty} disabled={settings.mode!=='manual'} onChange={setNum('manualDuty',0,1)}/></label><label>Demand outflow (L/s)<input type="number" min="0" max={DEFAULT_TANK_CONFIG.outletLitersPerSecond} step="1" value={settings.demandOutflow} onChange={setNum('demandOutflow',0,DEFAULT_TANK_CONFIG.outletLitersPerSecond)}/></label><label>Injected fault<select value={settings.fault} onChange={e=>setSettings(s=>({...s,fault:e.target.value as TankFault}))}><option value="none">No fault</option><option value="sensor-stuck-low">LT-101 stuck LOW</option><option value="sensor-stuck-high">LT-101 stuck HIGH</option><option value="inlet-blocked">Inlet blocked</option><option value="outlet-leak">Outlet leak</option></select></label><label className="process-check"><input type="checkbox" checked={settings.emergencyStop} onChange={e=>setSettings(s=>({...s,emergencyStop:e.target.checked}))}/> Simulated E-stop active</label><label className="process-check"><input type="checkbox" checked={settings.permitPump} onChange={e=>setSettings(s=>({...s,permitPump:e.target.checked}))}/> External pump permissive</label><button onClick={()=>{setSettings(s=>({...s,resetTrip:true}));setError('Reset requested. The high-high trip resets on the next scan only if the actual level is ≤90%.');}}>Request trip reset</button><p className="muted">To drain a tripped tank, set manual duty to 0 and simulate the demand outflow. Reset is denied above 90% actual level.</p></div>
   <div className="panel"><h2>Structured Text pump permissive</h2><label className="process-check"><input type="checkbox" checked={useST} onChange={e=>setUseST(e.target.checked)}/> Use ST output PumpEnable as an additional pump permissive</label><textarea aria-label="Tank permissive Structured Text" value={logic} onChange={e=>setLogic(e.target.value)} rows={8} spellCheck={false}/><button onClick={()=>{setEditor(logic);setTab('st')}}>Open in Structured Text lab</button><p className="muted">The independent modeled high-high trip always takes priority over ST logic and manual pump demand. External safety hardware is not simulated.</p></div>
   <div className="panel"><h2>PID tuning challenge</h2><p>Starting from 20% full, tune a normal plant to the setpoint within ±5 percentage points for the final 30 seconds of a 120-second trial, with no high-high trip.</p><button className="primary" onClick={evaluateChallenge}>Evaluate tuning challenge</button>{challenge&&<p role="status" className="process-feedback">{challenge}</p>}</div>
  </aside></div>:<div className="process-layout"><div className="process-stack"><div className="panel"><h2>IEC 61131-3 Structured Text • teaching subset</h2><p>Write assignments and IF / ELSIF / ELSE / END_IF statements with BOOL and REAL expressions. This is an interpreter for learning control flow—not a vendor-certified ST compiler.</p><label>Structured Text program<textarea aria-label="Structured Text program" spellCheck={false} value={editor} onChange={e=>setEditor(e.target.value)} rows={17}/></label><div className="actions"><button className="primary" onClick={executeST}>Compile & execute one scan</button><button onClick={()=>{setEditor(ST_DEMO);setSTOutputs({Run:false});setSTTrace('Demo program loaded; run a scan.')}}>Load motor latch example</button><button onClick={()=>{setEditor(ST_TANK_SAMPLE);setSTOutputs({PumpEnable:false});setSTTrace('Pump permissive example loaded; run a scan.')}}>Load tank permissive</button><button onClick={()=>{setSTOutputs({Run:false,PumpEnable:false});setSTTrace('Output memory reset.')}}>Reset output memory</button></div><p role="status" className="process-feedback">{stTrace}</p></div><div className="panel"><h2>Supported instruction grammar</h2><p>Assignments (<code>:=</code>), BOOL constants, numeric literals, <code>AND</code>, <code>OR</code>, <code>XOR</code>, <code>NOT</code>, comparisons, + − × ÷, parentheses, IF / ELSIF / ELSE, and comments. Values persist between simulated scans; sampled inputs cannot be assigned.</p><p className="muted">No loops, tasks, timers, function blocks, declarations, direct hardware I/O, or arbitrary JavaScript execution. All programs have explicit token, statement, nesting and runtime budgets.</p></div></div><aside className="process-stack"><div className="panel"><h2>Simulated input image</h2>{Object.entries(stInputs).map(([tag,value])=><label key={tag} className="process-tag-input">{tag}{typeof value==='boolean'?<input type="checkbox" checked={value} onChange={e=>setSTInputs(s=>({...s,[tag]:e.target.checked}))}/>:<input aria-label={tag} type="number" min="0" max="100" value={value} onChange={e=>setSTInputs(s=>({...s,[tag]:validNumber(e.target.value,0,100,Number(s[tag]))}))}/>}</label>)}<p className="muted">Inputs are sampled once per scan and cannot be overwritten by the ST program.</p></div><div className="panel"><h2>PLC output memory</h2>{Object.keys(stOutputs).length===0?<p>No outputs evaluated yet.</p>:<div className="io">{Object.entries(stOutputs).sort().map(([tag,value])=><div key={tag}><code>{tag}</code><strong className={value===true?'good':'muted'}>{String(value)}</strong></div>)}</div>}</div></aside></div>}
  <p className="muted">All data remains local to this browser session. Numerical values are idealized; do not connect to equipment or use as industrial safety logic.</p>
 </section>;
}