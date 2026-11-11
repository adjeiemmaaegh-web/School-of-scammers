/**
 * P10 classroom commissioning checklist. Read-only: never commands the PLC,
 * opens a fault bypass, or awards a certification. All marks come from
 * ProjectFile and the genuine worker RenderSnapshot.
 */
import {useMemo,useRef} from 'react';
import type {ProjectFile,RenderSnapshot} from '../../sim/signals';
import type {PlantScene} from '../../plant/scenes/catalogue';
import {accumulateCommissioning,sceneCommissioningChecks,
 type CommissioningEvidence} from '../../plant/scenes/commissioning';

type Props={scene:PlantScene;project:ProjectFile;snapshot:RenderSnapshot};
export function SceneCommissioningPanel({scene,project,snapshot}:Props){
 const last=useRef<CommissioningEvidence|null>(null);
 const {checks,evidence}=useMemo(()=>{
  const e=accumulateCommissioning(scene,project,snapshot,last.current);
  last.current=e;
  return {checks:sceneCommissioningChecks(scene,project,snapshot,e),evidence:e};
 },[scene,project,snapshot]);
 const complete=checks.filter(c=>c.pass).length;
 return <details className="sandbox-p10-commissioning panel" data-p10-commissioning
    data-p10-scene-id={scene.id}>
  <summary>Commissioning diagnostic · {complete}/{checks.length} checks
    <span className="sandbox-help"> · Real worker evidence, not industrial certification</span>
  </summary>
  <p className="sandbox-help">
   This is a live training diagnostic for <strong>{scene.title}</strong>.
   It checks the actual project and worker results. A changed PLC source or one
   observed movement does not prove the full machine sequence is correct.
  </p>
  <ol className="sandbox-p10-checks">
   {checks.map(check=><li key={check.id} data-p10-check={check.id}
     data-p10-check-state={check.pass?'pass':'pending'}>
     <span aria-label={check.pass?'Observed / ready':'Still needs work'}>
      {check.pass?'✓':'○'}</span>
     <div><strong>{check.label}</strong>
      <span className="sandbox-p10-stage">{check.category==='observed'?'Worker evidence':'Preflight'}</span>
      <p>{check.detail}</p></div>
   </li>)}
  </ol>
  <p className="sandbox-help" data-p10-worker-summary>
   Observed scan updates: {evidence.observedScans}.
   Material movement seen: {evidence.bodyMovement?'yes':'no'}.
   Machine state change seen: {evidence.actuatorMovement?'yes':'no'}.
   Signal transitions recorded: {evidence.observedTransitions.length}.
   Evidence is cleared automatically after a project revision, reset or scene change.
  </p>
 </details>;
}
