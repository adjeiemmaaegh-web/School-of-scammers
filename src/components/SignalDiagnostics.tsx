import {useMemo,useState} from 'react';
import {DEFAULT_RULES,diagnosticsCsv,evaluateDiagnostics} from '../engineering/signal-diagnostics';
import type {Recorder} from '../engineering/scan-instruments';
export function SignalDiagnostics({recorder}:{recorder:Recorder}){
 const [showCleared,setShowCleared]=useState(false);
 const result=useMemo(()=>evaluateDiagnostics(recorder),[recorder]);
 const alarms=result.alarms.filter(a=>showCleared||a.active);
 const exportCsv=()=>{const blob=new Blob([diagnosticsCsv(result)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='plc-diagnostic-alarms.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="panel" aria-label="Scan diagnostics"><h2>Scan-based diagnostic alarms</h2><p>Rules evaluate recorded simulated scans. Alarms are observations, not proof of a physical failure. Resetting the recorder clears its alarm history.</p><p>{DEFAULT_RULES.length} rules · {result.evaluatedScans} scans · {result.alarms.filter(a=>a.active).length} active alarms</p><label><input type="checkbox" checked={showCleared} onChange={e=>setShowCleared(e.target.checked)}/> Include cleared alarms</label> <button disabled={!result.alarms.length} onClick={exportCsv}>Export alarm history CSV</button>
 <div className="log" aria-live="polite">{alarms.map(a=><p key={a.id}><strong className={a.severity==='critical'?'warn':''}>{a.severity.toUpperCase()} · {a.active?'ACTIVE':'CLEARED'}</strong> — {a.label} · scans {a.firstScan}–{a.lastScan} · {a.durationMs} ms</p>)}{!alarms.length&&<p>No alarms matching this filter.</p>}</div>
 <details><summary>Diagnostic rules and dwell thresholds</summary>{DEFAULT_RULES.map(r=><p key={r.id}>{r.label} — {r.durationMs} ms · {r.severity}</p>)}</details></section>;
}
