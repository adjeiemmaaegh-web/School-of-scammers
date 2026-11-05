import {useEffect,useState} from 'react';
import {compareReferenceCsv,referenceTraceTemplate,type ReferenceComparison} from '../engineering/plc-reference-trace';
import type {LadderDocument} from '../engineering/ladder';
function download(text:string,filename:string){
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function ReferencePlcComparison({program}:{program:LadderDocument}){
 const [report,setReport]=useState<ReferenceComparison|null>(null);
 const [message,setMessage]=useState('No external PLC trace supplied.');
 useEffect(()=>{setReport(null);setMessage('Program changed; previous comparison invalidated.');},[program]);
 return <section className="panel" aria-label="External PLC reference trace comparison">
  <h2>Real PLC reference comparison</h2>
  <p className="muted">Capture a chronological CSV of sampled BOOL inputs, actual PLC coil outputs and scan durations from an independently operated reference controller. Compare against this exact edited ladder program. This component does not connect to a PLC or authenticate the measurement source.</p>
  <p>CSV columns: <code>scan,delta_ms,input:Start,output:Run</code>. Use sequential scan numbers from 1, integer scan time 1–1000 ms, and values TRUE/FALSE or 1/0. Include every program coil.</p>
  <div className="actions">
   <button onClick={()=>{try{download(referenceTraceTemplate(program),'plc-reference-trace-template.csv');setMessage('CSV template exported; replace every row with independently measured PLC samples.');}catch(error){setMessage(String(error));}}}>Export reference CSV template</button>
   <label>Compare external PLC trace <input aria-label="Compare external PLC CSV" type="file" accept=".csv,text/csv" onChange={async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
     if(file.size>200000)throw Error('Reference file exceeds 200 KB');
     const next=compareReferenceCsv(program,await file.text());
     setReport(next);setMessage(next.mismatches?'Trace differs from the teaching interpreter. Inspect mismatch table.':'No differences against supplied trace. Independent provenance and real-controller signoff are still required.');
    }catch(error){setReport(null);setMessage('Comparison rejected: '+String(error));}
   }}/></label>
  </div>
  <p role="status">{message}</p>
  {report&&<div role="region" aria-label="External reference comparison results">
   <p><strong>{report.mismatches===0?'SUPPLIED TRACE MATCHED':'OUTPUT MISMATCH DETECTED'}</strong> · {report.scans} recorded scans · {report.matches}/{report.checks} output checks match · {report.mismatches} differences.</p>
   <p className="warn">Source provenance: UNVERIFIED. A matched file alone does not establish independent real-PLC equivalence, hardware accuracy, or industrial safety.</p>
   {report.firstMismatches.length>0&&<div role="region" aria-label="First PLC reference mismatches" tabIndex={0} style={{maxHeight:240,overflowY:'auto'}}>
    <table><thead><tr><th>Scan</th><th>Coil</th><th>Measured</th><th>Simulator</th></tr></thead><tbody>{report.firstMismatches.map((m,i)=><tr key={m.scan+'-'+m.tag+'-'+i}><td>{m.scan}</td><td><code>{m.tag}</code></td><td>{String(m.expected).toUpperCase()}</td><td>{String(m.actual).toUpperCase()}</td></tr>)}</tbody></table>
   </div>}
  </div>}
 </section>;
}
