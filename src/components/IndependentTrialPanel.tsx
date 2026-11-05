import {useState} from 'react';
import {parseTrialPortfolio,trialSummary,TRIAL_SCENARIOS,validateTrialEvidence,type TrialEvidence,type TrialRole,type TrialRating} from '../engineering/field-trial';
const save=(rows:readonly TrialEvidence[])=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='plc-anonymous-trial-evidence.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
/** Human-reviewed field study requires actual people; UI only records their self-declared observations. */
export function IndependentTrialPanel(){
 const [role,setRole]=useState<TrialRole>('learner');
 const [scenario,setScenario]=useState(TRIAL_SCENARIOS[0]);
 const [completed,setCompleted]=useState(false),[diagnosisCorrect,setDiagnosisCorrect]=useState(false);
 const [isolationObserved,setIsolationObserved]=useState(false),[declaredIndependent,setDeclaredIndependent]=useState(false);
 const [rating,setRating]=useState<TrialRating>(3),[minutes,setMinutes]=useState(25),[notes,setNotes]=useState('');
 const [consent,setConsent]=useState(false),[rows,setRows]=useState<TrialEvidence[]>([]),[status,setStatus]=useState('No human validation evidence recorded.');
 const summary=trialSummary(rows);
 const add=()=>{
  try{
   if(!consent)throw Error('Confirm participant consent before recording an anonymous observation');
   if(rows.length>=50)throw Error('Export this batch before collecting additional trials');
   const item=validateTrialEvidence({format:'plc-skills-lab-anonymous-trial',schemaVersion:1,role,scenario,completed,diagnosisCorrect,isolationObserved,declaredIndependent,rating,minutes,notes});
   setRows(previous=>[...previous,item]);setNotes('');setConsent(false);setStatus('Anonymous self-declared observation recorded locally in this page. Export it to retain it.');
  }catch(error){setStatus(String(error));}
 };
 return <section className="panel" aria-label="Instructor and learner field validation evidence">
  <h2>Instructor and learner pilot evidence</h2>
  <p className="muted">Use this voluntary anonymous form during actual observed lab trials. Do not enter names, email addresses or personal identifiers. Records stay in page memory until exported; nothing is sent to a backend. Self-declared independence is <strong>not externally verified</strong>.</p>
  <div className="actions">
   <label>Participant role<select aria-label="Trial participant role" value={role} onChange={e=>setRole(e.target.value as TrialRole)}><option value="learner">Learner</option><option value="instructor">Instructor / controls reviewer</option></select></label>
   <label>Practical scenario<select aria-label="Trial scenario" value={scenario} onChange={e=>setScenario(e.target.value)}>{TRIAL_SCENARIOS.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <label>Observed duration, minutes<input aria-label="Trial duration" type="number" min={1} max={240} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
   <label>Practical usability (1–5)<select aria-label="Trial usability rating" value={rating} onChange={e=>setRating(Number(e.target.value) as TrialRating)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>
  <div className="actions">
   <label><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)}/> Task completed independently</label>
   <label><input type="checkbox" checked={diagnosisCorrect} onChange={e=>setDiagnosisCorrect(e.target.checked)}/> Root cause identified correctly</label>
   <label><input type="checkbox" checked={isolationObserved} onChange={e=>setIsolationObserved(e.target.checked)}/> Simulated isolation practiced</label>
   <label><input type="checkbox" checked={declaredIndependent} onChange={e=>setDeclaredIndependent(e.target.checked)}/> Reviewer declares independence from development team</label>
  </div>
  <label>Anonymous study notes<textarea aria-label="Trial notes" maxLength={350} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe observed difficulty or incorrect simulated behavior; no personal details"/></label>
  <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Participant agrees to this anonymous observation being recorded and exported</label>
  <div className="actions"><button onClick={add}>Record observed trial</button><button disabled={!rows.length} onClick={()=>save(rows)}>Export anonymous trial JSON</button><label>Import validated trial JSON<input type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>50000)throw Error('Evidence exceeds 50 KB');setRows(parseTrialPortfolio(await file.text()));setStatus('Imported user-supplied trial records. Independence remains unverified.');}catch(error){setStatus(String(error));}}}/></label><button disabled={!rows.length} onClick={()=>{setRows([]);setStatus('Unsaved page observations cleared.');}}>Clear page observations</button></div>
  <p role="status">{status}</p>
  <p>{summary.trials} recorded pilot observations · {summary.instructors} instructors · {summary.learners} learners · {summary.independentDeclared} self-declared independent · {summary.completed} tasks completed · {summary.accurate} correct diagnoses · {summary.isolation} observed simulated isolations · {summary.meanRating.toFixed(2)} / 5 mean usability.</p>
  <p className="warn">These fields are observational only. They cannot certify industrial competence, true participant independence, curriculum quality or physical safety. The release gate stays OPEN until real studies and independent review are completed and signed off.</p>
 </section>;
}
