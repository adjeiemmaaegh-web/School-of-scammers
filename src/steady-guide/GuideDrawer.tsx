import { useEffect,useRef } from 'react';
import { Link } from 'react-router-dom';
import { GUIDE_TOPICS,guideTopicRoute } from './guide-data';
import './guide-drawer.css';
type Props={onClose:()=>void;activeView:'physical'|'logical'|'plan';activeTool:string;selectedKind?:string};
export function GuideDrawer({onClose,activeView,activeTool,selectedKind}:Props){
 const root=useRef<HTMLElement|null>(null),previous=useRef<HTMLElement|null>(null);
 // Snapshot updates can rerender the host every scan; do not reset the drawer's focus on every new callback identity.
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  root.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}};
  document.addEventListener('keydown',key);
  return ()=>{document.removeEventListener('keydown',key);previous.current?.focus();};
 },[]);
 const viewText={
  physical:'Physical 3D shows the factory, camera and placement controls. Device placement is not the same as electrical connection.',
  logical:'Logical view shows named terminals and electrical wires. Use this to understand exactly why a component receives power or signals.',
  plan:'Floor Plan is the editable 2D location view. It changes component positions, not their named wiring automatically.'
 }[activeView];
 const active=GUIDE_TOPICS.find(t=>t.id===(activeTool==='wire'?'wire-safely':activeTool==='measure'?'diagnose':'workbench'));
 return <aside className="sg-drawer" role="dialog" aria-modal="false" aria-label="Steady Guide contextual help" tabIndex={-1} ref={root} data-steady-drawer>
  <header><div><small>STEADY GUIDE · CURRENT WORKBENCH</small><h2>Need a hand?</h2></div><button type="button" onClick={onClose} aria-label="Close Steady Guide help">×</button></header>
  <p>{viewText}</p>
  <p className="sg-drawer-mode"><strong>Current tool:</strong> {activeTool}. {activeTool==='run'?'Editing is locked while running. Pause before wiring or placing devices.':'You can follow the relevant guidance without changing this project.'}</p>
  {selectedKind&&<p><strong>Selected equipment:</strong> {selectedKind.replaceAll('-',' ')}. <Link to={'/guide/equipment/'+encodeURIComponent(selectedKind)}>Read its terminals and use cases</Link></p>}
  <h3>Helpful next steps</h3>
  <nav aria-label="Context help destinations">
   <Link to={guideTopicRoute(active?.id||'workbench')}>How to use this tool</Link>
   <Link to="/guide/equipment">Choose equipment</Link>
   <Link to={guideTopicRoute('plc-basics')}>Connect the PLC program</Link>
   <Link to={guideTopicRoute('save-your-work')}>Save and back up your project</Link>
  </nav>
  <p className="sg-drawer-note">The help drawer does not run, pause, edit, grade or save your simulation. Save/export your work before navigating away.</p>
  <footer><button type="button" onClick={onClose}>Close help and continue working</button><Link to="/guide">Open the full Steady Guide</Link></footer>
 </aside>;
}
