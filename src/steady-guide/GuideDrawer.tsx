import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { GUIDE_TOPICS,guideTopicRoute } from './guide-data';
import { GUIDE_TARGETS,guideTarget,type GuideTarget } from './tour-targets';
import './guide-drawer.css';
type Props={onClose:()=>void;activeView:'physical'|'logical'|'plan';activeTool:string;selectedKind?:string};
function visible(el:Element){
 const r=el.getBoundingClientRect(),style=getComputedStyle(el);
 return r.width>0&&r.height>0&&style.display!=='none'&&style.visibility!=='hidden';
}
export function GuideDrawer({onClose,activeView,activeTool,selectedKind}:Props){
 const root=useRef<HTMLElement|null>(null),previous=useRef<HTMLElement|null>(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const [target,setTarget]=useState<GuideTarget['id']|null>(null);
 const [finding,setFinding]=useState('Choose a location below to see it highlighted in the real workbench.');
 useEffect(()=>{
  previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  root.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}};
  document.addEventListener('keydown',key);
  return ()=>{
   document.removeEventListener('keydown',key);
   document.querySelectorAll('[data-steady-spotlight]').forEach(el=>el.removeAttribute('data-steady-spotlight'));
   previous.current?.focus();
  };
 },[]);
 useEffect(()=>{
  document.querySelectorAll('[data-steady-spotlight]').forEach(el=>el.removeAttribute('data-steady-spotlight'));
  if(!target)return;
  const item=guideTarget(target);
  if(!item)return;
  const primary=document.querySelector(item.selector);
  const fallback=item.fallback?document.querySelector(item.fallback):null;
  const el=primary&&visible(primary)?primary:fallback&&visible(fallback)?fallback:null;
  if(!el){setFinding(item.title+' is not visible in this view. '+item.hint);return;}
  el.setAttribute('data-steady-spotlight',item.id);
  el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  setFinding(el===fallback?'Highlighted the control used to reveal '+item.title+'. '+item.hint:'Highlighted '+item.title+' in your workbench. '+item.description);
  return ()=>el.removeAttribute('data-steady-spotlight');
 },[target,activeView,activeTool,selectedKind]);
 const viewText={
  physical:'Physical 3D shows the factory, camera and placement controls. Device placement is not the same as electrical connection.',
  logical:'Logical view shows named terminals and electrical wires. Use this to understand exactly why a component receives power or signals.',
  plan:'Floor Plan is the editable 2D location view. It changes component positions, not their named wiring automatically.'
 }[activeView];
 const active=GUIDE_TOPICS.find(t=>t.id===(activeTool==='wire'?'wire-safely':activeTool==='measure'?'diagnose':'workbench'));
 return <aside className="sg-drawer" role="dialog" aria-modal="false" aria-label="Steady Guide contextual help" tabIndex={-1} ref={root} data-steady-drawer>
  <header><div><small>STEADY GUIDE · CURRENT WORKBENCH</small><h2>Need a hand?</h2></div><button type="button" onClick={onClose} aria-label="Close Steady Guide help">×</button></header>
  <p>{viewText}</p>
  <p className="sg-drawer-mode"><strong>Current tool:</strong> {activeTool}. {activeTool==='run'?'Editing is locked while running. Pause before wiring or placing devices.':'You can follow this guidance without changing your project.'}</p>
  {selectedKind&&<p><strong>Selected equipment:</strong> {selectedKind.replaceAll('-',' ')}. <Link to={'/guide/equipment/'+encodeURIComponent(selectedKind)}>Read its terminals and use cases</Link></p>}
  <h3>Show me where</h3>
  <p className="sg-drawer-intro">Select any area below to highlight it in the workbench. This only points to existing controls; it never clicks them for you.</p>
  <div role="group" aria-label="Choose a workbench area to highlight" className="sg-tour-targets">
   {GUIDE_TARGETS.map((item,i)=><button type="button" key={item.id} onClick={()=>{setTarget(item.id);}} aria-pressed={target===item.id} data-steady-locate={item.id}>
    <span aria-hidden="true">{i+1}</span>{item.title}</button>)}
  </div>
  <p role="status" aria-live="polite" className="sg-tour-status">{finding}</p>
  <h3>Helpful next steps</h3>
  <nav aria-label="Context help destinations">
   <Link to={guideTopicRoute(active?.id||'workbench')}>How to use this tool</Link>
   <Link to="/guide/equipment">Choose equipment</Link>
   <Link to={guideTopicRoute('plc-basics')}>Connect the PLC program</Link>
   <Link to={guideTopicRoute('save-your-work')}>Save and back up your project</Link>
  </nav>
  <p className="sg-drawer-note">The help drawer never runs, pauses, edits, grades or saves your simulation. Save/export your work before navigating away.</p>
  <footer><button type="button" onClick={onClose}>Close help and continue working</button><Link to="/guide">Open the full Steady Guide</Link></footer>
 </aside>;
}
