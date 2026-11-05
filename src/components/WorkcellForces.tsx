import {useState} from 'react';
import {FORCEABLE_WORKCELL_INPUTS,type ForceableWorkcellInput,type WorkcellAction,type WorkcellState} from '../engineering/workcell';

/** Explicit, logged force controls for the educational PLC input image only.
 * The virtual electrical circuit, motor starter, power, guard and stop remain independent.
 */
export function WorkcellForces({state,onAction}:{state:WorkcellState;onAction:(action:WorkcellAction)=>void}){
 const [tag,setTag]=useState<ForceableWorkcellInput>('SensorOK');
 const [value,setValue]=useState<'true'|'false'|'clear'>('true');
 const isolated=!state.powerOn&&!state.motor;
 const active=Object.entries(state.inputForces).sort(([a],[b])=>a.localeCompare(b));
 return <section className="panel" role="region" aria-label="Simulation-only PLC input force table">
  <h3>PLC input force table — training only</h3>
  <p className="muted">Force a permitted <strong>PLC input image</strong> to TRUE or FALSE without changing the simulated physical sensor or wiring. An active force is visible in the typed watch table, event trace and exported replay. <strong>PowerOK, GuardClosed, Stop, outputs and safety feedback cannot be forced.</strong></p>
  <p className="warn">Isolate the virtual 24 V supply and stop the motor before adding or clearing any force. Forces persist after restoring power until explicitly cleared or the workcell is reset. Not suitable for physical equipment.</p>
  <div className="actions">
   <label>Simulated input <select aria-label="Simulated force tag" value={tag} onChange={e=>setTag(e.target.value as ForceableWorkcellInput)}>{FORCEABLE_WORKCELL_INPUTS.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   <label>Override <select aria-label="Simulated force value" value={value} onChange={e=>setValue(e.target.value as 'true'|'false'|'clear')}><option value="true">Force TRUE</option><option value="false">Force FALSE</option><option value="clear">Clear force (sample physical input)</option></select></label>
   <button disabled={!isolated} onClick={()=>onAction({kind:'force-input',tag,value:value==='clear'?null:value==='true'})}>Apply simulation force</button>
  </div>
  <p role="status">{isolated?'Virtual power isolated: force changes permitted.':'Force controls locked: isolate virtual supply first.'} {active.length} active simulation force{active.length===1?'':'s'}.</p>
  <div className="io" aria-label="Active simulated PLC input forces">
   {active.length?active.map(([name,forced])=><div key={name}><code>{name}</code><strong>{forced?'FORCED TRUE':'FORCED FALSE'}</strong></div>):<p>No input forces. PLC inputs follow simulated electrical/plant sampling.</p>}
  </div>
 </section>;
}
