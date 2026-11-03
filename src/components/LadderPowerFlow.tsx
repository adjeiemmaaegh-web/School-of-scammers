import type { LadderStep } from '../engineering/ladder';
/** Read-only inspection of the exact values captured during the PLC scan. */
export function LadderPowerFlow({steps}:{steps:readonly LadderStep[]}) {
 return <div role="region" aria-label="Ladder scan power flow">{steps.map(step=><div className="flow-rung" key={step.rungId}>
 <div className="flow-title"><strong>{step.rungId}</strong><span>{step.operation.toUpperCase()} · {step.coil} = {String(step.result)}</span></div>
 <div className="flow-line"><span className="flow-rail">│</span>{step.elements.map((element,i)=><div className={`flow-element ${element.conducts?'flow-on':'flow-off'}`} key={i} title={element.conducts?'Conducting':'Open'}>
 {element.paths.map((path,j)=><div className="flow-path" key={j}>{path.map((c,k)=><span className={`flow-contact ${c.conducts?'flow-on':'flow-off'}`} key={k} title={`${c.tag}: sampled ${c.sampled}`}><small>{c.tag}</small><code>{c.normallyClosed?'—|/|—':'—| |—'}</code></span>)}</div>)}
 </div>)}<span className={`flow-coil ${step.result?'flow-on':'flow-off'}`}>—( {step.coil} )—</span><span className="flow-rail">│</span></div>
 {(step.elapsedMs!==undefined||step.count!==undefined)&&<small>Elapsed: {step.elapsedMs??'—'} ms · Count: {step.count??'—'}</small>}
 </div>)}</div>;
}
