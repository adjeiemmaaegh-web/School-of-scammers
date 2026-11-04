import {useMemo,useState} from 'react';
import {captureWorkcellWatch,watchTimeline,watchTimelineCsv,watchValue,type WatchGroup} from '../engineering/workcell-watch';
import type {LadderDocument} from '../engineering/ladder';
import type {WorkcellState} from '../engineering/workcell';

const groups:readonly {value:'all'|WatchGroup;label:string}[]=[
 {value:'all',label:'All signal sources'},
 {value:'sampled-input',label:'Sampled PLC inputs'},
 {value:'plc-coil',label:'Ladder output coils'},
 {value:'post-scan-feedback',label:'Post-scan derived feedback'},
 {value:'instruction-memory',label:'Timer and counter memory'},
 {value:'plant',label:'Virtual plant feedback'}
];
const download=(content:string)=>{
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='workcell-typed-watch-transitions.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
/** Inspection only: all actions advance the workcell through the parent, never this view. */
export function WorkcellWatch({shown,history,program}:{shown:WorkcellState;history:readonly WorkcellState[];program:LadderDocument}){
 const [search,setSearch]=useState('');
 const [group,setGroup]=useState<'all'|WatchGroup>('all');
 const frame=useMemo(()=>captureWorkcellWatch(shown,program),[shown,program]);
 const timeline=useMemo(()=>watchTimeline(history.filter(s=>s.scan<=shown.scan),program),[history,shown.scan,program]);
 const term=search.trim().toLowerCase();
 const matches=(g:WatchGroup,tag:string,id:string,description='')=>(group==='all'||group===g)&&(!term||[g,tag,id,description].some(value=>value.toLowerCase().includes(term)));
 const rows=frame.rows.filter(row=>matches(row.group,row.tag,row.id,row.description));
 const transitions=timeline.changes.filter(change=>matches(change.group,change.tag,change.id));
 const sampled=shown.scan>0;
 return <section role="region" aria-label="Workcell PLC watch debugger" className="panel">
  <h3>Typed PLC I/O watch and scan changes</h3>
  <p className="muted">Read-only evidence from the integrated virtual workcell. Inputs are sampled before ladder execution; coils update during the scan; feedback and plant readings update afterward. Identical tag names in different phases are deliberately separate.</p>
  <div className="actions">
   <label>Find tag <input aria-label="Workcell watch search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="e.g. RunLatch, Photoeye, ET"/></label>
   <label>Signal source <select aria-label="Workcell watch source" value={group} onChange={e=>setGroup(e.target.value as 'all'|WatchGroup)}>{groups.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
   <button disabled={transitions.length===0} onClick={()=>download(watchTimelineCsv({...timeline,changes:transitions}))}>Export filtered watch CSV</button>
  </div>
  <p role="status" aria-live="polite">Showing scan #{frame.scan} at {frame.timeMs} simulated ms · {rows.length} typed signals · {transitions.length} recorded transitions{timeline.truncated?' · older history truncated':''}. {sampled?'Values are simulation evidence, not physical PLC measurements.':'Run a virtual PLC scan to capture input and coil values.'}</p>
  <div role="region" aria-label="Scrollable typed workcell watch signals" tabIndex={0} style={{overflowX:'auto',maxHeight:450,overflowY:'auto'}}>
   <table><thead><tr><th>Phase / source</th><th>Educational address</th><th>Tag</th><th>Type</th><th>Value</th><th>When measured</th></tr></thead>
    <tbody>{rows.slice(0,350).map(row=><tr key={row.id} data-watch-id={row.id}>
     <td>{groups.find(g=>g.value===row.group)?.label??row.group}</td>
     <td><code>{row.address||'—'}</code></td><td><code title={row.description}>{row.tag}</code></td>
     <td>{row.type}</td><td><strong>{watchValue(row.value,row.type,row.unit)}</strong></td>
     <td><small>{row.phase}</small></td>
    </tr>)}</tbody>
   </table>
  </div>
  {rows.length>350&&<p className="muted">Only the first 350 matching signals are shown. Narrow the source or search to inspect additional tags.</p>}
  {!!frame.diagnostics.length&&<div aria-label="Workcell watch diagnostic observations">
   <h4>Command / feedback observations</h4>
   {frame.diagnostics.map((finding,i)=><p key={i} className={finding.kind==='warning'?'warn':'muted'}>{finding.kind==='warning'?'Modeled warning: ':'Timing note: '}{finding.message}</p>)}
  </div>}
  <h4>Recent observed signal changes</h4>
  <p className="muted">Transition comparisons use only retained executed scans up to the inspected scan. The first retained scan has no invented predecessor. A maximum of 240 recent changes is retained in this view.</p>
  <div className="log" role="region" tabIndex={0} style={{maxHeight:220,overflowY:'auto'}} aria-label="Workcell watch changes">
   {transitions.slice(-24).reverse().map((event,i)=><p key={event.id+'-'+event.scan+'-'+i} data-watch-event={event.id}>
     Scan {event.scan} · {event.timeMs} ms · <code>{event.tag}</code> ({event.group}, {event.type}): {watchValue(event.from,event.type,event.unit)} → {watchValue(event.to,event.type,event.unit)} · {event.direction}
   </p>)}
   {!transitions.length&&<p>No transitions in the selected retained scans and source filter.</p>}
  </div>
 </section>;
}
