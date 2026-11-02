import {useEffect,useState} from 'react';
import {FAT_DEFINITIONS,runFactoryAcceptance,fatChecksCsv,fatEvidenceCsv,type FatCaseId,type FatMode,type FatReport} from '../engineering/factory-acceptance';
import type {LadderDocument} from '../engineering/ladder';
import type {Board} from '../engineering/wiring-board';

function download(name:string,content:string,mime:string){const url=URL.createObjectURL(new Blob([content],{type:mime}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

/** Fresh simulated workcell per test; no mutation of the learner's live equipment. */
export function FactoryAcceptanceLab({program,board,valid}:{program:LadderDocument;board:Board;valid:boolean}){
 const [mode,setMode]=useState<FatMode>('fixture');
 const [caseId,setCaseId]=useState<FatCaseId|'all'>('all');
 const [report,setReport]=useState<FatReport|null>(null);
 const [message,setMessage]=useState('Choose a test mode and run the simulated acceptance procedure.');
 const [expanded,setExpanded]=useState<FatCaseId|null>(null);
 useEffect(()=>{setReport(null);setMessage('Program or wiring changed. Run a fresh acceptance test.');setExpanded(null);},[program,board]);
 const run=()=>{try{const selection=caseId==='all'?undefined:[caseId];const result=runFactoryAcceptance(program,mode,board,selection);setReport(result);setExpanded(result.cases.find(c=>!c.passed)?.id??result.cases[0].id);setMessage(result.failed===0?'All executed scenarios met their simulated criteria.':'One or more simulated criteria failed. Inspect the cases below.');}catch(error){setReport(null);setMessage(`Test rejected: ${error instanceof Error?error.message:String(error)}`);}};
 return <section className="panel factory-acceptance" aria-label="PLC simulated factory acceptance tests">
  <span className="eyebrow">COMMISSIONING · VIRTUAL FACTORY ACCEPTANCE</span>
  <h2>Automated PLC &amp; conveyor acceptance lab</h2>
  <p>Run reproducible commissioning scenarios using your <strong>current ladder program</strong>. Each scenario starts from a clean simulated machine and records actual scan observations, motor feedback and product movement. Tests never energize or alter the live workbench simulation.</p>
  <div className="fat-controls">
   <label>Test environment <select aria-label="FAT test environment" value={mode} onChange={e=>{setMode(e.target.value as FatMode);setReport(null);}}><option value="fixture">Reference wired fixture (I0.2 connected)</option><option value="configured-board">My configured wiring board</option></select></label>
   <label>Test scope <select aria-label="FAT test scope" value={caseId} onChange={e=>{setCaseId(e.target.value as FatCaseId|'all');setReport(null);}}><option value="all">All 10 procedures</option>{FAT_DEFINITIONS.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
   <button className="primary" disabled={!valid} onClick={run}>Run simulated FAT</button>
  </div>
  <p className="muted">Reference fixture isolates PLC logic from unfinished board wiring. Configured-board mode evaluates your actual wiring and can fail when I0.2 is not energized. Both are simulation only.</p>
  {!valid&&<p className="warn">Correct ladder validation and I/O mapping errors before running tests.</p>}
  <p role="status" aria-live="polite">{message}</p>
  {report&&<>
   <div className="fat-summary"><strong>{report.passed}/{report.total} passing</strong><span>{report.failed} failed</span><span>{report.simulatedScans} total 20-ms PLC scans</span><span>{report.mode==='fixture'?'Reference fixture':'Your wiring board'}</span></div>
   <div className="actions"><button onClick={()=>download('plc-fat-report.json',JSON.stringify(report,null,2),'application/json')}>Export full JSON report</button><button onClick={()=>download('plc-fat-checks.csv',fatChecksCsv(report),'text/csv;charset=utf-8')}>Export pass/fail CSV</button><button onClick={()=>download('plc-fat-evidence.csv',fatEvidenceCsv(report),'text/csv;charset=utf-8')}>Export scan evidence CSV</button></div>
   <div className="fat-cases">{report.cases.map(c=><article key={c.id} className={`fat-case ${c.passed?'fat-pass':'fat-fail'}`}>
    <button type="button" className="fat-case-toggle" aria-expanded={expanded===c.id} onClick={()=>setExpanded(e=>e===c.id?null:c.id)}><span><strong>{c.title}</strong><small>{c.system} · {c.scans} simulated scans</small></span><b>{c.passed?'PASS':'FAIL'}</b><span aria-hidden="true">{expanded===c.id?'▴':'▾'}</span></button>
    {expanded===c.id&&<div className="fat-case-body">
     <p>{FAT_DEFINITIONS.find(d=>d.id===c.id)?.objective}</p>
     {c.note&&<p className="warn">{c.note}</p>}
     <div className="fat-table-scroll"><table><thead><tr><th>Criterion</th><th>Expected</th><th>Observed</th><th>Scan</th><th>Result</th></tr></thead><tbody>{c.checks.map((check,i)=><tr key={i}><td>{check.name}</td><td>{check.expected}</td><td>{check.actual}</td><td>{check.scan}</td><td className={check.passed?'good':'warn'}>{check.passed?'PASS':'FAIL'}</td></tr>)}</tbody></table></div>
     <details><summary>Recorded machine evidence ({c.evidence.length} checkpoints)</summary><div className="fat-table-scroll"><table><thead><tr><th>Scan</th><th>Action</th><th>Power</th><th>Run request</th><th>Motor</th><th>Photoeye</th><th>Completed</th></tr></thead><tbody>{c.evidence.map((e,i)=><tr key={i}><td>{e.scan}</td><td>{e.action}</td><td>{e.power?'ON':'OFF'}</td><td>{e.runRequest?'1':'0'}</td><td>{e.motor?'ON':'OFF'}</td><td>{e.photoeye?'1':'0'}</td><td>{e.completed}</td></tr>)}</tbody></table></div></details>
    </div>}
   </article>)}</div>
   <p className="muted">{report.limitations}</p>
  </>}
  <p className="warn">The welded-contactor procedure passes when it <strong>detects a hazardous failure</strong>, not when STOP is safe. No exercise certifies guarding, protection devices, or real industrial machinery.</p>
 </section>;
}
