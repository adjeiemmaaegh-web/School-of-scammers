import {useState} from 'react';
import {Link} from 'react-router-dom';
import {COMPONENTS} from '../components/registry';
import {GUIDE_BUILDS,findGuideBuild} from './guide-builds-data';
import {guideTopicRoute} from './guide-data';
export function GuideBuilds({id}:{id?:string}){
 const [level,setLevel]=useState('All');
 const plan=id?findGuideBuild(id):undefined;
 if(id&&!plan)return <section><h2>Build plan not found</h2><Link to="/guide/builds">Browse the build plans</Link></section>;
 if(plan)return <article className="sg-prose" data-steady-build={plan.id}>
  <p className="sg-eyebrow">{plan.level} · about {plan.minutes} minutes · hands-on</p>
  <h2>{plan.title}</h2><p className="sg-lede">{plan.goal}</p>
  <div className="sg-warning"><strong>Before you begin:</strong> This plan explains the equipment and workflow. It does not open, clear, wire or program your current simulator project. Save/export existing work before starting a new project or scenario.</div>
  <h3>Equipment you need</h3>
  <div className="sg-card-grid" data-steady-build-parts>{plan.devices.map(kind=><Link className="sg-card" key={kind} to={'/guide/equipment/'+kind}><small>Registered virtual component</small><h3>{COMPONENTS[kind].label}</h3><p>{COMPONENTS[kind].help}</p><span>See exact terminals</span></Link>)}</div>
  {plan.optional&&<><h3>Optional equipment</h3><p>{plan.optional.map((kind,i)=><span key={kind}>{i>0?' · ':''}<Link to={'/guide/equipment/'+kind}>{COMPONENTS[kind].label}</Link></span>)}</p></>}
  <h3>Follow this workflow</h3><ol className="sg-course">{plan.whatToDo.map(step=><li key={step}>{step}</li>)}</ol>
  <div className="sg-note"><strong>What success looks like:</strong> {plan.observableResult}</div>
  <div className="sg-note"><strong>Common mistake:</strong> {plan.commonMistake}</div>
  <div className="sg-actions"><Link className="sg-button" to={plan.practiceRoute}>{plan.practiceLabel}</Link>
   <Link to={guideTopicRoute(plan.topicId)}>Read the related walkthrough</Link>
   {plan.sceneId&&<Link to={'/guide/scenes/'+plan.sceneId}>Scene details</Link>}
   <Link to="/guide/builds">All build plans</Link></div>
  <small className="sg-muted">All equipment and circuit behavior are simplified educational models. Do not apply these connections directly to real machinery.</small>
 </article>;
 const list=GUIDE_BUILDS.filter(p=>level==='All'||p.level===level);
 return <section data-steady-build-index><h2>What should I build?</h2>
  <p>Start with a goal instead of guessing which machine to choose. Each plan identifies supported equipment, the task order, common mistakes and the existing practical exercise when available.</p>
  <div className="sg-filter"><label>Experience level<select aria-label="Choose build difficulty" value={level} onChange={e=>setLevel(e.target.value)}><option value="All">All levels</option><option>Foundation</option><option>Intermediate</option></select></label></div>
  <p role="status">{list.length} hands-on ideas available</p>
  <div className="sg-card-grid">{list.map(p=><Link key={p.id} className="sg-card" to={'/guide/builds/'+p.id}><small>{p.level} · {p.minutes} min</small><h3>{p.title}</h3><p>{p.goal}</p><span>{p.devices.length} core components · See the plan</span></Link>)}</div>
  <p className="sg-note">These are learning plans. They never inject a pre-solved PLC program, activate a machine or reveal a graded mystery fault.</p>
 </section>;
}
