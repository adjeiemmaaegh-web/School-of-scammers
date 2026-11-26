import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COMPONENTS, type ComponentKind } from '../components/registry';
import { DEVICE_FAMILIES, familyForKind, type DeviceFamily } from '../ui/sandbox/workspace-catalog';
import { GUIDE_EQUIPMENT_KINDS } from './guide-reference';

const familyNote:Record<Exclude<DeviceFamily,'all'>,string>={
 plc:'The controller needs power, correctly mapped terminals and a valid program. A PLC output is not a power supply by itself.',
 electrical:'Follow the exact virtual terminal labels. These are bounded control-circuit models, not approved real-world wiring diagrams.',
 sensors:'A sensor reports a modeled condition only when the relevant power, geometry and configuration requirements are met.',
 drives:'A commanded drive still needs the intended virtual electrical path and an allowed model state.',
 handling:'Material movement depends on the authoritative plant state, upstream bodies, position and correctly commanded actuators.',
 motion:'Mechanical travel, limits and grip conditions are simplified educational models; movement requires a valid command.',
 process:'Levels, flow, temperature and other process quantities are illustrative and not calibrated field data.',
 indicators:'Indicators need correct terminal connections and current virtual supply/output states.'
};
export function GuideEquipment({kind}:{kind?:string}){
 const [query,setQuery]=useState('');
 const [family,setFamily]=useState<DeviceFamily>('all');
 const selected=kind?COMPONENTS[kind as ComponentKind]:undefined;
 if(kind&&!selected)return <section><h2>Equipment not found</h2><p>The requested equipment is not registered in this version.</p><Link to="/guide/equipment">Browse the equipment index</Link></section>;
 if(selected){
  const f=familyForKind(selected.kind);
  const left=selected.terminals.filter(t=>t.side==='left'),right=selected.terminals.filter(t=>t.side==='right');
  return <article data-steady-equipment-detail={selected.kind} className="sg-prose">
   <p className="sg-eyebrow">{DEVICE_FAMILIES.find(a=>a.id===f)?.label} · Simulator component</p>
   <h2>{selected.label}</h2>
   <p className="sg-lede">{selected.help}</p>
   <div className="sg-note"><strong>When to use it:</strong> {familyNote[f]}</div>
   <h3>Connection points</h3>
   <p>These are the actual terminal names from the component registry. Terminal roles are explanations of the teaching model, not an installation diagram.</p>
   <div className="sg-terminal-diagram" role="group" aria-label={'Terminals of '+selected.label}>
    <div><strong>Left side</strong>{left.length?left.map(t=><div className="sg-terminal" key={t.name}><code>{t.name}</code><small>{t.role}</small></div>):<span>None</span>}</div>
    <div className="sg-device-label">{selected.label}<small>Virtual component</small></div>
    <div><strong>Right side</strong>{right.length?right.map(t=><div className="sg-terminal" key={t.name}><code>{t.name}</code><small>{t.role}</small></div>):<span>None</span>}</div>
   </div>
   <h3>How to find and inspect it</h3>
   <ol><li>Open the Simulator and pause if it is running.</li><li>Expand the Component library and choose the {DEVICE_FAMILIES.find(a=>a.id===f)?.label} family, or search for {selected.label}.</li><li>Place the component and select it to read the Inspector and model limits.</li><li>Use Logical/Wire to connect compatible named terminals; then observe outputs using Run/Step and diagnostics.</li></ol>
   {selected.kind==='estop'&&<p className="sg-warning">The training E-stop is not redundant or safety-rated; never use this diagram as a real machinery safety circuit.</p>}
   {selected.kind==='three-phase-supply'&&<p className="sg-warning">The three-phase source is a separate virtual 400 V teaching domain and is not compatible with the virtual 24 V controls.</p>}
   <p className="sg-actions"><Link className="sg-button" to="/sandbox">Find in the simulator</Link><Link to="/guide/topic/wire-safely">Learn terminal wiring</Link><Link to="/guide/equipment">All equipment</Link></p>
  </article>;
 }
 const list=GUIDE_EQUIPMENT_KINDS.map(k=>COMPONENTS[k]).filter(Boolean)
  .filter(d=>family==='all'||familyForKind(d.kind)===family)
  .filter(d=>!query.trim()||[d.kind,d.label,d.help].join(' ').toLowerCase().includes(query.trim().toLowerCase().slice(0,80)));
 return <section data-steady-equipment-index>
  <h2>Equipment encyclopedia</h2>
  <p>Browse the actual registered parts. Open an item to see its purpose, named terminals and modeled limitations.</p>
  <div className="sg-filter"><label>Search equipment<input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="PLC, sensor, conveyor, relay…"/></label>
   <label>Device family<select value={family} onChange={e=>setFamily(e.target.value as DeviceFamily)}>{DEVICE_FAMILIES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label></div>
  <p role="status">{list.length} equipment types shown</p>
  <div className="sg-card-grid">{list.map(d=><Link className="sg-card" to={'/guide/equipment/'+encodeURIComponent(d.kind)} key={d.kind}><small>{DEVICE_FAMILIES.find(f=>f.id===familyForKind(d.kind))?.label}</small><h3>{d.label}</h3><p>{d.help}</p><span>Terminals: {d.terminals.length} · View details</span></Link>)}</div>
 </section>;
}
