import React,{useMemo,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {SceneShell} from './SceneShell';
import {
 EQUIPMENT_KINDS,WORKCELL_STORAGE_KEY,defaultLayout,validateLayout,addEquipment,
 updateEquipment,moveEquipment,removeEquipment,rotateEquipment,parseLayout,
 serializeLayout,initialScan,stepWorkcell,deviceSignals,persistLayout,readLayout,
 type Equipment,type EquipmentKind,type WorkcellLayout,type WorkcellCommands,type WorkcellScan
} from '../engineering/workcell-layout';
import './workcell-composer.css';

const names:Readonly<Record<EquipmentKind,string>>={
 'conveyor':'Conveyor','tank':'Process tank','cylinder':'Pneumatic cylinder',
 'pump':'Pump skid','photoeye':'Photoelectric sensor','control-panel':'PLC panel','fence':'Safety fence'
};
function EquipmentMesh({item,selected,scan,onSelect}:{item:Equipment;selected:boolean;scan:WorkcellScan;onSelect:()=>void}){
 const state=scan.devices[item.id];
 const active=state?.active??false;
 const level=state?.value??0;
 const frame='#647d97',metal='#9fb1c3',idle='#31536a',live='#46d6b6';
 return <group position={[item.x,0,item.z]} rotation={[0,item.rotation*Math.PI/2,0]} onClick={event=>{event.stopPropagation();onSelect();}}>
  {item.kind==='conveyor'&&<group>
   <mesh position={[0,.38,0]}><boxGeometry args={[2.25,.26,.85]}/><meshStandardMaterial color={active?'#238478':'#354f64'}/></mesh>
   {[-.84,.84].map(x=><mesh key={x} position={[x,.16,0]}><boxGeometry args={[.12,.33,.85]}/><meshStandardMaterial color={metal}/></mesh>)}
   <mesh position={[-.75,.63,0]}><boxGeometry args={[.3,.25,.34]}/><meshStandardMaterial color={active?'#ebba60':idle}/></mesh>
  </group>}
  {item.kind==='tank'&&<group>
   <mesh position={[0,.56,0]}><cylinderGeometry args={[.48,.48,1.02,24]}/><meshStandardMaterial color={frame} transparent opacity={.43}/></mesh>
   <mesh position={[0,.11+level*.5,0]}><cylinderGeometry args={[.46,.46,Math.max(.02,level*.96),24]}/><meshStandardMaterial color="#299dc6" transparent opacity={.74}/></mesh>
   <mesh position={[0,1.1,0]}><cylinderGeometry args={[.53,.53,.07,24]}/><meshStandardMaterial color={metal}/></mesh>
  </group>}
  {item.kind==='cylinder'&&<group>
   <mesh position={[0,.4,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.24,.24,.95,14]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[.45+level*.65,.4,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.075,.075,.65,12]}/><meshStandardMaterial color={metal} metalness={.65}/></mesh>
   <mesh position={[-.42,.15,0]}><boxGeometry args={[.3,.3,.5]}/><meshStandardMaterial color={idle}/></mesh>
  </group>}
  {item.kind==='pump'&&<group>
   <mesh position={[0,.3,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.3,.3,.65,20]}/><meshStandardMaterial color={active?live:frame}/></mesh>
   <mesh position={[.43,.35,0]}><boxGeometry args={[.38,.18,.3]}/><meshStandardMaterial color={metal}/></mesh>
  </group>}
  {item.kind==='photoeye'&&<group>
   <mesh position={[0,.4,0]}><boxGeometry args={[.18,.2,.2]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[0,.48,.11]}><sphereGeometry args={[.075,12,12]}/><meshStandardMaterial color={active?live:'#ee9d67'} emissive={active?'#125c52':'#592d1a'}/></mesh>
   <mesh position={[0,.19,0]}><boxGeometry args={[.055,.4,.055]}/><meshStandardMaterial color={metal}/></mesh>
  </group>}
  {item.kind==='control-panel'&&<group>
   <mesh position={[0,.72,0]}><boxGeometry args={[.64,1.34,.38]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[0,.9,.202]}><boxGeometry args={[.42,.43,.03]}/><meshStandardMaterial color="#122b3e"/></mesh>
   <mesh position={[-.12,.59,.221]}><sphereGeometry args={[.07,12,12]}/><meshStandardMaterial color={active?live:'#d6a552'}/></mesh>
  </group>}
  {item.kind==='fence'&&<group>
   {[-.57,.57].map(x=><mesh key={x} position={[x,.62,0]}><boxGeometry args={[.09,1.22,.09]}/><meshStandardMaterial color="#e6bb39"/></mesh>)}
   {[.27,.74,1.12].map(y=><mesh key={y} position={[0,y,0]}><boxGeometry args={[1.22,.045,.045]}/><meshStandardMaterial color={metal}/></mesh>)}
  </group>}
  {selected&&<mesh position={[0,.012,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.84,.94,32]}/><meshBasicMaterial color="#8afbe8" side={2}/></mesh>}
 </group>;
}
function Workcell3D({layout,scan,selected,onSelect}:{layout:WorkcellLayout;scan:WorkcellScan;selected:string|null;onSelect:(id:string)=>void}){
 return <SceneShell title="3D factory layout preview" summary={layout.equipment.length+' placed devices, simulated scan time '+scan.timeMs+' ms. All equipment can also be edited from the accessible plan view.'}>
  <Canvas camera={{position:[9,10,11],fov:51}} gl={{antialias:false,powerPreference:'low-power'}}>
   <color attach="background" args={['#0b1623']}/>
   <ambientLight intensity={1}/><directionalLight position={[7,13,6]} intensity={2}/>
   <gridHelper args={[13,13,'#607f9b','#344b60']}/>
   <mesh position={[0,-.06,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[14,14]}/><meshStandardMaterial color="#172838"/></mesh>
   {layout.equipment.map(item=><EquipmentMesh key={item.id} item={item} selected={selected===item.id} scan={scan} onSelect={()=>onSelect(item.id)}/>)}
   <OrbitControls makeDefault minDistance={4} maxDistance={25} maxPolarAngle={Math.PI/2.05}/>
  </Canvas>
 </SceneShell>;
}
const loadInitial=()=>{
 if(typeof window==='undefined')return {layout:defaultLayout(),source:'default' as const,warning:null};
 return readLayout(window.localStorage);
};
function saveFile(layout:WorkcellLayout){
 const blob=new Blob([serializeLayout(layout)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='plc-workcell-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetScan(){return {scan:initialScan(),commands:{} as Record<string,boolean>};}
export function WorkcellComposer(){
 const [start]=useState(loadInitial);
 const [layout,setLayout]=useState<WorkcellLayout>(start.layout);
 const [selected,setSelected]=useState<string|null>(start.layout.equipment[0]?.id??null);
 const [past,setPast]=useState<WorkcellLayout[]>([]);
 const [future,setFuture]=useState<WorkcellLayout[]>([]);
 const [scan,setScan]=useState<WorkcellScan>(initialScan);
 const [commands,setCommands]=useState<Record<string,boolean>>({});
 const [note,setNote]=useState(start.warning??'Place machines on the floor plan, then command and scan each device.');
 const [saveStatus,setSaveStatus]=useState(start.source==='recovery'?'Recovery loaded — export before replacing damaged primary.':'Stored locally; export JSON for an independent backup.');
 const [labelDraft,setLabelDraft]=useState('');
 const [tagDraft,setTagDraft]=useState('');
 const item=layout.equipment.find(x=>x.id===selected)??null;
 const signals=useMemo(()=>deviceSignals(layout,scan),[layout,scan]);
 const commit=(next:WorkcellLayout,focus?:string|null)=>{
  try{
   const valid=validateLayout(next);
   setPast(p=>[...p.slice(-29),layout]);setFuture([]);setLayout(valid);
   if(focus!==undefined)setSelected(focus);
   setScan(initialScan());setCommands({});
   try{persistLayout(window.localStorage,valid);setSaveStatus('Changes saved to this browser. Export a JSON copy for backup.');}
   catch(e){setSaveStatus('NOT SAVED locally: '+String(e)+'. Export JSON to preserve these changes.');}
   setNote('Layout updated. Simulated scan reset; no physical equipment is controlled.');
  }catch(error){setNote('Cannot apply change: '+String(error));}
 };
 const change=(fn:()=>WorkcellLayout,focus?:string|null)=>{try{commit(fn(),focus);}catch(e){setNote('Cannot apply change: '+String(e));}};
 const useSnapshot=(next:WorkcellLayout,other:'undo'|'redo')=>{
  setLayout(next);setScan(initialScan());setCommands({});setSelected(next.equipment[0]?.id??null);
  try{persistLayout(window.localStorage,next);setSaveStatus('Restored layout saved locally.');}
  catch(e){setSaveStatus('Restore NOT SAVED: '+String(e));}
  setNote(other==='undo'?'Reverted the last placement change.':'Reapplied placement change.');
 };
 const undo=()=>{
  if(!past.length)return;
  const next=past[past.length-1];setPast(p=>p.slice(0,-1));setFuture(f=>[layout,...f].slice(-30));useSnapshot(next,'undo');
 };
 const redo=()=>{
  if(!future.length)return;
  const next=future[future.length-1];setFuture(f=>f.slice(0,-1));setPast(p=>[...p,layout].slice(-30));useSnapshot(next,'redo');
 };
 const onDrop=(event:React.DragEvent<HTMLButtonElement>,x:number,z:number)=>{
  event.preventDefault();const payload=event.dataTransfer.getData('text/plain');
  if(payload.startsWith('kind:')){
   const kind=payload.slice(5) as EquipmentKind;
   change(()=>{const added=addEquipment(layout,kind),last=added.equipment[added.equipment.length-1];return updateEquipment(added,last.id,{x,z});});
  }else if(payload.startsWith('item:')){
   const id=payload.slice(5);change(()=>updateEquipment(layout,id,{x,z}),id);
  }
 };
 const step=(count:number)=>{
  try{
   let current=scan;
   for(let i=0;i<count;i++)current=stepWorkcell(layout,current,commands,100);
   setScan(current);setNote('Executed '+count+' deterministic scan(s) at 100 ms each.');
  }catch(error){setNote('Scan stopped: '+String(error));}
 };
 const selectedInput=(id:string)=>{setSelected(id);setLabelDraft('');setTagDraft('');};
 const changeProperties=()=>{if(!item)return;change(()=>updateEquipment(layout,item.id,{label:labelDraft.trim()||item.label,tag:(tagDraft.trim()||item.tag).toUpperCase()}),item.id);};
 const readFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{if(file.size>40000)throw RangeError('File exceeds 40 KB');
   const next=parseLayout(await file.text());commit(next,next.equipment[0]?.id??null);setNote('Validated workcell imported. Previous state is available through Undo.');
  }catch(error){setNote('Import rejected: '+String(error));}
 };
 const selectedLabel=item?.label??'None';
 return <section className="portal-page workcell-builder">
  <span className="eyebrow">SCENE AUTHORING / OFFLINE FACTORY WORKCELL</span>
  <div className="page-heading"><div><h1>Factory workcell composer</h1>
   <p>Arrange conveyors, tanks, pneumatic cylinders, pumps, sensors and control panels on a bounded grid. Preview in 3D, run deterministic teaching scans, inspect I/O and save an editable project offline.</p></div>
   <div className="actions"><button onClick={()=>saveFile(layout)}>Export scene JSON</button><label className="composer-import">Import scene JSON<input type="file" accept=".json,application/json" onChange={readFile}/></label></div>
  </div>
  <p className="muted">Educational digital scene authoring only. This editor does not simulate industrial pressure, forces, electrical energy, collisions or certified PLC behavior.</p>
  <div className="composer-toolbar">
   <label>Scene title<input aria-label="Scene title" value={layout.name} maxLength={60} onChange={e=>setLayout(old=>({...old,name:e.target.value}))} onBlur={()=>change(()=>validateLayout({...layout,name:layout.name.trim()||'Untitled workcell'}))}/></label>
   <button disabled={!past.length} onClick={undo}>Undo</button><button disabled={!future.length} onClick={redo}>Redo</button>
   <button onClick={()=>{if(window.confirm('Replace the current workcell? Export it first if you need a copy.'))commit(defaultLayout(),'cv1');}}>Reset scene</button>
  </div>
  <div className="metric-grid">
   <div className="metric"><b>{layout.equipment.length} / 32</b><span>Placed equipment</span></div>
   <div className="metric"><b>{scan.timeMs} ms</b><span>Simulation clock</span></div>
   <div className="metric"><b>{Object.values(commands).filter(Boolean).length}</b><span>Active command switches</span></div>
   <div className="metric"><b>{selectedLabel}</b><span>Selected equipment</span></div>
  </div>
  <div className="workspace">
   <div>
    <Workcell3D layout={layout} scan={scan} selected={selected} onSelect={selectedInput}/>
    <div className="panel"><h2>Floor plan — 13 × 13 grid</h2>
     <p className="muted">Drag equipment from the palette or select existing equipment and use the arrow buttons. Grid positions are idealized anchors and do not represent collision-free machine clearance.</p>
     <div className="composer-grid" role="grid" aria-label="Workcell floor plan">
      {Array.from({length:169},(_,i)=>{
       const x=i%13-6,z=Math.floor(i/13)-6,obj=layout.equipment.find(d=>d.x===x&&d.z===z);
       return <button key={x+':'+z} type="button" role="gridcell"
        className={'composer-cell '+(obj?'occupied ':'')+(obj&&selected===obj.id?'selected':'')}
        aria-label={(obj?obj.label+' '+obj.kind:'Empty slot')+' at '+x+', '+z}
        draggable={Boolean(obj)}
        onDragStart={e=>{if(obj)e.dataTransfer.setData('text/plain','item:'+obj.id);}}
        onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,x,z)}
        onClick={()=>obj?selectedInput(obj.id):setNote('Empty grid position ('+x+', '+z+'). Drag a palette item here to place it.')}>
        {obj?obj.tag.slice(0,5):'·'}
       </button>;
      })}
     </div>
    </div>
    <div className="panel"><h2>Teaching device scan</h2>
     <p className="muted">Toggle commands and advance in 100 ms simulated steps. Motion curves are normalized demonstrations, not calibrated physical models.</p>
     <div className="composer-devices">
      {layout.equipment.map(d=>{
       const s=scan.devices[d.id];
       return <div key={d.id} className="composer-device">
        <button onClick={()=>selectedInput(d.id)} aria-pressed={selected===d.id}><b>{d.tag}</b> {d.label}</button>
        {d.kind!=='fence'&&<label><input type="checkbox" checked={commands[d.id]===true} onChange={e=>setCommands(p=>({...p,[d.id]:e.target.checked}))}/> Command ON</label>}
        <span>{s?(s.value*100).toFixed(1)+'%':'0.0%'}</span>
       </div>;
      })}
     </div>
     <div className="actions"><button className="primary" onClick={()=>step(1)}>Scan 100 ms</button><button onClick={()=>step(10)}>Scan 1 s</button><button onClick={()=>{setScan(initialScan());setCommands({});setNote('Simulated machine state reset.');}}>Reset scan</button></div>
     <h3>Current I/O and feedback snapshot</h3>
     <div className="composer-signals">{Object.entries(signals).map(([key,value])=><div key={key}><code>{key}</code><strong>{typeof value==='boolean'?(value?'TRUE':'FALSE'):String(value)}</strong></div>)}</div>
    </div>
   </div>
   <aside>
    <div className="panel"><h2>Equipment palette</h2>
     <p className="muted">Click to add at the next available anchor, or drag a tile to the floor plan.</p>
     <div className="composer-palette">{EQUIPMENT_KINDS.map(kind=><button key={kind} draggable onDragStart={e=>e.dataTransfer.setData('text/plain','kind:'+kind)} onClick={()=>change(()=>addEquipment(layout,kind))}>{names[kind]}</button>)}</div>
    </div>
    <div className="panel"><h2>Properties / placement</h2>
     {!item?<p>Choose a device from the floor plan.</p>:<>
      <p><strong>{names[item.kind]}</strong> · <code>{item.id}</code></p>
      <label>Label<input key={item.id+'label'} value={labelDraft||item.label} onChange={e=>setLabelDraft(e.target.value)} maxLength={48}/></label>
      <label>I/O base tag<input key={item.id+'tag'} value={tagDraft||item.tag} onChange={e=>setTagDraft(e.target.value.toUpperCase())} maxLength={24}/></label>
      <button onClick={changeProperties}>Apply properties</button>
      <p className="muted">X={item.x}, Z={item.z}, orientation={item.rotation*90}°</p>
      <div className="composer-arrows">
       <button aria-label="Move north" onClick={()=>change(()=>moveEquipment(layout,item.id,0,-1),item.id)}>↑</button>
       <button aria-label="Move west" onClick={()=>change(()=>moveEquipment(layout,item.id,-1,0),item.id)}>←</button>
       <button aria-label="Move east" onClick={()=>change(()=>moveEquipment(layout,item.id,1,0),item.id)}>→</button>
       <button aria-label="Move south" onClick={()=>change(()=>moveEquipment(layout,item.id,0,1),item.id)}>↓</button>
       <button onClick={()=>change(()=>rotateEquipment(layout,item.id),item.id)}>Rotate 90°</button>
       <button onClick={()=>change(()=>removeEquipment(layout,item.id),null)}>Remove device</button>
      </div>
     </>}
    </div>
    <div className="panel"><h2>Offline project integrity</h2>
     <p>{saveStatus}</p><p className="muted">Storage key: <code>{WORKCELL_STORAGE_KEY}</code>. Saved projects contain layout only—not actual machine operation or safety evidence.</p>
     <p role="status" aria-live="polite">{note}</p>
    </div>
   </aside>
  </div>
 </section>;
}
