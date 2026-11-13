/** P12 offline multi-case test bench: never executes PLC code in React.
 * A dedicated module Worker runs bounded isolated copies of the genuine
 * production simulator, rather than altering the learner's live plant.
 */
import {useEffect,useMemo,useRef,useState} from 'react';
import type {ProjectFile,RenderSnapshot} from '../../sim/signals';
import type {PlantScene} from '../../plant/scenes/catalogue';
import {matrixPreflight,matrixSpecFor,type MatrixResult} from '../../plant/scenes/matrix';
import {expandedPreflight,expandedSpecFor,P13_UNSUPPORTED} from '../../plant/scenes/matrix-p13';
import {advancedPreflight,advancedSpecFor} from '../../plant/scenes/matrix-p14';
import type {BatchResult} from '../../plant/scenes/matrix-p15';
import {autonomousSortPreflight,type AutonomousTrial} from '../../plant/scenes/matrix-p15-autonomous';
import {autoFactoryPreflight,type AutoFactoryResult} from '../../plant/scenes/matrix-p15-autonomous-factory';
import {p16AuditPreflight,type P16AuditResult} from '../../plant/scenes/matrix-p16';
import type {P17Campaign} from '../../plant/scenes/matrix-p17';
import {p18Preflight,type P18Result} from '../../plant/scenes/matrix-p18';
import {p19PowerPreflight,type P19Campaign} from '../../plant/scenes/matrix-p19';
import {projectSignature} from '../../plant/scenes/commissioning';

type Props={scene:PlantScene;project:ProjectFile;snapshot:RenderSnapshot};
type Reply={kind:'matrix-result';id:number;result:MatrixResult}|
 {kind:'batch-result';id:number;result:BatchResult}|
 {kind:'autonomous-result';id:number;result:AutonomousTrial|AutoFactoryResult}|
 {kind:'resilience-result';id:number;result:P16AuditResult}|
 {kind:'material-lots-result';id:number;result:P17Campaign}|
 {kind:'jam-recovery-result';id:number;result:P18Result}|
 {kind:'power-recovery-result';id:number;result:P19Campaign}|
 {kind:'matrix-error';id:number;message:string};
