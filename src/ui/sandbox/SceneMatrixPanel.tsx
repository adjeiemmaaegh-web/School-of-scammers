/** P12 offline multi-case test bench: never executes PLC code in React.
 * A dedicated module Worker runs bounded isolated copies of the genuine
 * production simulator, rather than altering the learner's live plant.
 */
import {useEffect,useMemo,useRef,useState} from 'react';
import type {ProjectFile,RenderSnapshot} from '../../sim/signals';
import type {PlantScene} from '../../plant/scenes/catalogue';
import {matrixPreflight,matrixSpecFor,type MatrixResult} from '../../plant/scenes/matrix';
import {projectSignature} from '../../plant/scenes/commissioning';

type Props={scene:PlantScene;project:ProjectFile;snapshot:RenderSnapshot};
type Reply={kind:'matrix-result';id:number;result:MatrixResult}|
 {kind:'matrix-error';id:number;message:string};
export function SceneMatrixPanel({scene,project,snapshot}:Props){
 const spec=matrixSpecFor(scene.id);
 const signature=projectSignature(project);
 const blockers=useMemo(()=>matrixPreflight(project,scene.id),[signature,scene.id]);
 const [pending,setPending]=useState(false);
 const [report,setReport]=useState<MatrixResult|null>(null);
 const [error,setError]=useState<string|null>(null);
 const worker=useRef<Worker|null>(null);
 const nextId=useRef(0);
 useEffect(()=>{
  // A source edit/reset/scene change must NEVER reuse a previous run.
  nextId.current++;
  worker.current?.terminate();
  worker.current=null;
  setPending(false);setReport(null);setError(null);
  return ()=>{
   nextId.current++;worker.current?.terminate();worker.current=null;
  };
 },[signature,scene.id]);
 if(!spec)return null;
 const debug=Object.keys(snapshot.debugForces??{}).length>0||
  Object.values(snapshot.plcs).some(plc=>Object.keys(plc.debugForces??{}).length>0);
 const begin=()=>{
  if(pending||blockers.length||debug||snapshot.lastError)return;
  worker.current?.terminate();
  const runId=++nextId.current;
  const local=new Worker(new URL('../../sim/p12-assessment.worker.ts',import.meta.url),
   {type:'module'});
  worker.current=local;
  setPending(true);setError(null);setReport(null);
  local.onmessage=(event:MessageEvent<Reply>)=>{
   if(event.data?.id!==runId||worker.current!==local)return;
   local.terminate();worker.current=null;
   setPending(false);
   if(event.data.kind==='matrix-error')setError(event.data.message);
   else if(event.data.result.sourceSignature===signature)
    setReport(event.data.result);
   else setError('Project changed before the trial completed; restart the assessment');
  };
  local.onerror=()=>{
   if(worker.current!==local)return;
   local.terminate();worker.current=null;setPending(false);
   setError('The local assessment Worker failed; the learner project was not changed');
  };
  local.postMessage({kind:'run-matrix',id:runId,sceneId:scene.id,project});
 };
 return <details className="sandbox-p12-matrix panel" data-p12-matrix
   data-p12-scene-id={scene.id} data-p12-state={pending?'running':report?.status??'setup'}>
  <summary>Multi-case factory proof · {report?.cases.filter(x=>x.pass).length??0}/4
   <span className="sandbox-help"> · independent PLC challenges</span>
  </summary>
  <p className="sandbox-help">The same learner PLC program must handle four
   independent real-engine challenges: safe idle, demand, release and
   equipment fault with repair. The isolated test bench uses a genuine
   powered 24 V pushbutton to substitute one sensor input, without changing
   your saved project, forcing PLC coils, or running the cases in the UI thread.</p>
  <p className="sandbox-help">This probes only the stated training terminals and
   bounded device behavior; it does not certify safety, external PLCs or all
   possible programs and physical inputs.</p>
  {blockers.length>0&&<div data-p12-preflight>
   <strong>Prepare your training workcell:</strong>
   <ul>{blockers.map(x=><li key={x}>{x}</li>)}</ul>
  </div>}
  {debug&&<p role="status">Clear debug forcing before assessment.</p>}
  {snapshot.lastError&&<p role="status">Resolve the worker error: {snapshot.lastError}</p>}
  <button type="button" className="btn ghost small" data-p12-run-matrix
   disabled={pending||!!blockers.length||debug||!!snapshot.lastError}
   onClick={begin}>{pending?'Running independent worker trials…':'Run four independent PLC challenges'}</button>
  {error&&<p role="alert" data-p12-error>{error}</p>}
  {report&&<div data-p12-matrix-result data-p12-result-state={report.status}>
   <p role="status"><strong>{report.status==='passed'?
    'Four challenge cases passed':'The challenge identified a control problem'}</strong>.
    {' '}{report.diagnostic}</p>
   <ol className="sandbox-p12-matrix-results">
    {report.cases.map(c=><li key={c.id} data-p12-case={c.id}
     data-p12-case-state={c.pass?'pass':'fail'}>
     <strong>{c.pass?'✓':'○'} {c.title}</strong>
     <p>{c.detail} · simulated at {c.atMs} ms</p>
    </li>)}
   </ol>
   <p className="sandbox-help">Isolated scans: {report.executedScans}.
    All test evidence is transient, discarded on edits or reload, and
    intentionally excluded from exported projects.</p>
  </div>}
 </details>;
}
