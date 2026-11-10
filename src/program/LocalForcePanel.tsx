import { useEffect, useState } from 'react';
import type { LadderDocument } from '../engineering/ladder';
import { localForceError } from './local-force';

type Props = {
  document: LadderDocument; disabled: boolean;
  active: Readonly<Record<string,boolean|number>>;
  liveValues: Readonly<Record<string,boolean|number>>;
  onForce: (tag:string,value:boolean|number|null)=>void;
};

/** Training-only force controls: per-PLC LOCAL Ladder symbols, never real I/O. */
export function LocalForcePanel({document,disabled,active,liveValues,onForce}:Props) {
  const [tag,setTag]=useState('');
  const [value,setValue]=useState('true');
  const [error,setError]=useState('');
  const symbols=document.symbols??{};
  const permitted=Object.keys(symbols).filter(name=>localForceError(document,name,null)===null);
  const selected=permitted.includes(tag)?tag:permitted[0]??'';
  const kind=selected?(symbols[selected]?.type??'BOOL'):'BOOL';
  useEffect(()=>{setValue(kind==='BOOL'?'true':String(liveValues[selected]??symbols[selected]?.initial??0));setError('');},[selected,kind]);
  const commit=()=>{
    if(!selected)return;
    const force=kind==='BOOL' ? value==='true' : Number(value);
    const check=localForceError(document,selected,force);
    if(check){setError(check);return;}
    onForce(selected,force);setError('');
  };
  return <details className="sandbox-p2-local-forces">
    <summary>PLC-local debug forces · {Object.keys(active).length} active</summary>
    <p className="sandbox-help">Educational, explicitly marked internal-memory overrides. Never forces physical inputs, outputs, safety/guard wiring, or real equipment. Simulation must be paused to set/remove a force; activation occurs at the next PLC scan.</p>
    <div className="sandbox-p2-force-flags" role="list" aria-label="Active debug force indicators">
      {Object.entries(active).map(([name,current])=><div role="listitem" key={name}>
        <code>FORCED {name} = {typeof current==='boolean'?(current?'TRUE':'FALSE'):current}</code>
        <button type="button" className="btn ghost small" disabled={disabled}
          onClick={()=>onForce(name,null)} aria-label={'Release local force '+name}>Release</button>
      </div>)}
      {!Object.keys(active).length&&<p className="sandbox-help">No local forces armed.</p>}
    </div>
    <div className="sandbox-p2-force-editor">
      <label>Internal Ladder tag
        <select value={selected} disabled={disabled||!permitted.length}
          aria-label="Local debug force tag" onChange={e=>setTag(e.target.value)}>
          {permitted.map(name=><option key={name} value={name}>{name} · {symbols[name].type??'BOOL'}</option>)}
        </select>
      </label>
      <label>Override value
        {kind==='BOOL'?<select value={value} disabled={disabled||!selected} aria-label="Local debug force value"
          onChange={e=>setValue(e.target.value)}>
          <option value="true">TRUE</option><option value="false">FALSE</option>
        </select>:<input type="number" step={kind==='REAL'?'any':'1'} disabled={disabled||!selected}
          aria-label="Local debug force numeric value" value={value} onChange={e=>setValue(e.target.value)}/>}
      </label>
      <button type="button" className="btn ghost small" disabled={disabled||!selected} onClick={commit}>Apply local force</button>
    </div>
    {error&&<p role="alert">{error}</p>}
  </details>;
}
