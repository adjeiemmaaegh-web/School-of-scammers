import React from 'react';
import type {WorkcellState} from '../engineering/workcell';
import {commissionStages,commissionStage,commissioningIssues,type CommissionRecord} from '../engineering/commissioning';
export function CommissioningGuide({state,record,onCapture,onReset}:{state:WorkcellState;record:CommissionRecord;onCapture:()=>void;onReset:()=>void}){
 const stage=commissionStage(record);const issues=commissioningIssues(state);
 return <section className="panel commissioning-guide" aria-label="Conveyor commissioning exercise"><span className="eyebrow">PRACTICAL WORK ORDER · COMM-001</span><h2>Conveyor commissioning</h2><p>Complete all five stages using real workcell actions. Evidence is captured from the PLC simulation, not from manually ticking boxes.</p>
 <ol className="commission-steps">{commissionStages.map((item,i)=><li key={item.id} className={record.evidence.length>i?'commission-done':stage===item.id?'commission-current':''}><strong>{item.title}</strong><p>{item.instruction}</p>{record.evidence[i]&&<small>✓ Scan {record.evidence[i].scan} · {record.evidence[i].detail}</small>}</li>)}</ol>
 <div className="actions"><button className="primary" disabled={record.passed} onClick={onCapture}>Verify current stage</button><button onClick={onReset}>Restart exercise</button></div>
 <p role="status">{record.passed?'PASS · All five stages verified in sequence':`${record.evidence.length}/5 stages verified · Current: ${stage}`}</p>
 <details><summary>Live diagnostic checklist ({issues.length} observations)</summary>{issues.length?<ul>{issues.map(x=><li key={x}>{x}</li>)}</ul>:<p>No active diagnostics in this checklist.</p>}</details>
 <p className="muted">Educational evidence only. Not a certified commissioning procedure, electrical authorization or safety validation.</p></section>;
}
