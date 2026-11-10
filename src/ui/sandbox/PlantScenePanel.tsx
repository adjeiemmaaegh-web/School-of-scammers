/**
 * P3 original scene gallery, telemetry and fault inspector.
 * The page sends commands; the worker validates/executes them.
 * No hidden pre-wiring or auto-solved PLC program.
 */
import type {ProjectFile,RenderSnapshot,Command} from '../../sim/signals';
import {SCENES} from '../../plant/scenes/catalogue';
import {PLANT_EQUIPMENT} from '../../plant/equipment';
import './plant-scene.css';

type Props={project:ProjectFile|null;snapshot:RenderSnapshot|null;editable:boolean;
 onCommands:(commands:Command[])=>void};

export function PlantScenePanel({project,snapshot,editable,onCommands}:Props){
 const parts=project?.components.filter(c=>PLANT_EQUIPMENT[c.kind])??[];
 const readings=snapshot?.plantWorld.signals??{};
 return <>
  <details className="sandbox-plant-scenes panel" data-p3-scene-gallery>
   <summary>Plant Library · 10 editable industrial learning scenes</summary>
   <p className="sandbox-help">Original unsolved layouts. Place and wire your PLC, sensors and actuators, then write your own logic. Opening a scene replaces the current project; export your work first.</p>
   <div className="sandbox-plant-scene-grid">
    {SCENES.map(scene=><section key={scene.id} className="sandbox-plant-scene-choice">
     <strong>{scene.title}</strong><p>{scene.description}</p>
     <button type="button" className="btn ghost small" disabled={!editable}
       onClick={()=>onCommands([{k:'loadPlantScene',id:scene.id}])}
       data-load-plant-scene={scene.id}>Create editable scene</button>
     <details><summary>Suggested wiring and PLC reasoning</summary>
      <p>{scene.acceptance}</p>
      <p>Suggested source → destination: {scene.recommendedLinks.map(link=>
        link.source+' → '+link.target).join(' · ')}</p>
      <pre className="sandbox-plant-st">{scene.referenceST}</pre>
     </details>
    </section>)}
   </div>
  </details>
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