export function SceneMatrixPanel({scene,project,snapshot}:Props){
 const spec=matrixSpecFor(scene.id)??expandedSpecFor(scene.id)??advancedSpecFor(scene.id);
 const unsupported=P13_UNSUPPORTED[scene.id];
 const signature=projectSignature(project);
 const powerBlockers=useMemo(()=>scene.id==='bottle-line'?
  p19PowerPreflight(project,scene.id):[],[signature,scene.id]);
 const jamBlockers=useMemo(()=>scene.id==='bottle-line'?
  p18Preflight(project,scene.id):[],[signature,scene.id]);
 const resilienceBlockers=useMemo(()=>advancedSpecFor(scene.id)?
  p16AuditPreflight(project,scene.id):[],[signature,scene.id]);
 const autoBlockers=useMemo(()=>scene.id==='robot-sort'?
  autonomousSortPreflight(project,scene.id):advancedSpecFor(scene.id)?
  autoFactoryPreflight(project,scene.id):[],[signature,scene.id]);
 const blockers=useMemo(()=>matrixSpecFor(scene.id)?
  matrixPreflight(project,scene.id):advancedSpecFor(scene.id)?
  advancedPreflight(project,scene.id):expandedPreflight(project,scene.id),
  [signature,scene.id]);
 const [pending,setPending]=useState(false);
 const [report,setReport]=useState<MatrixResult|null>(null);
 const [batchReport,setBatchReport]=useState<BatchResult|null>(null);
 const [autoReport,setAutoReport]=useState<AutonomousTrial|AutoFactoryResult|null>(null);
 const [resilienceReport,setResilienceReport]=useState<P16AuditResult|null>(null);
 const [materialReport,setMaterialReport]=useState<P17Campaign|null>(null);
 const [jamReport,setJamReport]=useState<P18Result|null>(null);
 const [powerReport,setPowerReport]=useState<P19Campaign|null>(null);
 const [error,setError]=useState<string|null>(null);
 const worker=useRef<Worker|null>(null);
 const nextId=useRef(0);
 useEffect(()=>{
  // A source edit/reset/scene change must NEVER reuse a previous run.
  nextId.current++;
  worker.current?.terminate();
  worker.current=null;
  setPending(false);setReport(null);setBatchReport(null);setAutoReport(null);
  setResilienceReport(null);setMaterialReport(null);setJamReport(null);setPowerReport(null);setError(null);
  return ()=>{
   nextId.current++;worker.current?.terminate();worker.current=null;
  };
 },[signature,scene.id]);
 if(!spec)return unsupported?<details className="sandbox-p12-matrix panel"
  data-p13-unavailable data-p13-scene={scene.id}>
  <summary>Advanced multi-case assessment · Not yet supported</summary>
  <p className="sandbox-help">This original 3D scene remains available for
   engineering practice and P11 single-trace observations, but its
   independent fault/recovery matrix is not yet technically justified.</p>
  <p role="status">{unsupported}</p>
  <p className="sandbox-help">The application will not generate a passing
   score from synthetic bodies, fake PLC coil changes or animation frames.</p>
 </details>:null;
 const debug=Object.keys(snapshot.debugForces??{}).length>0||
  Object.values(snapshot.plcs).some(plc=>Object.keys(plc.debugForces??{}).length>0);
 const begin=(kind:'run-matrix'|'run-batch'|'run-autonomous'|'run-resilience'|'run-material-lots'|'run-jam-recovery'|'run-power-recovery')=>{
  if(pending||blockers.length||debug||snapshot.lastError)return;
  worker.current?.terminate();
  const runId=++nextId.current;
  const local=new Worker(new URL('../../sim/p12-assessment.worker.ts',import.meta.url),
   {type:'module'});
  worker.current=local;
  setPending(true);setError(null);setReport(null);setBatchReport(null);
  setAutoReport(null);setResilienceReport(null);setMaterialReport(null);
  setJamReport(null);setPowerReport(null);
  local.onmessage=(event:MessageEvent<Reply>)=>{
   if(event.data?.id!==runId||worker.current!==local)return;
   local.terminate();worker.current=null;
   setPending(false);
   if(event.data.kind==='matrix-error')setError(event.data.message);
   else if(event.data.result.sourceSignature!==signature)
    setError('Project changed before the trial completed; restart the assessment');
   else if(event.data.kind==='batch-result')setBatchReport(event.data.result);
   else if(event.data.kind==='autonomous-result')setAutoReport(event.data.result);
   else if(event.data.kind==='resilience-result')setResilienceReport(event.data.result);
   else if(event.data.kind==='material-lots-result')setMaterialReport(event.data.result);
   else if(event.data.kind==='jam-recovery-result')setJamReport(event.data.result);
   else if(event.data.kind==='power-recovery-result')setPowerReport(event.data.result);
   else setReport(event.data.result);
  };
  local.onerror=()=>{
   if(worker.current!==local)return;
   local.terminate();worker.current=null;setPending(false);
   setError('The local assessment Worker failed; the learner project was not changed');
  };
  local.postMessage({kind,id:runId,sceneId:scene.id,project});
 };
 return <details className="sandbox-p12-matrix panel" data-p12-matrix
   data-p12-scene-id={scene.id} data-p12-state={pending?'running':report?.status??'setup'}>
  <summary>Multi-case factory proof · {report?.cases.filter(x=>x.pass).length??0}/4
   <span className="sandbox-help"> · independent PLC challenges</span>
  </summary>
  <p className="sandbox-help">The same learner PLC program must handle four
   independent real-engine challenges: safe idle, demand, release and
   equipment fault with repair. In the four advanced workcells, these
   challenges additionally verify genuine physical feeder products,
   body conservation and measured process outcomes. The bench uses a genuine
   powered 24 V pushbutton to drive a PLC test input, replacing the mapped
   sensor signal only in a private test clone when applicable. The worker
   never modifies your saved project, forces PLC coils, or runs on the UI thread.</p>
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
   onClick={()=>begin('run-matrix')}>{pending?'Running independent worker trials…':'Run four independent PLC challenges'}</button>
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
  {advancedSpecFor(scene.id)&&<section className="sandbox-p15-autonomous"
   data-p15-autonomous data-p15-autonomous-state={pending?'running':autoReport?.status??'setup'}>
   <h3>P15 · Autonomous physical production and feedback</h3>
   <p className="sandbox-help">A single 24 V Start pulse must drive your own
    PLC program through original machine feedback for the entire bounded
    production batch. Robot sorting uses a real inductive material signal and
    two physical output lanes. Gantry transfer, pallet pattern and bottle
    filling/capping require worker-observed sensor and process completion.
    A registered machine fault interrupts the second original product and
    must recover without material replacement or fabricated results. The
    private assessment never forces coils or saves a score.</p>
   {autoBlockers.length>0&&<div data-p15-auto-preflight><strong>Prepare your autonomous cell:</strong>
    <ul>{autoBlockers.map(x=><li key={x}>{x}</li>)}</ul></div>}
   <button type="button" className="btn ghost small" data-p15-run-autonomous
    disabled={pending||autoBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-autonomous')}>{pending?'Running physical PLC workcell…':
     'Run autonomous process and fault-recovery trial'}</button>
   {autoReport&&<div data-p15-auto-result>
    <p role="status"><strong>{autoReport.status==='passed'?
     'Autonomous sorting passed':'Autonomous sorting did not pass'}</strong>
     {' '}Actual items: {'sorted' in autoReport?autoReport.sorted:autoReport.completed}/
     {autoReport.produced}.{' '}{'metal' in autoReport?
      'Metal: '+autoReport.metal+', plain: '+autoReport.plain+'.':''}
     {' '}{autoReport.diagnostic}</p>
    <ol>{autoReport.cases.map(c=><li key={c.id} data-p15-auto-case={c.id}
      data-p15-auto-case-state={c.pass?'pass':'fail'}>
      <strong>{c.pass?'✓':'○'} {c.id}</strong> — {c.detail}
     </li>)}</ol>
    <p className="sandbox-help">Simulated time {autoReport.simulatedMs} ms;
     model-only throughput {autoReport.throughputPerSimHour} items/simulated hour.
     This is not a measured industrial throughput rate. Fault repaired:
     {' '}{autoReport.faultRecovered?'yes':'no'}.
     The result is ephemeral, not part of the project.</p>
   </div>}
  </section>}
  {scene.id==='bottle-line'&&<section className="sandbox-p19-power"
   data-p19-power data-p19-state={pending?'running':powerReport?.status??'setup'}>
   <h3>P19 · Power-loss and restart-inhibit campaign</h3>
   <p className="sandbox-help">The same original PLC program must safely
    withstand six independent interruptions: PLC supply-wire loss and
    belt drive-power loss at original bottle 1, 2 and 3. Each genuine
    Worker run verifies physical transport stops, then checks that
    restored power alone cannot restart the belt. A new powered 24 V
    maintenance acknowledgement must cause your own PLC Q0.5 reset.
    The identical workpiece must finish its actual filling and capping.
    A seventh run repeats one case for exact deterministic evidence.</p>
   <p className="sandbox-help">Use the optional machine setting
    restartHoldMode=1, actual belt restartRequired feedback at PLC I1.0
    and resetRestart Q0.5. Existing jam reset Q0.4 remains independent.
    This educational power interlock is <strong>not safety-rated</strong>,
    industrial restart authorization, or real PLC verification.
    No results or temporary fault switches are saved.</p>
   {powerBlockers.length>0&&<div data-p19-preflight>
    <strong>Complete power-restart commissioning first:</strong>
    <ul>{powerBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p19-run-power
    disabled={pending||!!blockers.length||!!powerBlockers.length||
     debug||!!snapshot.lastError}
    onClick={()=>begin('run-power-recovery')}>{pending?
     'Testing actual PLC and belt outages…':
     'Test PLC power loss, drive power loss and controlled restart'}</button>
   {powerReport&&<div data-p19-result data-p19-result-state={powerReport.status}>
    <p role="status"><strong>{powerReport.status==='passed'?
     'P19 power-loss campaign passed':'P19 power-loss campaign did not pass'}</strong>.
     {' '}{powerReport.diagnostic}</p>
    <p className="sandbox-help">Original products completed:
     {' '}{powerReport.completedOriginalProducts}/
     {powerReport.totalOriginalProducts} across six independent runs.
     Product/model-only evidence, not industrial safety certification.</p>
    <ol>{powerReport.episodes.map((ep,i)=><li key={i}
     data-p19-episode={i} data-p19-episode-state={ep.passed?'pass':'fail'}>
      <strong>{ep.passed?'✓':'○'} {ep.kind}</strong>
      {' '}· original bottle {ep.faultAtProduct} · lot {ep.materialSeed}
      {' '}· accepted {ep.completed}/3 ·
      restored supply: {ep.powerRestored?'yes':'no'} ·
      restart inhibited: {ep.restartLatched?'yes':'no'}.
      <details><summary>Physical and PLC evidence</summary>
       <ul>{ep.cases.map(c=><li key={c.id}
        data-p19-case={c.id} data-p19-case-state={c.pass?'pass':'fail'}>
        {c.pass?'✓':'○'} {c.id}: {c.detail}
       </li>)}</ul>
      </details>
     </li>)}</ol>
    <p data-p19-replay={powerReport.deterministicReplay?'pass':'fail'}>
     Exact supply-interruption replay:
     {' '}{powerReport.deterministicReplay?'passed':'failed'}.</p>
   </div>}
  </section>}
  {scene.id==='bottle-line'&&<section className="sandbox-p18-jam"
   data-p18-jam data-p18-state={pending?'running':jamReport?.status??'setup'}>
   <h3>P18 · Conveyor jam service and reset</h3>
   <p className="sandbox-help">Test a genuine latched belt fault on the
    original bottle line. The real PLC must detect the powered jam sensor;
    mechanical repair by itself must NOT restart the stopped cylinder.
    A separate maintenance acknowledgement sends a temporary real 24 V
    button pulse to I0.7. Only your own PLC program may command
    Q0.4 to clear the repaired belt. The same original bottle must then
    resume filling and capping, with all three products conserved.</p>
   <p className="sandbox-help">This bounded educational assessment injects a
    registered simulator fault, not a real-world safety stop. Results and
    temporary buttons stay in the isolated Worker and are never saved.</p>
   {jamBlockers.length>0&&<div data-p18-preflight>
    <strong>Prepare the latched 24 V conveyor reset:</strong>
    <ul>{jamBlockers.map(msg=><li key={msg}>{msg}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p18-run-jam
    disabled={pending||blockers.length>0||jamBlockers.length>0||
     debug||!!snapshot.lastError}
    onClick={()=>begin('run-jam-recovery')}>{pending?
     'Testing physical jam and maintenance acknowledgement…':
     'Test latched belt jam, repair, 24 V reset and bottle recovery'}</button>
   {jamReport&&<div data-p18-result data-p18-result-state={jamReport.status}>
    <p role="status"><strong>{jamReport.status==='passed'?
     'P18 conveyor recovery passed':'P18 conveyor recovery did not pass'}</strong>.
     {' '}{jamReport.diagnostic}</p>
    <ol>{jamReport.cases.map(c=><li key={c.id}
      data-p18-case={c.id} data-p18-case-state={c.pass?'pass':'fail'}>
      <strong>{c.pass?'✓':'○'} {c.id}</strong> — {c.detail}
    </li>)}</ol>
    <p className="sandbox-help">Original bottle
     {' '}{jamReport.jammedBodyId??'not witnessed'};
     {' '}produced {jamReport.produced}, fully completed {jamReport.completed};
     {' '}material order {jamReport.materialSequence};
     {' '}model-only throughput {jamReport.modelThroughputPerHour} items per
     simulated hour. Not calibrated industrial performance.</p>
   </div>}
  </section>}
  {advancedSpecFor(scene.id)&&<section className="sandbox-p17-material-lots"
   data-p17-material-lots data-p17-state={pending?'running':materialReport?.status??'setup'}>
   <h3>P17 · Seeded material lots and physical quality</h3>
   <p className="sandbox-help">Run the same wired PLC program against three
    separate real feeder-generated material lots: seed 1, seed 42, seed
    65535. Each lot tests a different fault position, body-level material
    identity, original physical process completion and real conveyor or
    pallet destination. A fourth run repeats the second lot to verify
    deterministic results. No hidden PLC solution, forced coils or
    invented sensor data are used.</p>
   <p className="sandbox-help">The independently simulated quality yield and
    throughput are teaching metrics, not industrial inspections or
    real production rates. All results stay temporary in a private
    offline Worker and are discarded on project changes.</p>
   {resilienceBlockers.length>0&&<div data-p17-preflight>
    <strong>Wire and configure the original autonomous PLC cell first:</strong>
    <ul>{resilienceBlockers.map(message=><li key={message}>{message}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p17-run-material-lots
    disabled={pending||blockers.length>0||resilienceBlockers.length>0||
     debug||!!snapshot.lastError}
    onClick={()=>begin('run-material-lots')}>{pending?
     'Evaluating physical seeded lots…':
     'Audit three material lots, quality and deterministic replay'}</button>
   {materialReport&&<div data-p17-result data-p17-result-state={materialReport.status}>
    <p role="status"><strong>{materialReport.status==='passed'?
     'Material-lot campaign passed':'Material-lot campaign did not pass'}</strong>.
     {' '}{materialReport.diagnostic}</p>
    <p>Original physical workpieces accepted:
     {' '}{materialReport.acceptedPhysicalProducts}/{materialReport.totalPhysicalProducts};
     {' '}model-only quality yield {materialReport.qualityYieldPercent}%.</p>
    <ol>{materialReport.lots.map(lot=><li key={lot.id}
      data-p17-lot={lot.id} data-p17-lot-state={lot.pass?'pass':'fail'}>
      <strong>{lot.pass?'✓':'○'} {lot.id}</strong>
      {' '}seed {lot.materialSeed}; actual feeder order
      {' '}{lot.materialSequence}; accepted {lot.accepted}/{lot.expected};
      {' '}fault at body {lot.faultAtProduct}; same-body repair:
      {' '}{lot.faultRecovered?'yes':'no'}.
      <details><summary>Original product quality trace</summary>
       <ol>{lot.trace.map(body=><li key={body.bodyId}
        data-p17-body={body.bodyId} data-p17-body-state={body.qualityPassed?'pass':'fail'}>
        {body.bodyId} · {body.material} · {body.shape}
        {' '}· x {body.xMm} mm / y {body.yMm} mm
        {' '}· quality {body.qualityPassed?'verified':'not verified'}
        {' '}· final support {body.supportedBy??'none'}
        {body.receivedBy?' · witnessed receiver '+body.receivedBy:''}
        {body.filledMl!==null?' · fill '+body.filledMl+' mL':''}
        {body.capped?' · capped':''}
        {body.palletSlot!==null?' · pallet slot '+body.palletSlot:''}
       </li>)}</ol>
      </details>
     </li>)}</ol>
    <p data-p17-diversity={materialReport.materialDiversity?'pass':'fail'}>
     Distinct material sequences: {materialReport.materialDiversity?'passed':'failed'}.</p>
    <p data-p17-replay={materialReport.deterministicReplay?'pass':'fail'}>
     Exact lot replay: {materialReport.deterministicReplay?'passed':'failed'}.</p>
    <p className="sandbox-help">Model-only simulated throughput range:
     {' '}{materialReport.minModelThroughputPerHour}–
     {materialReport.maxModelThroughputPerHour} items per simulated hour.
     These do not estimate real machine capacity.</p>
   </div>}
  </section>}
  {advancedSpecFor(scene.id)&&<section className="sandbox-p16-resilience"
   data-p16-resilience
   data-p16-state={pending?'running':resilienceReport?.status??'setup'}>
   <h3>P16 · Factory fault-resilience and deterministic replay</h3>
   <p className="sandbox-help">Audit your own PLC logic across independent
    first, middle and final original-product machine faults. Every trial
    uses real powered input sensors and PLC Q outputs, repairs and resumes
    the <strong>same physically generated item</strong>, then repeats the
    middle case to check deterministic results. Four independent invalid
    controls verify that constant-on/constant-off programs, disconnected
    feedback and lost PLC power cannot earn a passing grade.</p>
   <p className="sandbox-help">This offline CPU-bound assessment runs only in
    a private Worker. It neither modifies source files nor persists test
    fixtures, grades or hardware commands. It is not real-machine safety or
    industrial throughput validation.</p>
   {resilienceBlockers.length>0&&<div data-p16-preflight>
    <strong>Complete physical PLC wiring before the resilience audit:</strong>
    <ul>{resilienceBlockers.map(item=><li key={item}>{item}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p16-run-resilience
    disabled={pending||blockers.length>0||resilienceBlockers.length>0||
     debug||!!snapshot.lastError}
    onClick={()=>begin('run-resilience')}>{pending?'Running independent PLC stress trials…':
     'Audit first/middle/final equipment faults and PLC controls'}</button>
   {resilienceReport&&<div data-p16-result data-p16-result-state={resilienceReport.status}>
    <p role="status"><strong>{resilienceReport.status==='passed'?
     'P16 resilience audit passed':'P16 resilience audit did not pass'}</strong>.
     {' '}{resilienceReport.diagnostic}</p>
    <p className="sandbox-help">Real physical batch size:
     {' '}{resilienceReport.expectedProducts} items. The three fault
     profiles are independent; the replay is a fourth deterministic check.</p>
    <ol>{resilienceReport.profiles.map(item=><li key={item.id}
     data-p16-profile={item.id} data-p16-profile-state={item.passed?'pass':'fail'}>
     <strong>{item.passed?'✓':'○'} {item.id}</strong> — fault at original
     item {item.faultAtProduct}; {item.completed}/{item.expected} physically
     completed; same-body recovery: {item.faultRecovered?'yes':'no'}.
     Simulated duration {item.simulatedMs} ms; {item.diagnostic}
    </li>)}</ol>
    <p data-p16-replay={resilienceReport.deterministicReplay?'pass':'fail'}>
     Deterministic replay: {resilienceReport.deterministicReplay?'passed':'failed'}.</p>
    <h4>Independent negative controls</h4>
    <ul>{resilienceReport.controls.map(item=><li key={item.id}
     data-p16-control={item.id} data-p16-control-state={item.rejected?'pass':'fail'}>
     <strong>{item.rejected?'✓':'○'} {item.id}</strong> — expected
     {' '}{item.expectedStatus}; observed {item.observedStatus}.
    </li>)}</ul>
    <p className="sandbox-help">Median simulated time:
     {' '}{resilienceReport.medianSimulatedMs} ms; slowest
     {' '}{resilienceReport.slowestSimulatedMs} ms; lowest model-only
     throughput {resilienceReport.lowestThroughputPerSimHour} items per
     simulated hour. No real production-performance claim is implied.</p>
   </div>}
  </section>}
  {advancedSpecFor(scene.id)&&<section className="sandbox-p15-batch" data-p15-batch
   data-p15-batch-state={pending?'running':batchReport?.status??'setup'}>
   <h3>P15 · Repeat-production commissioning</h3>
   <p className="sandbox-help">In a separate temporary Worker clone, the same real PLC
    wiring and your exact Ladder/FBD/ST program control three consecutive products
    (eight cartons for the palletizer). The assessor checks stable material IDs,
    physical placement or fill/cap results, conservation and full-pallet refusal.
    This is a bounded externally commanded training cycle, not autonomous sequencing,
    material-classification sorting or industrial safety validation.</p>
   <button type="button" className="btn ghost small" data-p15-run-batch
    disabled={pending||!!blockers.length||debug||!!snapshot.lastError}
    onClick={()=>begin('run-batch')}>{pending?'Running physical trials…':
     'Run repeated material-production trial'}</button>
   {batchReport&&<div data-p15-batch-result>
    <p role="status"><strong>{batchReport.status==='passed'?
     'Repeated production challenge passed':'Repeated production challenge failed'}</strong>
     {' '}{batchReport.verifiedProducts}/{batchReport.expectedProducts} physically
     verified products. {batchReport.diagnostic}</p>
    <ol>{batchReport.cases.map(c=><li key={c.id} data-p15-case={c.id}
      data-p15-case-state={c.pass?'pass':'fail'}>
      <strong>{c.pass?'✓':'○'} {c.id}</strong> — {c.detail}
     </li>)}</ol>
    <p className="sandbox-help">Isolated 50 ms PLC scans: {batchReport.executedScans}.
     This ephemeral result is never written into the learner project.</p>
   </div>}
  </section>}
 </details>;
}
