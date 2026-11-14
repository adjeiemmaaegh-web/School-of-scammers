/**
 * P9 original, searchable factory scene library, telemetry and fault inspector.
 * No hidden pre-wiring, reference-program injection, or synthetic PLC results.
 * The worker alone replaces a project after a user-confirmed request.
 */
import {useMemo,useState} from 'react';
import type {ProjectFile,RenderSnapshot,Command} from '../../sim/signals';
import {SCENES} from '../../plant/scenes/catalogue';
import {sceneFromProject} from '../../plant/scenes/commissioning';
import {SceneCommissioningPanel} from './SceneCommissioningPanel';
import {PLANT_EQUIPMENT} from '../../plant/equipment';
import {SCENE_CATEGORIES,SCENE_METADATA,searchSceneIds,
 type SceneCategory} from '../../plant/scenes/metadata';
import './plant-scene.css';

type Props={project:ProjectFile|null;snapshot:RenderSnapshot|null;editable:boolean;
 onCommands:(commands:Command[])=>void};

export function PlantScenePanel({project,snapshot,editable,onCommands}:Props){
 const parts=project?.components.filter(c=>PLANT_EQUIPMENT[c.kind])??[];
 const readings=snapshot?.plantWorld.signals??{};
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState<SceneCategory|'All'>('All');
 const [pendingId,setPendingId]=useState<string|null>(null);
 const [openedId,setOpenedId]=useState<string|null>(null);
 const activeScene=useMemo(()=>{
  const recognized=sceneFromProject(project);
  if(recognized)return recognized;
  if(!openedId||!project)return;
  const previous=SCENES.find(s=>s.id===openedId);
  // Keep an in-progress diagnostic visible when a learner removes a device;
  // do not associate an unrelated new project with the old scene.
  return previous?.equipment.some(item=>project.components.some(c=>
   c.id===item.id&&c.kind===item.kind))?previous:undefined;
 },[project,openedId]);
 const visible=useMemo(()=>{
  const ids=new Set(searchSceneIds(query,category,SCENES));
  return SCENES.filter(scene=>ids.has(scene.id));
 },[query,category]);
 const startScene=(id:string)=>{
  if(!editable)return;
  if(project?.components.length&&pendingId!==id){setPendingId(id);return;}
  onCommands([{k:'loadPlantScene',id}]);
  setOpenedId(id);
  setPendingId(null);
 };
 return <>
  <details className="sandbox-plant-scenes panel" data-p3-scene-gallery data-p9-scene-gallery>
   <summary>Plant Library · {SCENES.length} original editable learning scenes</summary>
   <p className="sandbox-help">Every scene starts unsolved: equipment and a blank wiring harness only.
    The learner must connect the 24 V supply, wire PLC I/O and author the program.
    All sensing, motion, faults and results come from the simulation worker.
    This is an original training library, not a copy of a vendor's commercial scenes.</p>
   <div className="sandbox-p9-scene-filter">
    <label>Find a factory scene
      <input type="search" data-p9-scene-search value={query}
       placeholder="Try sensing, lift or warehouse"
       onChange={event=>{setQuery(event.target.value);setPendingId(null);}}/>
    </label>
    <label>Focus area
      <select data-p9-scene-category value={category}
       onChange={event=>{setCategory(event.target.value as SceneCategory|'All');setPendingId(null);}}>
       <option value="All">All learning areas</option>
       {SCENE_CATEGORIES.map(v=><option key={v} value={v}>{v}</option>)}
      </select>
    </label>
    <span className="sandbox-help" data-p9-scene-count aria-live="polite">
      {visible.length} of {SCENES.length} original scenes</span>
   </div>
   <div className="sandbox-plant-scene-grid" data-p9-scene-results>
    {visible.map(scene=>{
     const meta=SCENE_METADATA[scene.id];
     return <section key={scene.id} className="sandbox-plant-scene-choice"
       data-p9-scene-card={scene.id} data-p9-scene-category={meta.category}>
      <strong>{scene.title}</strong>
      <span className="sandbox-p9-scene-meta">{meta.category} · {meta.difficulty}</span>
      <p>{scene.description}</p>
      <p className="sandbox-help">Practice: {meta.skills.join(' · ')}</p>
      {pendingId===scene.id&&<p role="status" data-p9-scene-confirm-warning>
       This replaces your current project. Save or export it before confirming.</p>}
      <div className="sandbox-actions">
       <button type="button" className="btn ghost small" disabled={!editable}
         onClick={()=>startScene(scene.id)}
         data-load-plant-scene={scene.id}>
         {pendingId===scene.id?'Confirm replacement':'Create editable scene'}
       </button>
       {pendingId===scene.id&&<button type="button" className="btn ghost small"
         data-p9-scene-cancel onClick={()=>setPendingId(null)}>Cancel</button>}
      </div>
      <details><summary>Learning goal and wiring guidance</summary>
       <p>{scene.acceptance}</p>
       <p>Suggested source → destination: {scene.recommendedLinks.map(link=>
         link.source+' → '+link.target).join(' · ')}</p>
       <pre className="sandbox-plant-st">{scene.referenceST}</pre>
       <p className="sandbox-help">Guidance is for reference only; it never loads a solved PLC program.</p>
      </details>
     </section>;
    })}
    {!visible.length&&<p className="sandbox-help" data-p9-scene-empty>
      No matching scene. Clear the search or choose another area.</p>}
   </div>
  </details>
  {activeScene&&snapshot&&project&&<SceneCommissioningPanel
    key={activeScene.id} scene={activeScene} project={project} snapshot={snapshot}/>}
  {snapshot&&parts.length>0&&<section className="sandbox-p3-world panel" aria-label="Shared plant physics and equipment">
    <div className="sandbox-section-head"><div>
      <span className="eyebrow">P3 · physical world</span><h2>Multi-body plant status</h2>
     </div><span className="status-pill is-idle">5 × 10 ms substeps per PLC scan</span></div>
     <div className="sandbox-sort-metrics">
      <span>Bodies: <strong data-p3-bodies>{snapshot.plantWorld.world.bodies.length}</strong></span>
      <span>Spawned: <strong>{snapshot.plantWorld.world.spawnedCount}</strong></span>
      <span>Exited: <strong>{snapshot.plantWorld.world.despawnedCount}</strong></span>
      <span>World time: <strong>{snapshot.plantWorld.world.timeMs} ms</strong></span>
      <span>Dropped events: <strong>{snapshot.plantWorld.world.droppedEventCount}</strong></span>
     </div>
     <details className="sandbox-p3-body-tracker">
      <summary>Track physical parcels · authoritative worker positions</summary>
      <ul className="sandbox-p3-body-list">
       {snapshot.plantWorld.world.bodies.map(body=><li key={body.id}
         data-p3-body-id={body.id} data-supported-by={body.supportedBy??''}>
         <strong>{body.id}</strong> · {body.supportedBy??'unassigned'} ·
         x {Math.round(body.pos.x)} mm, y {Math.round(body.pos.y)} mm, z {Math.round(body.pos.z)} mm
         {body.tags.jammed===true?' · jammed':''}
        </li>)}
      </ul>
     </details>
     <details><summary>Live sensors, measurements and equipment faults</summary>
      <div className="sandbox-p3-signal-list">
       {parts.map(part=>{
        const def=PLANT_EQUIPMENT[part.kind],signals=readings[part.id]??{};
        return <section key={part.id}>
          <strong>{def.label} · {part.id}</strong>
          <p>{Object.entries(signals).map(([name,value])=>name+' = '+String(value)).join(' · ')||'No output signals'}</p>
          {!!def.faults.length&&<label>Injected fault (paused only)
           <select disabled={!editable} value={project?.plantFaults?.[part.id]??''}
             onChange={event=>onCommands([{k:'setPlantFault',id:part.id,fault:event.target.value||null}])}>
             <option value="">No fault</option>
             {def.faults.map(code=><option key={code} value={code}>{code}</option>)}
           </select>
          </label>}
        </section>;
       })}
      </div>
     </details>
   </section>}
 </>;
}
