import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppHeader } from '../ui/AppHeader';
import { COURSE } from '../exercises/course';
import { LESSON_META } from '../exercises/lessons-meta';
import { SCENARIO_META } from '../exercises/meta';
import { GUIDE_GROUPS, GUIDE_TOPICS, getGuideTopic, guideTopicRoute, searchGuideTopics, type GuideTopic } from './guide-data';
import { GUIDE_EQUIPMENT_KINDS, GUIDE_SCENES, GUIDE_GLOSSARY } from './guide-reference';
import { GUIDE_SCREENSHOTS, GUIDE_SCREENSHOT_COMMIT } from './guide-media';
import { emptyGuideProgress, readGuideProgress, saveGuideProgress } from './guide-progress';
import './guide.css';

const Equipment=lazy(()=>import('./GuideEquipment').then(m=>({default:m.GuideEquipment})));
const Scenes=lazy(()=>import('./GuideScenes').then(m=>({default:m.GuideScenes})));
const Builds=lazy(()=>import('./GuideBuilds').then(m=>({default:m.GuideBuilds})));
const GUIDE_LINKS=[
 {label:'Overview',to:'/guide'},
 {label:'Start here',to:'/guide/start'},
 {label:'Your learning paths',to:'/guide/paths'},
 {label:'What should I build?',to:'/guide/builds'},
 {label:'Workbench navigation',to:'/guide/workspace'},
 {label:'Tools & wiring',to:'/guide/tools'},
 {label:'Equipment encyclopedia',to:'/guide/equipment'},
 {label:'Factory scene atlas',to:'/guide/scenes'},
 {label:'PLC programming',to:'/guide/plc'},
 {label:'Save & recover',to:'/guide/projects'},
 {label:'Troubleshooting',to:'/guide/help'},
 {label:'Glossary',to:'/guide/glossary'},
] as const;
const isGuideLink=(target:string,active:string)=>target==='/guide'?active==='/guide':active===target||active.startsWith(target+'/');
function GuideScreenshotGallery(){
 const [active,setActive]=useState(0);
 const shot=GUIDE_SCREENSHOTS[active];
 return <figure className="sg-screenshot" data-steady-screenshot>
  <div className="sg-image-frame"><img src={shot.src} width={shot.width} height={shot.height} loading="lazy" alt={'Unmodified real screenshot of the Simulator engineering workbench, captured at '+shot.viewport+' in the R1 workbench development review.'}/></div>
  <figcaption>Actual application screenshot · {shot.viewport} · R1 source review (not a new mockup). Capture commit {GUIDE_SCREENSHOT_COMMIT.slice(0,8)}; updated-page visual approval is pending.</figcaption>
  <details className="sg-image-key"><summary>Explain the parts shown in this screenshot</summary><ol><li><strong>Top navigation:</strong> this is an older R1 workbench capture that predates the Steady Guide link. Use the current app navigation for Guide, Simulator, Learn &amp; Practice and Assessments.</li><li><strong>Engineering menus:</strong> manage projects, views, simulation, tools and Help.</li><li><strong>Equipment library:</strong> browse or search virtual devices and inspect their labels.</li><li><strong>Workbench canvas:</strong> change between Physical 3D, Logical wiring and Floor Plan.</li><li><strong>Inspector and engineering dock:</strong> see component settings, PLC programs, diagnostics and scan state. Some panels are initially collapsed.</li></ol><Link to="/guide/topic/workbench">Read the full navigation walkthrough</Link></details>
  <div className="sg-screenshot-picker" role="group" aria-label="Choose screenshot viewport">
   {GUIDE_SCREENSHOTS.map((s,i)=><button key={s.id} type="button" aria-pressed={i===active} onClick={()=>setActive(i)}>{s.viewport}</button>)}
  </div>
 </figure>;
}
function TopicList({group,completed}:{group:GuideTopic['group'];completed:readonly string[]}){
 const items=GUIDE_TOPICS.filter(t=>t.group===group);
 return <div className="sg-card-grid">{items.map(t=><Link key={t.id} className="sg-card" to={guideTopicRoute(t.id)} data-steady-topic-card={t.id}>
  <small>{t.minutes} min · {completed.includes(t.id)?'Completed':'Step-by-step'}</small><h3>{t.title}</h3><p>{t.summary}</p><span>Open walkthrough</span></Link>)}</div>;
}
function GuideTopicArticle({topic,completed,onComplete}:{topic:GuideTopic;completed:boolean;onComplete:(id:string)=>void}){
 return <article className="sg-prose" data-steady-topic={topic.id}>
  <p className="sg-eyebrow">{GUIDE_GROUPS.find(g=>g.id===topic.group)?.title} · about {topic.minutes} minutes</p>
  <h2>{topic.title}</h2><p className="sg-lede">{topic.summary}</p>
  {(topic.id==='welcome'||topic.id==='workbench')&&<GuideScreenshotGallery/>}
  <ol className="sg-steps">{topic.steps.map((s,i)=><li key={s.title}>
   <span className="sg-step-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
   <div><h3>{s.title}</h3><p>{s.body}</p>{s.lookFor&&<p className="sg-lookfor"><strong>Look for:</strong> {s.lookFor}</p>}</div>
  </li>)}</ol>
  {topic.id==='first-lamp'&&<p className="sg-warning">Before starting a new empty project, save/export anything already in your simulator. The guide never changes an existing project for you.</p>}
  {topic.id==='diagnose'&&<p className="sg-warning">Graded mystery-fault answers and assessment solutions are intentionally not supplied by this guide.</p>}
  <div className="sg-actions">
   <button type="button" className="sg-button" onClick={()=>onComplete(topic.id)} aria-pressed={completed}>{completed?'Completed ✓':'Mark walkthrough complete'}</button>
   {topic.appRoute&&<Link to={topic.appRoute}>{topic.appLabel||'Open in app'}</Link>}
   {topic.next&&<Link to={guideTopicRoute(topic.next)}>Next: {getGuideTopic(topic.next)?.title}</Link>}
  </div>
  <small className="sg-muted">Completing a guide topic is your own reading progress. It does not mark a simulator lesson or assessment as passed.</small>
 </article>;
}
function GuideHome({completed,lastTopic}:{completed:readonly string[];lastTopic:string|null}){
 return <div data-steady-home>
  <div className="sg-hero">
   <p className="sg-eyebrow">START WITH CONFIDENCE</p><h2>Your map to the virtual factory</h2>
   <p>Steady Guide explains the real tools, machines and workflows already in PLC Skills Lab. Explore at your own pace, then go back to the simulator and try them.</p>
   <div className="sg-actions"><Link className="sg-button" to={guideTopicRoute('welcome')}>Start with the basics</Link><Link to="/guide/equipment">Find equipment</Link>{lastTopic&&<Link to={guideTopicRoute(lastTopic)}>Continue where I left off</Link>}</div>
  </div>
  <div className="sg-choice-grid">
   <Link to={guideTopicRoute('welcome')}><strong>I'm completely new</strong><span>Understand the app, then build your first lamp.</span></Link>
   <Link to="/guide/builds"><strong>I want to build something</strong><span>Choose a goal and get the right equipment list.</span></Link>
   <Link to="/guide/help"><strong>Something isn't working</strong><span>Learn how to investigate a dark lamp or stopped machine.</span></Link>
  </div>
  <section><h3>Your starting route</h3><p>Welcome → My first lamp → Save & recover → PLC basics. Opening a guide does not clear or modify your simulator project.</p>
   <div className="sg-progress" role="status"><span>{completed.length} of {GUIDE_TOPICS.length} walkthroughs completed</span><div aria-hidden="true"><span style={{width:(completed.length/GUIDE_TOPICS.length*100)+'%'}}/></div></div>
   <TopicList group="start" completed={completed}/>
  </section>
  <section><h3>A real view of the workbench</h3><p>The screenshot below comes from the earlier R1 workbench QA set. It is a genuine application capture, not an invented interface.</p><GuideScreenshotGallery/></section>
  <section><h3>Explore the rest of the guide</h3><div className="sg-card-grid">{GUIDE_GROUPS.map(g=><Link key={g.id} className="sg-card" to={g.id==='start'?'/guide/start':g.id==='tools'?'/guide/tools':'/guide/'+g.id}><h3>{g.title}</h3><p>{g.description}</p><span>Explore</span></Link>)}</div></section>
 </div>;
}
function GuidePaths(){
 return <section data-steady-paths><h2>Learn one skill at a time</h2>
  <p>Steady Guide explains navigation and equipment. The existing Learn & Practice lessons provide interactive projects and assess the actual simulator behaviour.</p>
  <div className="sg-card-grid">
   <Link className="sg-card" to={guideTopicRoute('welcome')}><small>Beginner · first</small><h3>1. Find your feet</h3><p>Understand the interface, build a lamp, then save a project.</p><span>Start orientation</span></Link>
   <Link className="sg-card" to="/guide/builds"><small>Choose a goal</small><h3>0. What should I build?</h3><p>Match your first task to equipment and a real exercise.</p><span>Explore projects</span></Link>
   <Link className="sg-card" to={guideTopicRoute('wire-safely')}><small>Wiring · first</small><h3>2. Power and measure</h3><p>Learn terminal naming, I/O mapping and the virtual meter.</p><span>Learn wiring</span></Link>
   <Link className="sg-card" to={guideTopicRoute('plc-basics')}><small>PLC · basic</small><h3>3. Program a controller</h3><p>Choose Ladder, ST or FBD and observe scan outputs.</p><span>PLC basics</span></Link>
   <Link className="sg-card" to={guideTopicRoute('factory-scenes')}><small>Factory · next</small><h3>4. Build a workcell</h3><p>Start from an original scene; connect real plant feedback.</p><span>Browse the factory</span></Link>
   <Link className="sg-card" to={guideTopicRoute('diagnose')}><small>Diagnostics · next</small><h3>5. Investigate a fault</h3><p>Pause, measure, inspect and repair without seeing hidden answers.</p><span>Start troubleshooting</span></Link>
  </div>
  <h3>Existing guided simulator lessons</h3><p>The three authored starter packages belong to Learn & Practice, not to a second guide engine.</p>
  <div className="sg-card-grid">{LESSON_META.map(l=><article className="sg-card" key={l.id}><small>{l.level}</small><h3>{l.title}</h3><p>{l.summary}</p><span><Link to="/learn">Open Learn & Practice</Link> · <a download href={'/lessons/'+l.id+'.efo-scene.json'}>Starter package</a></span></article>)}</div>
  <h3>Real work-order scenarios</h3><div className="sg-card-grid">{SCENARIO_META.map(s=><Link className="sg-card" to={'/scenario/'+s.id} key={s.id}><small>Rank {s.rank} · ~{s.estMinutes} min</small><h3>{s.title}</h3><p>{s.summary}</p><span>Open scenario</span></Link>)}</div>
  <h3>Full learning path</h3><ol className="sg-course">{COURSE.map(c=><li key={c.id}><Link to={c.to}>{c.title}</Link><span>{c.goal}</span><small>{c.gap||'Existing practical activity'}</small></li>)}</ol>
 </section>;
}
function GuideGlossary(){
 return <section data-steady-glossary><h2>Words you'll meet in the simulator</h2><p>Plain-language definitions for educational use. The actual model limits are described in the Inspector.</p><dl className="sg-glossary">{GUIDE_GLOSSARY.map(g=><div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}</dd></div>)}</dl></section>;
}
export function GuidePage(){
 const loc=useLocation(),parts=loc.pathname.split('/').filter(Boolean),area=parts[1]||'',detail=parts[2];
 const ids=useMemo(()=>GUIDE_TOPICS.map(t=>t.id),[]);
 const [progress,setProgress]=useState(()=>readGuideProgress(ids));
 const [search,setSearch]=useState('');
 const [storageWarning,setStorageWarning]=useState(false);
 const searched=search.trim().slice(0,80);
 const resultTopics=searched?searchGuideTopics(searched):[];
 const resultEquipment=searched?GUIDE_EQUIPMENT_KINDS.filter(k=>k.replaceAll('-',' ').includes(searched.toLowerCase())||k.includes(searched.toLowerCase())):[];
 const resultScenes=searched?GUIDE_SCENES.filter(s=>[s.id,s.title,s.description].join(' ').toLowerCase().includes(searched.toLowerCase())):[];
 const resultGlossary=searched?GUIDE_GLOSSARY.filter(g=>[g.term,g.meaning].join(' ').toLowerCase().includes(searched.toLowerCase())):[];
 const done=(id:string)=>{
  const next={completed:progress.completed.includes(id)?progress.completed:[...progress.completed,id],lastTopic:id};
  setProgress(next);setStorageWarning(!saveGuideProgress(next));
 };
 const reset=()=>{const next=emptyGuideProgress();setProgress(next);setStorageWarning(!saveGuideProgress(next));};
 const topic=area==='topic'?getGuideTopic(detail||''):undefined;
 const group:GuideTopic['group']|null=area==='start'?'start':area==='workspace'?'workspace':area==='tools'?'tools':area==='plc'?'plc':area==='projects'?'projects':area==='help'?'help':null;
 return <>
  <AppHeader/>
  <main id="main" className="sg-page wrap wrap-wide" data-steady-guide>
   <div className="sg-top"><Link to="/">Home</Link><span aria-hidden="true">/</span><strong>Steady Guide</strong><span className="sg-status">Offline-friendly · read-only help</span></div>
   <header className="sg-heading"><p className="sg-eyebrow">STEADY GUIDE</p><h1>Learn the application without getting lost.</h1><p>Real screenshots, step-by-step explanations, equipment terminals, factory scenes and practical next steps — all in one place.</p></header>
   <div className="sg-layout">
    <nav className="sg-sidebar" aria-label="Steady Guide sections">{GUIDE_LINKS.map(n=><Link key={n.to} to={n.to} aria-current={isGuideLink(n.to,loc.pathname)?'page':undefined}>{n.label}</Link>)}
     <div className="sg-side-progress"><small>Your guide progress</small><strong>{progress.completed.length} / {GUIDE_TOPICS.length} topics</strong><button type="button" onClick={reset}>Reset guide progress</button></div>
    </nav>
    <div className="sg-content">
     <div className="sg-search"><label htmlFor="sg-guide-search">Search Steady Guide</label><input id="sg-guide-search" value={search} onChange={e=>setSearch(e.target.value)} type="search" placeholder="Try 'PLC', 'sensor', 'save', 'sort', 'P24'…" autoComplete="off"/>
      {searched&&<div className="sg-search-results" role="region" aria-label="Search results">
       <h2>Results for “{searched}”</h2><p role="status">{resultTopics.length+resultEquipment.length+resultScenes.length+resultGlossary.length} matches across topics, equipment, scenes and terms</p>
       {resultTopics.length>0&&<section><h3>Walkthroughs</h3>{resultTopics.map(t=><Link key={t.id} to={guideTopicRoute(t.id)} onClick={()=>setSearch('')}>{t.title}</Link>)}</section>}
       {resultEquipment.length>0&&<section><h3>Equipment</h3>{resultEquipment.map(k=><Link key={k} to={'/guide/equipment/'+k} onClick={()=>setSearch('')}>{k.replaceAll('-',' ')}</Link>)}</section>}
       {resultScenes.length>0&&<section><h3>Scenes</h3>{resultScenes.map(s=><Link key={s.id} to={'/guide/scenes/'+s.id} onClick={()=>setSearch('')}>{s.title}</Link>)}</section>}
       {resultGlossary.length>0&&<section><h3>Concepts</h3>{resultGlossary.map(g=><p key={g.term}><strong>{g.term}:</strong> {g.meaning}</p>)}</section>}
      </div>}
     </div>
     {storageWarning&&<div role="alert" className="sg-warning">Guide progress could not be saved in this browser. Your project data was not changed.</div>}
     {area===''&&<GuideHome completed={progress.completed} lastTopic={progress.lastTopic}/>}
     {group&&<section data-steady-group={group}><h2>{GUIDE_GROUPS.find(g=>g.id===group)?.title}</h2>
       <p>{GUIDE_GROUPS.find(g=>g.id===group)?.description}</p><TopicList group={group} completed={progress.completed}/>
       {area==='workspace'&&<GuideScreenshotGallery/>}
       {area==='tools'&&<p className="sg-note">Shortcuts: V selects, T wires, I measures. Alt+1 shows Logical; Alt+2 Physical 3D; Alt+3 Floor Plan. Exact controls are visible in the running workbench.</p>}
      </section>}
     {area==='topic'&&(topic?<GuideTopicArticle topic={topic} completed={progress.completed.includes(topic.id)} onComplete={done}/>:<section><h2>Topic not found</h2><Link to="/guide">Return to the Guide</Link></section>)}
     {area==='paths'&&<GuidePaths/>}
     {area==='glossary'&&<GuideGlossary/>}
     {area==='builds'&&<Suspense fallback={<p role="status">Loading practical build plans…</p>}><Builds id={detail}/></Suspense>}
     {area==='equipment'&&<Suspense fallback={<p role="status">Loading real equipment reference…</p>}><Equipment kind={detail}/></Suspense>}
     {area==='scenes'&&<Suspense fallback={<p role="status">Loading original factory scene atlas…</p>}><Scenes id={detail}/></Suspense>}
     {!['','start','workspace','tools','plc','projects','help','topic','paths','glossary','equipment','scenes','builds'].includes(area)&&<section><h2>Section not found</h2><Link to="/guide">Return to the Guide</Link></section>}
     <footer className="sg-footer"><Link to="/sandbox">Open the simulator</Link><Link to="/learn">Learn & Practice</Link><span>This is a simplified educational simulator, not certified industrial equipment.</span></footer>
    </div>
   </div>
  </main>
 </>;
}
