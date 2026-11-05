import React,{useMemo,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {SceneShell} from './SceneShell';
import {
 EQUIPMENT_KINDS,DYNAMIC_EQUIPMENT_KINDS,defaultDynamics,WORKCELL_STORAGE_KEY,defaultLayout,validateLayout,addEquipment,
 updateEquipment,moveEquipment,removeEquipment,rotateEquipment,parseLayout,
 serializeLayout,initialScan,stepWorkcell,deviceSignals,persistLayout,readLayout,restoreLayoutFromRecovery,
 type Equipment,type EquipmentKind,type WorkcellLayout,type WorkcellCommands,type WorkcellScan
} from '../engineering/workcell-layout';
import {stepWorkcellPlc,initialWorkcellPlcState,DEFAULT_OPERATOR_PANEL,DEMO_WORKCELL_PROGRAM,type OperatorPanel} from '../engineering/workcell-plc';
import {parseProject} from '../engineering/project-file';
import type {LadderDocument} from '../engineering/ladder';
import {WORKCELL_PRESETS,loadWorkcellPreset} from '../engineering/workcell-presets';
import {runScenarioAcceptance,type ScenarioAcceptanceReport} from '../engineering/workcell-scenario-acceptance';
import {injectMaterial,initialMaterialFlow,materialWorldPosition,sampleMaterialSensors,materialSignals,type MaterialFlowState,type MaterialKind} from '../engineering/workcell-material';
import {loadMaterialLineExercise} from '../engineering/workcell-material-exercise';
import './workcell-composer.css';

const names:Readonly<Record<EquipmentKind,string>>={
 'conveyor':'Conveyor','tank':'Process tank','cylinder':'Pneumatic cylinder',
 'pump':'Pump skid','photoeye':'Photoelectric sensor','control-panel':'PLC panel','fence':'Safety fence',
 'vfd':'Variable-speed drive','lift':'Vertical transfer lift','pusher':'Linear pusher',
 'valve':'Process valve','proximity':'Inductive proximity sensor','indicator':'Signal beacon'
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
  {item.kind==='vfd'&&<group>
   <mesh position={[0,.48,0]}><boxGeometry args={[.72,.9,.38]}/><meshStandardMaterial color={frame} metalness={.4}/></mesh>
   <mesh position={[0,.67,.202]}><boxGeometry args={[.52,.3,.035]}/><meshStandardMaterial color="#102c42" emissive={active?'#093b32':'#000000'}/></mesh>
   <mesh position={[0,.38,.203]}><boxGeometry args={[.42,.09,.03]}/><meshStandardMaterial color={active?live:'#b0c2d1'}/></mesh>
   <mesh position={[0,.14,0]}><boxGeometry args={[.78,.12,.42]}/><meshStandardMaterial color={idle}/></mesh>
  </group>}
  {item.kind==='lift'&&<group>
   {[-.55,.55].map(x=><mesh key={x} position={[x,.9,0]}><boxGeometry args={[.1,1.8,.13]}/><meshStandardMaterial color={metal}/></mesh>)}
   <mesh position={[0,.24+level*1.36,0]}><boxGeometry args={[1.25,.12,.95]}/><meshStandardMaterial color={active?live:frame}/></mesh>
   <mesh position={[0,.08,0]}><boxGeometry args={[1.5,.12,1.1]}/><meshStandardMaterial color={idle}/></mesh>
  </group>}
  {item.kind==='pusher'&&<group>
   <mesh position={[-.55,.3,0]}><boxGeometry args={[.55,.44,.48]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[-.04+level*.5,.3,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.07,.07,.7,12]}/><meshStandardMaterial color={metal}/></mesh>
   <mesh position={[.35+level*.8,.3,0]}><boxGeometry args={[.13,.55,.7]}/><meshStandardMaterial color={active?live:'#d6b065'}/></mesh>
  </group>}
  {item.kind==='valve'&&<group>
   <mesh position={[0,.3,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.24,.24,.82,16]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[0,.63,0]}><cylinderGeometry args={[.2,.2,.22,12]}/><meshStandardMaterial color={active?live:metal}/></mesh>
   <mesh position={[0,.79,0]} rotation={[0,level*Math.PI/2,0]}><boxGeometry args={[.7,.055,.12]}/><meshStandardMaterial color="#e9b95f"/></mesh>
  </group>}
  {item.kind==='proximity'&&<group>
   <mesh position={[0,.45,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.11,.11,.62,12]}/><meshStandardMaterial color={metal}/></mesh>
   <mesh position={[.35,.45,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.12,.12,.05,12]}/><meshStandardMaterial color={active?live:'#a55e50'}/></mesh>
   <mesh position={[0,.17,0]}><boxGeometry args={[.08,.37,.08]}/><meshStandardMaterial color={frame}/></mesh>
  </group>}
  {item.kind==='indicator'&&<group>
   <mesh position={[0,.18,0]}><cylinderGeometry args={[.22,.22,.32,16]}/><meshStandardMaterial color={frame}/></mesh>
   <mesh position={[0,.48,0]}><cylinderGeometry args={[.18,.18,.38,16]}/><meshStandardMaterial color={active?'#e8bc5d':'#695c47'} emissive={active?'#6b450c':'#000000'} emissiveIntensity={active?.5:0}/></mesh>
   <mesh position={[0,.71,0]}><cylinderGeometry args={[.2,.2,.06,16]}/><meshStandardMaterial color={metal}/></mesh>
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
function Workcell3D({layout,scan,material,selected,onSelect}:{layout:WorkcellLayout;scan:WorkcellScan;material:MaterialFlowState;selected:string|null;onSelect:(id:string)=>void}){
 return <SceneShell title="3D factory layout preview" summary={layout.equipment.length+' placed devices and '+material.units.length+' tracked parcels, simulated scan time '+scan.timeMs+' ms. All equipment can also be edited from the accessible plan view.'}>
  <Canvas camera={{position:[9,10,11],fov:51}} gl={{antialias:false,powerPreference:'low-power'}}>
   <color attach="background" args={['#0b1623']}/>
   <ambientLight intensity={1}/><directionalLight position={[7,13,6]} intensity={2}/>
   <gridHelper args={[13,13,'#607f9b','#344b60']}/>
   <mesh position={[0,-.06,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[14,14]}/><meshStandardMaterial color="#172838"/></mesh>
   {layout.equipment.map(item=><EquipmentMesh key={item.id} item={item} selected={selected===item.id} scan={scan} onSelect={()=>onSelect(item.id)}/>)}
   {material.units.map(part=>{
    const conveyor=layout.equipment.find(e=>e.id===part.conveyorId&&e.kind==='conveyor');
    if(!conveyor)return null;
    const where=materialWorldPosition(conveyor,part.progress);
    return <mesh key={part.id} position={[where.x,.68,where.z]} rotation={[0,conveyor.rotation*Math.PI/2,0]}>
      <boxGeometry args={[.4,.32,.4]}/>
      <meshStandardMaterial color={part.kind==='metal'?'#a9d9f5':'#e5b77c'} metalness={part.kind==='metal'?.75:0}/>
    </mesh>;
   })}
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
 const [controlMode,setControlMode]=useState<'manual'|'ladder'>('manual');
 const [materialMode,setMaterialMode]=useState(false);
 const [materialConveyorId,setMaterialConveyorId]=useState(start.layout.equipment.find(e=>e.kind==='conveyor')?.id??'');
 const [program,setProgram]=useState<LadderDocument>(DEMO_WORKCELL_PROGRAM);
 const [plc,setPlc]=useState(initialWorkcellPlcState);
 const [operator,setOperator]=useState<OperatorPanel>(DEFAULT_OPERATOR_PANEL);
 const [programLabel,setProgramLabel]=useState('Sample automatic conveyor / diverter ladder');
 const [presetId,setPresetId]=useState<string>(WORKCELL_PRESETS[0].id);
 const [acceptance,setAcceptance]=useState<ScenarioAcceptanceReport|null>(null);
 const [note,setNote]=useState(start.warning??'Place machines on the floor plan, then command and scan each device.');
 const [recoveryAvailable,setRecoveryAvailable]=useState(start.source==='recovery');
 const [saveStatus,setSaveStatus]=useState(start.source==='recovery'?'Recovery loaded — export before replacing damaged primary.':'Stored locally; export JSON for an independent backup.');
 const [labelDraft,setLabelDraft]=useState('');
 const [tagDraft,setTagDraft]=useState('');
 const [riseDraft,setRiseDraft]=useState('');
 const [fallDraft,setFallDraft]=useState('');
 const item=layout.equipment.find(x=>x.id===selected)??null;
 const signals=useMemo(()=>({...deviceSignals(layout,scan),...(materialMode?materialSignals(plc.material):{})}),[layout,scan,materialMode,plc.material]);
 const materialSensorImage=useMemo(()=>materialMode?sampleMaterialSensors(layout,plc.material):{},[layout,plc.material,materialMode]);
 const commit=(next:WorkcellLayout,focus?:string|null)=>{
  try{
   const valid=validateLayout(next);
   setAcceptance(null);
   setPast(p=>[...p.slice(-29),layout]);setFuture([]);setLayout(valid);
   setMaterialMode(false);setMaterialConveyorId(valid.equipment.find(e=>e.kind==='conveyor')?.id??'');
   if(focus!==undefined)setSelected(focus);
   setScan(initialScan());setPlc(initialWorkcellPlcState());setCommands({});
   try{persistLayout(window.localStorage,valid);setSaveStatus('Changes saved to this browser. Export a JSON copy for backup.');}
   catch(e){setSaveStatus('NOT SAVED locally: '+String(e)+'. Export JSON to preserve these changes.');}
   setNote('Layout updated. Simulated scan reset; no physical equipment is controlled.');
  }catch(error){setNote('Cannot apply change: '+String(error));}
 };
 const change=(fn:()=>WorkcellLayout,focus?:string|null)=>{try{commit(fn(),focus);}catch(e){setNote('Cannot apply change: '+String(e));}};
 const restoreBackup=()=>{
  if(!window.confirm('Restore your last valid scene backup? First export any unsaved edits.'))return;
  try{
   const next=restoreLayoutFromRecovery(window.localStorage);
   setLayout(next);setPast([]);setFuture([]);setSelected(next.equipment[0]?.id??null);
   setMaterialMode(false);setMaterialConveyorId(next.equipment.find(e=>e.kind==='conveyor')?.id??'');
   setScan(initialScan());setPlc(initialWorkcellPlcState());setCommands({});
   setRecoveryAvailable(false);setSaveStatus('Recovered scene restored; original damaged bytes preserved separately.');
   setNote('Scene recovery completed. Export a JSON backup now.');
  }catch(error){setNote('Could not restore backup: '+String(error));}
 };
 const useSnapshot=(next:WorkcellLayout,other:'undo'|'redo')=>{
  setLayout(next);setScan(initialScan());setPlc(initialWorkcellPlcState());setCommands({});setSelected(next.equipment[0]?.id??null);
  setMaterialMode(false);setMaterialConveyorId(next.equipment.find(e=>e.kind==='conveyor')?.id??'');
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
   if(controlMode==='ladder'){
    let current=plc;
    for(let i=0;i<count;i++)current=stepWorkcellPlc(layout,program,current,operator,commands,100,{materialFlow:materialMode});
    setPlc(current);setScan(current.plant);
    setNote('Executed '+count+' ladder-controlled scan(s). Field inputs are sampled then coils update the virtual plant.');
   }else{
    let current=scan;
    for(let i=0;i<count;i++)current=stepWorkcell(layout,current,commands,100);
    setScan(current);setNote('Executed '+count+' deterministic manual scan(s) at 100 ms each.');
   }
  }catch(error){setNote('Scan stopped: '+String(error));}
 };
 const loadLadder=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{if(file.size>250000)throw RangeError('PLC project exceeds 250 KB');
   const candidate=parseProject(await file.text());
   setProgram(candidate.program);setProgramLabel(candidate.name);setAcceptance(null);setPlc(initialWorkcellPlcState());setScan(initialScan());
   setMaterialMode(false);
   setControlMode('ladder');setNote('Validated PLC project loaded. Coils named TAG_CMD drive matching virtual equipment.');
  }catch(error){setNote('PLC project import rejected: '+String(error));}
 };
 const selectedInput=(id:string)=>{setSelected(id);setLabelDraft('');setTagDraft('');setRiseDraft('');setFallDraft('');};
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
   <p>Arrange conveyors, tanks, pneumatic cylinders, drives, lifts, pushers, valves and sensors on a bounded grid. Load a commissioning scenario, preview it in 3D, run deterministic ladder-controlled scans, inspect device feedback and export an editable project.</p></div>
   <div className="actions"><button onClick={()=>saveFile(layout)}>Export scene JSON</button><label className="composer-import">Import scene JSON<input type="file" accept=".json,application/json" onChange={readFile}/></label></div>
  </div>
  <p className="muted">Educational digital scene authoring only. This editor does not simulate industrial pressure, forces, electrical energy, collisions or certified PLC behavior.</p>
  <div className="composer-toolbar">
   <label>Scene title<input aria-label="Scene title" value={layout.name} maxLength={60} onChange={e=>setLayout(old=>({...old,name:e.target.value}))} onBlur={()=>change(()=>validateLayout({...layout,name:layout.name.trim()||'Untitled workcell'}))}/></label>
   <label>Commissioning scenario <select aria-label="Commissioning scenario template" value={presetId} onChange={e=>setPresetId(e.target.value)}>{WORKCELL_PRESETS.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
   <button onClick={()=>{
    try{
     const preset=loadWorkcellPreset(presetId);
     commit(preset.layout,preset.layout.equipment[0]?.id??null);
     setProgram(preset.program);setProgramLabel(preset.title);setControlMode('ladder');
     setNote('Loaded '+preset.title+' with a validated ladder program. Toggle the corresponding virtual sensor/panel field input and scan to observe machine motion.');
    }catch(error){setNote('Scenario rejected: '+String(error));}
   }}>Load commissioning scenario</button>
   <button onClick={()=>{
    try{
     const cell=loadMaterialLineExercise();commit(cell.layout,cell.layout.equipment[0]?.id??null);
     setProgram(cell.program);setProgramLabel(cell.title);setControlMode('ladder');setMaterialMode(true);setMaterialConveyorId('belt1');
     setNote('Parcel flow cell ready. Enable the operator panel, inject a part, and scan. Photoeye sensors are sampled from actual virtual part positions.');
    }catch(error){setNote('Parcel exercise cannot load: '+String(error));}
   }}>Load parcel flow cell</button>
   <button disabled={!past.length} onClick={undo}>Undo</button><button disabled={!future.length} onClick={redo}>Redo</button>
   <button onClick={()=>{if(window.confirm('Replace the current workcell? Export it first if you need a copy.'))commit(defaultLayout(),'cv1');}}>Reset scene</button>
  </div>
  <div className="metric-grid">
   <div className="metric"><b>{layout.equipment.length} / 32</b><span>Placed equipment</span></div>
   <div className="metric"><b>{scan.timeMs} ms</b><span>Simulation clock</span></div>
   <div className="metric"><b>{Object.values(commands).filter(Boolean).length}</b><span>Active command switches</span></div>
   <div className="metric"><b>{selectedLabel}</b><span>Selected equipment</span></div>
  </div>
  <section className="panel" aria-label="Machine commissioning acceptance">
   <h2>Run scenario commissioning checks</h2>
   <p className="muted">Run deterministic acceptance checks against the <strong>current editable layout and loaded PLC program</strong>. The inspection covers actual simulated scan outputs, modeled guard/E-stop inhibition, device activity, feedback, clock consistency and replay. It does not establish real-machine or safety certification.</p>
   <div className="actions"><button onClick={()=>{
    try{const report=runScenarioAcceptance(presetId as typeof WORKCELL_PRESETS[number]['id'],{layout,program});setAcceptance(report);setNote('Current scene commissioning: '+(report.passed?'all checks passed':'check failures detected'));}
    catch(error){setAcceptance(null);setNote('Cannot run current-scene FAT: '+String(error));}
   }}>Run current scene acceptance</button><span>{acceptance?acceptance.checks.filter(c=>c.passed).length+' / '+acceptance.checks.length+' criteria passed':'No current-scene acceptance run'}</span></div>
   {acceptance&&<div aria-label="Current scene acceptance results">
    <p role="status"><strong className={acceptance.passed?'good':'warn'}>{acceptance.passed?'PASS':'NOT PASSED'}</strong> · {acceptance.title} · {acceptance.scanCount} test scans · {acceptance.simulatedMs} simulated ms</p>
    <div className="io">{acceptance.checks.map(check=><div key={check.id}><code>{check.id}</code><strong className={check.passed?'good':'warn'}>{check.passed?'PASS':'FAIL'}</strong><span>{check.description} — {check.observed}</span></div>)}</div>
   </div>}
  </section>
  <div className="workspace">
   <div>
    <Workcell3D layout={layout} scan={scan} material={materialMode&&controlMode==='ladder'?plc.material:initialMaterialFlow()} selected={selected} onSelect={selectedInput}/>
    <div className="panel"><h2>Floor plan — 13 × 13 grid</h2>
     <p className="muted">Drag equipment from the palette or select existing equipment and use the arrow buttons. Grid positions are idealized anchors and do not represent collision-free machine clearance.</p>
     <div className="composer-grid" role="group" aria-label="Workcell floor plan — select a cell to edit equipment">
      {Array.from({length:169},(_,i)=>{
       const x=i%13-6,z=Math.floor(i/13)-6,obj=layout.equipment.find(d=>d.x===x&&d.z===z);
       return <button key={x+':'+z} type="button"
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
     <div className="composer-controls"><label><input type="radio" name="composer-control" checked={controlMode==='manual'} onChange={()=>{setControlMode('manual');setScan(initialScan());setPlc(initialWorkcellPlcState());setMaterialMode(false);}}/> Manual device commands</label>
     <label><input type="radio" name="composer-control" checked={controlMode==='ladder'} onChange={()=>{setControlMode('ladder');setScan(initialScan());setPlc(initialWorkcellPlcState());}}/> PLC ladder controlled</label></div>
     {controlMode==='ladder'&&<section className="composer-plc" aria-label="Virtual material flow controls">
      <h3>Simulated material handling</h3>
      <p className="muted">Opt-in parcel tracking derives optical/inductive sensor states from each part's geometric position at the start of a PLC scan. The safety permit independently inhibits actuator commands. Models are normalized, without collision forces or guaranteed conveyor throughput.</p>
      <label><input type="checkbox" aria-label="Enable geometric material sensors" checked={materialMode} onChange={event=>{
       setMaterialMode(event.target.checked);setPlc(initialWorkcellPlcState());setScan(initialScan());setCommands({});
       setNote(event.target.checked?'Geometric material sensing enabled. Reset and inject parts before scanning.':'Returned to manually toggled virtual sensor inputs.');
      }}/> Enable geometric sensor / parcel simulation</label>
      {materialMode&&<>
       <div className="actions">
        <label>Conveyor <select aria-label="Material infeed conveyor" value={materialConveyorId} onChange={event=>setMaterialConveyorId(event.target.value)}>
         {layout.equipment.filter(e=>e.kind==='conveyor').map(e=><option key={e.id} value={e.id}>{e.tag} — {e.label}</option>)}
        </select></label>
        {(['carton','metal'] as const).map(kind=><button key={kind} disabled={!layout.equipment.some(e=>e.kind==='conveyor')} onClick={()=>{
         try{setPlc(prev=>({...prev,material:injectMaterial(layout,prev.material,materialConveyorId,kind,prev.plant.timeMs)}));setNote('Inserted simulated '+kind+' at the infeed. Enable conveyor and scan to move it.');}
         catch(error){setNote('Infeed blocked: '+String(error));}
        }}>Inject {kind==='carton'?'carton':'metal part'}</button>)}
        <button onClick={()=>setPlc(prev=>({...prev,material:initialMaterialFlow()}))}>Clear material evidence</button>
       </div>
       <p role="status">Tracked: <b>{plc.material.units.length}</b> · Exited: <b>{plc.material.completed}</b> · Diverted: <b>{plc.material.diverted}</b> · Last {plc.material.events.length} events</p>
       <div className="io" aria-label="Material tracking results">{plc.material.units.map(part=><div key={part.id}><code>{part.id}</code><span>{part.kind} · {part.conveyorId} · {(part.progress*100).toFixed(1)}% belt travel</span></div>)}</div>
       <h4>Position-derived sensor image</h4><div className="composer-signals">{layout.equipment.filter(e=>e.kind==='photoeye'||e.kind==='proximity').map(e=><div key={e.id}><code>{e.tag}_ACTIVE</code><strong>{materialSensorImage[e.id]?'TRUE':'FALSE'}</strong></div>)}</div>
       <div className="io" aria-label="Material event log">{plc.material.events.slice(-10).map((event,index)=><div key={event.unitId+event.timeMs+event.kind+index}><code>{event.unitId}</code><span>{event.kind} · {event.timeMs} ms</span></div>)}</div>
      </>}
     </section>}
     {controlMode==='ladder'&&<div className="composer-plc">
      <p><b>Loaded PLC program:</b> {programLabel}</p>
      <p className="muted">Sensor/panel switches become sampled PLC inputs. Each virtual actuator listens for its base tag with _CMD appended, e.g. CV1_CMD or CY1_CMD. Virtual feedback appears as TAG_ACTIVE / TAG_EXTENDED / TAG_RETRACTED. No hardware connectivity.</p>
      <label className="composer-import">Import PLC engineering project<input type="file" accept=".json,application/json" onChange={loadLadder}/></label>
      <button onClick={()=>{setProgram(DEMO_WORKCELL_PROGRAM);setProgramLabel('Sample automatic conveyor / diverter ladder');setAcceptance(null);setPlc(initialWorkcellPlcState());setScan(initialScan());}}>Load sample ladder</button>
      <div className="composer-controls">
       <label><input type="checkbox" checked={operator.EStopOK} onChange={e=>setOperator(s=>({...s,EStopOK:e.target.checked}))}/> Simulated E-stop OK</label>
       <label><input type="checkbox" checked={operator.GuardClosed} onChange={e=>setOperator(s=>({...s,GuardClosed:e.target.checked}))}/> Simulated guard closed</label>
       <label><input type="checkbox" checked={operator.AutoEnable} onChange={e=>setOperator(s=>({...s,AutoEnable:e.target.checked}))}/> Auto enable</label>
      </div>
      <h3>Committed PLC coils</h3>
      <div className="composer-signals">{Object.entries(plc.outputs).map(([tag,value])=><div key={tag}><code>{tag}</code><strong>{value?'TRUE':'FALSE'}</strong></div>)}</div>
      <h3>Last rung execution</h3><div className="composer-signals">{plc.trace.map(t=><div key={t.rungId}><code>{t.rungId}</code><strong>{t.result?'ENERGIZED':'OFF'}</strong></div>)}</div>
     </div>}
     <div className="composer-devices">
      {layout.equipment.map(d=>{
       const s=scan.devices[d.id];
       return <div key={d.id} className="composer-device">
        <button onClick={()=>selectedInput(d.id)} aria-pressed={selected===d.id}><b>{d.tag}</b> {d.label}</button>
        {d.kind!=='fence'&&<label><input type="checkbox" checked={materialMode&&controlMode==='ladder'&&(d.kind==='photoeye'||d.kind==='proximity')?materialSensorImage[d.id]===true:commands[d.id]===true} disabled={controlMode==='ladder'&&(materialMode&&(d.kind==='photoeye'||d.kind==='proximity')||d.kind!=='photoeye'&&d.kind!=='proximity'&&d.kind!=='control-panel')} onChange={e=>setCommands(p=>({...p,[d.id]:e.target.checked}))}/> {controlMode==='ladder'?(d.kind==='photoeye'||d.kind==='proximity'||d.kind==='control-panel'?'Field input':'Ladder output (read-only)'):'Command ON'}</label>}
        <span>{s?(s.value*100).toFixed(1)+'%':'0.0%'}</span>
       </div>;
      })}
     </div>
     <div className="actions"><button className="primary" onClick={()=>step(1)}>Scan 100 ms</button><button onClick={()=>step(10)}>Scan 1 s</button><button onClick={()=>{setScan(initialScan());setPlc(initialWorkcellPlcState());setCommands({});setNote('Simulated machine and PLC state reset.');}}>Reset scan</button></div>
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
      {(DYNAMIC_EQUIPMENT_KINDS as readonly string[]).includes(item.kind)&&<fieldset><legend>Simulated actuator / tank dynamics</legend>
       <p className="muted">Tune normalized commanded rise/fill and return/drain times in simulated milliseconds. The vessel additionally depends on pump and valve command/position when installed in the same skid. These are teaching parameters, not measured industrial performance.</p>
       <label>Rise / fill time (ms)<input aria-label="Equipment rise time" type="number" min={100} max={120000} step={100} value={riseDraft||String(item.dynamics?.riseMs??defaultDynamics(item.kind).riseMs)} onChange={e=>setRiseDraft(e.target.value)}/></label>
       <label>Return / drain time (ms)<input aria-label="Equipment return time" type="number" min={100} max={120000} step={100} value={fallDraft||String(item.dynamics?.fallMs??defaultDynamics(item.kind).fallMs)} onChange={e=>setFallDraft(e.target.value)}/></label>
       <button onClick={()=>change(()=>updateEquipment(layout,item.id,{dynamics:{
        riseMs:Number(riseDraft||item.dynamics?.riseMs||defaultDynamics(item.kind).riseMs),
        fallMs:Number(fallDraft||item.dynamics?.fallMs||defaultDynamics(item.kind).fallMs)
       }}),item.id)}>Apply dynamics</button>
      </fieldset>}
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
     <p>{saveStatus}</p>{recoveryAvailable&&<button onClick={restoreBackup}>Restore valid scene backup</button>}<p className="muted">Storage key: <code>{WORKCELL_STORAGE_KEY}</code>. Saved projects contain layout only—not actual machine operation or safety evidence.</p>
     <p role="status" aria-live="polite">{note}</p>
    </div>
   </aside>
  </div>
 </section>;
}
