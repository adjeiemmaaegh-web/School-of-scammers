import {useMemo,useState} from 'react';
import {SIGNALS,csvRecorder,detectEdges,signalStats,type Recorder} from '../engineering/scan-instruments';

function download(text:string,name:string){const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ScanInstruments({recorder}:{recorder:Recorder}){
 const [selected,setSelected]=useState<string[]>(['motor','belt','sensor','photoeye']);
 const [trigger,setTrigger]=useState('motor');
 const samples=recorder.samples;
 const edges=useMemo(()=>detectEdges(recorder,trigger),[recorder,trigger]);
 const width=720,height=240,pad=28;
 const windowSamples=samples.slice(-150);
 const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length>=4?[...s.slice(1),id]:[...s,id]);
 return <div className="panel"><h2>PLC scan instruments · logic analyzer</h2><p>Recorded from executed PLC scans. Inspect digital transitions, compare motor command with feedback, and export readings for offline analysis. All timestamps are simulated.</p>
 <div className="actions">{SIGNALS.map(signal=><label key={signal.id} style={{display:'inline-flex',gap:5,alignItems:'center'}}><input type="checkbox" checked={selected.includes(signal.id)} onChange={()=>toggle(signal.id)}/>{signal.label}</label>)}</div>
 <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Scan-based signal traces" style={{width:'100%',background:'#0f172a',borderRadius:8}}>
 {Array.from({length:5},(_,i)=><line key={i} x1={pad} x2={width-10} y1={pad+i*45} y2={pad+i*45} stroke="#334155" strokeDasharray="3 5"/>)}
 {selected.map((id,i)=>{const signal=SIGNALS.find(x=>x.id===id)!;const values=windowSamples.map(s=>s.values[id]);const min=signal.kind==='digital'?0:Math.min(0,...values),max=signal.kind==='digital'?1:Math.max(1,...values);const span=Math.max(1,max-min);const color=['#38bdf8','#fbbf24','#4ade80','#f472b6','#c084fc','#fb923c'][i%6];const points=windowSamples.map((s,j)=>`${pad+j*Math.max(1,(width-pad-12)/(Math.max(1,windowSamples.length-1)))},${pad+((i%4)*49)+35-(s.values[id]-min)/span*30}`).join(' ');return <g key={id}><polyline fill="none" stroke={color} strokeWidth="2" points={points}/><text x={pad+4} y={pad+(i%4)*49+42} fill={color} fontSize="11">{signal.label}</text></g>;})}
 </svg>
 <p>Samples: {samples.length} / {recorder.capacity} · Last scan: {samples.at(-1)?.scan??'none'} · Trace shows latest 150 samples. Signal rows repeat after four selected traces; select up to four for clear viewing.</p>
 <div className="actions"><label>Edge trigger <select value={trigger} onChange={e=>setTrigger(e.target.value)}>{SIGNALS.filter(s=>s.kind==='digital').map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button disabled={!samples.length||!selected.length} onClick={()=>download(csvRecorder(recorder,selected),'plc-scan-traces.csv')}>Export selected traces CSV</button></div>
 <h3>Digital edge history</h3><div className="log" style={{maxHeight:130,overflow:'auto'}}>{edges.slice(-12).reverse().map(e=><p key={`${e.scan}-${e.direction}`}>Scan {e.scan} · {e.timeMs} ms · {e.direction.toUpperCase()}</p>)}{!edges.length&&<p>No recorded transitions.</p>}</div>
 <h3>Signal readings</h3><div className="io">{selected.map(id=>{const s=SIGNALS.find(x=>x.id===id)!;const stats=signalStats(recorder,id);return <div key={id}><code>{s.label}</code><strong>{stats?`${Number(stats.last.toFixed(2))} ${s.unit}`:'No data'}</strong><span>{stats?`Min ${Number(stats.min.toFixed(2))} · Max ${Number(stats.max.toFixed(2))}`:''}</span></div>;})}</div>
 </div>;
}
