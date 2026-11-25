import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SCENE_CATEGORIES, type SceneCategory } from '../plant/scenes/metadata';
import { GUIDE_SCENES, GUIDE_SCENE_META, findGuideScene } from './guide-reference';
export function GuideScenes({id}:{id?:string}){
 const [query,setQuery]=useState('');
 const [cat,setCat]=useState<'All'|SceneCategory>('All');
 const scene=id?findGuideScene(id):undefined,meta=scene?GUIDE_SCENE_META[scene.id]:undefined;
 if(id&&!scene)return <section><h2>Scene not found</h2><Link to="/guide/scenes">Browse the scene atlas</Link></section>;
 if(scene&&meta)return <article className="sg-prose" data-steady-scene-detail={scene.id}>
  <p className="sg-eyebrow">{meta.category} · {meta.difficulty}</p><h2>{scene.title}</h2><p className="sg-lede">{scene.description}</p>
  <h3>What you will practice</h3><ul>{meta.skills.map(s=><li key={s}>{s}</li>)}</ul>
  <h3>Using the real simulator</h3><ol>
   <li>Export or save the current project before opening a different scene.</li>
   <li>Open the Simulator. Find its factory scene gallery, then locate <strong>{scene.title}</strong>.</li>
   <li>Inspect the equipment, supported signal names, wiring and PLC program. The scene is a starting arrangement, not a guarantee of a correctly wired/working factory.</li>
   <li>Run and observe actual sensor, PLC and material behavior. Change one wiring/program condition and check the resulting difference.</li>
  </ol>
  <div className="sg-note">Steady Guide does not install a scene, change the current project or expose reference-controller solutions. The gallery belongs to the Simulator.</div>
  <p className="sg-actions"><Link className="sg-button" to="/sandbox">Open simulator</Link><Link to="/guide/scenes">All scenes</Link><Link to="/guide/topic/factory-scenes">How factory scenes work</Link></p>
 </article>;
 const list=GUIDE_SCENES.filter(s=>(cat==='All'||GUIDE_SCENE_META[s.id]?.category===cat)&&[s.title,s.description,s.id,...(GUIDE_SCENE_META[s.id]?.skills||[])].join(' ').toLowerCase().includes(query.trim().toLowerCase().slice(0,80)));
 return <section data-steady-scene-index>
  <h2>Factory scene atlas</h2><p>These 21 original arrangements cover sensors, conveyors, robotics, material handling and process control. Start with a Foundation scene.</p>
  <div className="sg-filter"><label>Search scenes<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Sorting, robot, tank…"/></label>
   <label>Category<select value={cat} onChange={e=>setCat(e.target.value as 'All'|SceneCategory)}><option>All</option>{SCENE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
  <p role="status">{list.length} scenes shown</p>
  <div className="sg-card-grid">{list.map(s=><Link to={'/guide/scenes/'+encodeURIComponent(s.id)} className="sg-card" key={s.id}><small>{GUIDE_SCENE_META[s.id].category} · {GUIDE_SCENE_META[s.id].difficulty}</small><h3>{s.title}</h3><p>{s.description}</p><span>{GUIDE_SCENE_META[s.id].skills.join(' · ')}</span></Link>)}</div>
 </section>;
}
