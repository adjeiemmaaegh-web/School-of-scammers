import {Component,useMemo,useState,type ReactNode} from 'react';

export function supportsWebGL():boolean{
 if(typeof document==='undefined')return false;
 try{
  const canvas=document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2')||canvas.getContext('webgl'));
 }catch{return false;}
}
class GraphicsErrorBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){console.error('The optional 3D renderer failed; using the simplified view.',error);}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
/** 3D is optional: controls, PLC logic, and measurement still work without WebGL. */
export function SceneShell({title,summary,children}:{title:string;summary:string;children:ReactNode}){
 const available=useMemo(supportsWebGL,[]);
 const [show3D,setShow3D]=useState(available);
 const fallback=<div className="graphics-fallback" role="status" aria-live="polite">
  <strong>{title} — simplified view</strong>
  <p>{summary}</p>
  <p>3D rendering is unavailable or disabled. The simulated PLC and machine controls remain usable.</p>
 </div>;
 return <div className="scene scene-shell" aria-label={title}>
  {show3D?<GraphicsErrorBoundary fallback={fallback}>{children}</GraphicsErrorBoundary>:fallback}
  <button type="button" className="graphics-toggle" disabled={!available} onClick={()=>setShow3D(v=>!v)}>
   {available?(show3D?'Simplified view':'Show 3D view'):'3D not supported'}
  </button>
 </div>;
}
