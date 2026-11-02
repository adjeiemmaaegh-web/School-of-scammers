import {useState} from 'react';
import {diagnoses,setupFault,repairFault,faultPresent,startDiagnosis,recordObservation,submitDiagnosis,type FaultId,type DiagnosisRecord} from '../engineering/diagnostics';
import {stepWorkcell,type WorkcellState,type WorkcellAction} from '../engineering/workcell';
export function FaultDiagnosisLab(){
 const [selected,setSelected]=useState<FaultId>('fuse-open');
 const [state,setState]=useState<WorkcellState|null>(null);
 const [record,setRecord]=useState<DiagnosisRecord|null>(null);
 const [guess,setGuess]=useState<FaultId>('fuse-open');
 const [showHint,setShowHint]=useState(false);
 const scenario=diagnoses.find(d=>d.id===selected)!;
 const begin=()=>{const next=setupFault(selected);setState(next);setRecord(startDiagnosis(selected,next));setGuess(selected);setShowHint(false);};
 const act=(action:WorkcellAction)=>setState(s=>s?stepWorkcell(s,action):s);
 return <section className="panel" aria-label="Fault diagnosis practical"><span className="eyebrow">INDUSTRIAL TROUBLESHOOTING · TEN SCENARIOS</span><h2>Fault diagnosis & repair</h2><p>Choose a fault scenario, observe the simulated machine, collect at least one new PLC scan as evidence, isolate before repair, then submit a diagnosis. The simulator grades the actual repaired state.</p>
 <label>Scenario <select value={selected} onChange={e=>{setSelected(e.target.value as FaultId);setState(null);setRecord(null);}}>{diagnoses.map(d=><option key={d.id} value={d.id}>{d.difficulty} · {d.title}</option>)}</select></label>
 <p><strong>Reported symptom:</strong> {scenario.symptom}</p><p><strong>System:</strong> {scenario.system} · {scenario.difficulty}</p>
 <div className="actions"><button className="primary" onClick={begin}>Load scenario / restart</button><button onClick={()=>setShowHint(x=>!x)}>{showHint?'Hide':'Show'} troubleshooting hints</button></div>
 {showHint&&<ul>{scenario.checks.map(x=><li key={x}>{x}</li>)}</ul>}
 {state&&record&&<><p role="status">Scan {state.scan} · Supply {state.powerOn?'ON':'ISOLATED'} · Motor {state.motor?'RUNNING':'STOPPED'} · Belt {state.process.motorFeedback?'MOVING':'STOPPED'}</p>
 <div className="io">{Object.entries({...state.plcInputs,...state.plcOutputs}).map(([tag,value])=><div key={tag}><code>{tag}</code><strong className={value?'good':'warn'}>{value?'TRUE':'FALSE'}</strong></div>)}</div>
 <div className="actions"><button onClick={()=>act('tick')}>Advance PLC scan</button><button onClick={()=>act('press-start')}>Press START</button><button onClick={()=>act('release-start')}>Release START</button><button onClick={()=>act('isolate-power')}>Isolate power</button><button onClick={()=>act('restore-power')}>Restore power</button><button onClick={()=>setRecord(r=>r?recordObservation(r,state):r)}>Record observation</button></div>
 <p>Recorded observations: {record.observations.length}</p><ol>{record.observations.map((o,i)=><li key={i}><code>{o}</code></li>)}</ol>
 <p><strong>Repair:</strong> Repairs require simulated power isolation. Use the controlled repair action below to restore the selected scenario component. This is not a real-world electrical procedure.</p>
 <div className="actions"><button disabled={!faultPresent(state,selected)||state.powerOn} onClick={()=>setState(s=>s?repairFault(s,selected):s)}>Repair isolated component and retest</button></div>
 <label>Root cause <select value={guess} onChange={e=>setGuess(e.target.value as FaultId)}>{diagnoses.map(d=><option key={d.id} value={d.id}>{d.cause}</option>)}</select></label>
 <div className="actions"><button className="primary" disabled={record.verified} onClick={()=>setRecord(r=>r?submitDiagnosis(r,state,guess):r)}>Submit diagnosis</button></div>
 <p role="status">{record.verified?'PASS · Correct diagnosis, fresh observation and verified repair':`Attempts: ${record.attempts} · ${record.observations.length===0?'Record a new scan before submission.':'Repair the fault, restore power and submit the cause.'}`}</p>
 </>}
 <p className="muted">Educational fault model only. No real energized electrical work or safety certification is represented.</p></section>;
}
