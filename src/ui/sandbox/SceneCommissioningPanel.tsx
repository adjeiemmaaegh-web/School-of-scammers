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
import {advanceSceneTrial,SCENE_TRIALS,trialProgress,
 type TrialEvidence} from '../../plant/scenes/assessment';

type Props={scene:PlantScene;project:ProjectFile;snapshot:RenderSnapshot};
export function SceneCommissioningPanel({scene,project,snapshot}:Props){
 const last=useRef<CommissioningEvidence|null>(null);
 const lastTrial=useRef<TrialEvidence|null>(null);
 const {checks,evidence,trial}=useMemo(()=>{
  const e=accumulateCommissioning(scene,project,snapshot,last.current);
  last.current=e;
  const checks=sceneCommissioningChecks(scene,project,snapshot,e);
  const trial=advanceSceneTrial(scene,project,snapshot,checks,lastTrial.current);
  lastTrial.current=trial;
  return {checks,evidence:e,trial};
 },[scene,project,snapshot]);
 const complete=checks.filter(c=>c.pass).length;
 const progress=trialProgress(scene,trial);
 return <><details className="sandbox-p10-commissioning panel" data-p10-commissioning
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
 </details>
 <details className="sandbox-p11-assessment panel" data-p11-assessment
  data-p11-scene={scene.id} data-p11-state={trial.state}>
  <summary>Practical worker trial · {progress.done}/{progress.total} observed
   <span className="sandbox-help"> · Chronological PLC/plant evidence</span>
  </summary>
  <p className="sandbox-help">Prove these specific factory milestones in order.
   The PLC must be powered, genuinely wired, programmed by the learner and
   free of active forces or injected faults. An observed milestone is a
   learning witness, not proof of a complete industrial process or safety.</p>
  <ol className="sandbox-p10-checks sandbox-p11-goals">
   {SCENE_TRIALS[scene.id].map((goal,index)=>{
    const witness=trial.witnesses[index];
    const done=witness?.id===goal.id;
    return <li key={goal.id} data-p11-trial-goal={goal.id}
      data-p11-trial-state={done?'observed':'pending'}>
     <span aria-label={done?'Observed on worker':'Not yet witnessed'}>
      {done?'✓':index+1}</span>
     <div><strong>{goal.label}</strong>
      <span className="sandbox-p10-stage">{goal.part}.{goal.signal}
       {goal.command?' · PLC CMD_'+goal.command:''}</span>
      <p>{done?('Observed at '+witness.atMs+' ms; worker reported '+
       String(witness.value)):
       index>trial.witnesses.length?'Complete the earlier milestone first':
       'Requires a new worker-observed transition after the previous milestone'}</p>
     </div>
    </li>;
   })}
  </ol>
  <p className="sandbox-help" data-p11-trial-hint role="status">
   {trial.hint}</p>
  <p className="sandbox-help">Witnesses are transient. Scene reset, project
   edits, PLC forcing, faults or loss of electrical preflight clear the trial.
   Validity is limited to the listed simulation observations.</p>
 </details></>;
}
