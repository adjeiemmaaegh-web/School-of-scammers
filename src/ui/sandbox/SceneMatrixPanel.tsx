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
import {p20ObstructionPreflight,type P20ObstructionResult} from '../../plant/scenes/matrix-p20';
import {p21AccumulationPreflight,type P21Campaign} from '../../plant/scenes/matrix-p21';
import {p22ZonePreflight,type P22Campaign} from '../../plant/scenes/matrix-p22';
import {p23HandoffPreflight,type P23Campaign} from '../../plant/scenes/matrix-p23';
import {p24HoldPreflight,type P24Campaign} from '../../plant/scenes/matrix-p24';
import {projectSignature} from '../../plant/scenes/commissioning';

type Props={scene:PlantScene;project:ProjectFile;snapshot:RenderSnapshot};
type Reply={kind:'matrix-result';id:number;result:MatrixResult}|
 {kind:'batch-result';id:number;result:BatchResult}|
 {kind:'autonomous-result';id:number;result:AutonomousTrial|AutoFactoryResult}|
 {kind:'resilience-result';id:number;result:P16AuditResult}|
 {kind:'material-lots-result';id:number;result:P17Campaign}|
 {kind:'jam-recovery-result';id:number;result:P18Result}|
 {kind:'power-recovery-result';id:number;result:P19Campaign}|
 {kind:'gate-obstruction-result';id:number;result:P20ObstructionResult}|
 {kind:'queue-accumulation-result';id:number;result:P21Campaign}|
 {kind:'zone-backpressure-result';id:number;result:P22Campaign}|
 {kind:'two-belt-handoff-result';id:number;result:P23Campaign}|
 {kind:'outfeed-hold-result';id:number;result:P24Campaign}|
 {kind:'matrix-error';id:number;message:string};
export function SceneMatrixPanel({scene,project,snapshot}:Props){
 const spec=matrixSpecFor(scene.id)??expandedSpecFor(scene.id)??advancedSpecFor(scene.id);
 const unsupported=P13_UNSUPPORTED[scene.id];
 const signature=projectSignature(project);
 const holdBlockers=useMemo(()=>scene.id==='gate-accumulation'?
  p24HoldPreflight(project,scene.id):[],[signature,scene.id]);
 const handoffBlockers=useMemo(()=>scene.id==='gate-accumulation'?
  p23HandoffPreflight(project,scene.id):[],[signature,scene.id]);
 const zoneBlockers=useMemo(()=>scene.id==='gate-accumulation'?
  p22ZonePreflight(project,scene.id):[],[signature,scene.id]);
 const queueBlockers=useMemo(()=>scene.id==='gate-accumulation'?
  p21AccumulationPreflight(project,scene.id):[],[signature,scene.id]);
 const gateBlockers=useMemo(()=>scene.id==='gate-accumulation'?
  p20ObstructionPreflight(project,scene.id):[],[signature,scene.id]);
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
 const [gateReport,setGateReport]=useState<P20ObstructionResult|null>(null);
 const [queueReport,setQueueReport]=useState<P21Campaign|null>(null);
 const [zoneReport,setZoneReport]=useState<P22Campaign|null>(null);
 const [handoffReport,setHandoffReport]=useState<P23Campaign|null>(null);
 const [holdReport,setHoldReport]=useState<P24Campaign|null>(null);
 const [error,setError]=useState<string|null>(null);
 const worker=useRef<Worker|null>(null);
 const nextId=useRef(0);
 useEffect(()=>{
  // A source edit/reset/scene change must NEVER reuse a previous run.
  nextId.current++;
  worker.current?.terminate();
  worker.current=null;
  setPending(false);setReport(null);setBatchReport(null);setAutoReport(null);
  setResilienceReport(null);setMaterialReport(null);setJamReport(null);setPowerReport(null);setGateReport(null);setQueueReport(null);setZoneReport(null);setHandoffReport(null);setHoldReport(null);setError(null);
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
 const begin=(kind:'run-matrix'|'run-batch'|'run-autonomous'|'run-resilience'|'run-material-lots'|'run-jam-recovery'|'run-power-recovery'|'run-gate-obstruction'|'run-queue-accumulation'|'run-zone-backpressure'|'run-two-belt-handoff'|'run-outfeed-hold-release')=>{
  if(pending||(kind==='run-gate-obstruction'?gateBlockers.length:
    kind==='run-queue-accumulation'?queueBlockers.length:
     kind==='run-zone-backpressure'?zoneBlockers.length:
     kind==='run-two-belt-handoff'?handoffBlockers.length:
     kind==='run-outfeed-hold-release'?holdBlockers.length:blockers.length)||
    debug||snapshot.lastError)return;
  worker.current?.terminate();
  const runId=++nextId.current;
  const local=new Worker(new URL('../../sim/p12-assessment.worker.ts',import.meta.url),
   {type:'module'});
  worker.current=local;
  setPending(true);setError(null);setReport(null);setBatchReport(null);
  setAutoReport(null);setResilienceReport(null);setMaterialReport(null);
  setJamReport(null);setPowerReport(null);setGateReport(null);setQueueReport(null);
  setZoneReport(null);setHandoffReport(null);setHoldReport(null);
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
   else if(event.data.kind==='gate-obstruction-result')setGateReport(event.data.result);
   else if(event.data.kind==='queue-accumulation-result')setQueueReport(event.data.result);
   else if(event.data.kind==='zone-backpressure-result')setZoneReport(event.data.result);
   else if(event.data.kind==='two-belt-handoff-result')setHandoffReport(event.data.result);
   else if(event.data.kind==='outfeed-hold-result')setHoldReport(event.data.result);
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
  {scene.id==='gate-accumulation'&&<section className="sandbox-p24-hold"
   data-p24-hold data-p24-state={pending?'running':holdReport?.status??'setup'}>
   <h3>P24 · Real 200ms downstream carton hold, powered release and feeder inhibit</h3>
   <p className="sandbox-help">Continue the original two-belt P23 factory.
    Add real stopper <strong>outstop</strong> at (535,225) on the receiving
    belt: travelMs=100, holdSensorMode=1 and holdDwellMs=200.
    Wire powered PLC Q0.6 to outstop.CMD_extend+, and power the stopper
    and return through the genuine 24V supply. Connect its actual feedback:
    OUT_extended → PLC I0.9, OUT_retracted → PLC I0.10, and original worker
    OUT_heldLoad → PLC I0.11. The private worker supplies a release button
    through powered I0.8, distinct from I0.6 fresh-carton demand.</p>
   <p className="sandbox-help">The same original b2 must enter the independently
    powered receiver, physically stop against the extended outstop for 200ms,
    and make I0.11 HIGH. An early release request cannot clear Q0.6 before
    physical contact. With b2 still held, fresh feeder demand cannot energize
    Q0.0. A new powered release after actual dwell must retract the gate,
    move that same b2 out of the receiver, and only then allow new original
    b3. The native hold detector is off in legacy scenes and is not a
    calibrated force sensor or industrial guarding system.</p>
   {holdBlockers.length>0&&<div data-p24-preflight>
    <strong>Complete original physical outfeed commissioning:</strong>
    <ul>{holdBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p24-run-hold
    disabled={pending||holdBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-outfeed-hold-release')}>{pending?
     'Testing original-body physical stopper dwell and PLC release…':
     'Prove physical outfeed hold, timed contact, PLC release and fresh b3'}</button>
   {holdReport&&<div data-p24-result data-p24-result-state={holdReport.status}>
    <p role="status"><strong>{holdReport.status==='passed'?
     'P24 original-body outfeed interlock passed':
     'P24 original-body outfeed interlock did not pass'}</strong>.
     {' '}{holdReport.diagnostic}</p>
    <p className="sandbox-help">Original feeder cartons:
     {' '}{holdReport.totalOriginals} in three independent seeded lots;
     ephemeral evidence, discarded on edit, never industrial certification.</p>
    <ol>{holdReport.lots.map((lot,i)=><li key={i}
     data-p24-lot={i} data-p24-lot-state={lot.pass?'pass':'fail'}>
     <strong>{lot.pass?'✓':'○'} Lot {lot.seed}</strong>
     {' '}· original held contact {lot.stopContactDwellMs} ms
     {' '}· original bodies {lot.originalIds.join(', ')||'missing'}
     <details><summary>Real stopper and powered PLC evidence</summary>
      <ul>{lot.cases.map(c=><li key={c.id}
       data-p24-case={c.id} data-p24-case-state={c.pass?'pass':'fail'}>
       {c.pass?'✓':'○'} {c.id}: {c.detail}</li>)}</ul>
      <p>{lot.diagnostic}</p>
     </details>
    </li>)}</ol>
    <p data-p24-replay={holdReport.deterministicReplay?'pass':'fail'}>
     Deterministic source-worker replay:
     {' '}{holdReport.deterministicReplay?'passed':'failed'}.</p>
   </div>}
  </section>}
  {scene.id==='gate-accumulation'&&<section className="sandbox-p23-handoff"
   data-p23-handoff data-p23-state={pending?'running':handoffReport?.status??'setup'}>
   <h3>P23 · Original-carton two-belt handoff and downstream backpressure</h3>
   <p className="sandbox-help">Keep P22's powered original feeder, 600×150 mm
    source belt, genuine queue, gate, pusher and I0.5 zone feedback. Place
    a second belt <strong>receiver</strong> at (515,225), aligned with the
    source at (455,225), 600×150 mm and 250 mm/s. Set receiver
    zoneSensorMode=1, zoneCapacity=1. Wire actual 24 V receiver motor
    PLC Q0.5 and receiver.OUT_zoneFull to PLC I0.7. The private offline
    bench supplies genuine powered demand at I0.6.</p>
   <p className="sandbox-help">The original queued b2 must recover, physically
    change its worker-owned carrier to receiver, travel on the independently
    powered Q0.5 destination belt, and energize genuine downstream I0.7.
    A new Q0.0 feeder pulse is forbidden while this real receiver is
    occupied even when the source is empty. After b2 leaves the receiver
    and I0.7 is truly LOW, a fresh demand may create original b3.
    Reference source is test-only. This is training logic, not industrial
    overload or personnel safety protection.</p>
   {handoffBlockers.length>0&&<div data-p23-preflight>
    <strong>Commission the real two-belt 24 V workcell:</strong>
    <ul>{handoffBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p23-run-handoff
    disabled={pending||handoffBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-two-belt-handoff')}>{pending?
     'Testing genuine powered two-belt receiver and feeder…':
     'Prove original handoff, downstream inhibit and fresh b3 release'}</button>
   {handoffReport&&<div data-p23-result data-p23-result-state={handoffReport.status}>
    <p role="status"><strong>{handoffReport.status==='passed'?
     'P23 physical downstream interlock passed':
     'P23 physical downstream interlock did not pass'}</strong>.
     {' '}{handoffReport.diagnostic}</p>
    <p className="sandbox-help">Original feeder-generated cartons:
     {' '}{handoffReport.totalOriginals} in three seeded lots; never
     saved, never certification, invalidated when the learner edits source.</p>
    <ol>{handoffReport.lots.map((lot,i)=><li key={i}
     data-p23-lot={i} data-p23-lot-state={lot.pass?'pass':'fail'}>
     <strong>{lot.pass?'✓':'○'} Lot {lot.seed}</strong>
     {' '}· receiver motion {lot.receiverMotionMm.toFixed(1)} mm
     {' '}· bodies {lot.originalIds.join(', ')||'missing'}
     <details><summary>Original-body and actual 24V PLC signals</summary>
      <ul>{lot.cases.map(c=><li key={c.id}
       data-p23-case={c.id} data-p23-case-state={c.pass?'pass':'fail'}>
       {c.pass?'✓':'○'} {c.id}: {c.detail}</li>)}</ul>
      <p>{lot.diagnostic}</p>
     </details>
    </li>)}</ol>
    <p data-p23-replay={handoffReport.deterministicReplay?'pass':'fail'}>
     Exact seed replay: {handoffReport.deterministicReplay?'passed':'failed'}.</p>
   </div>}
  </section>}
  {scene.id==='gate-accumulation'&&<section className="sandbox-p22-zone"
   data-p22-zone data-p22-state={pending?'running':zoneReport?.status??'setup'}>
   <h3>P22 · Real belt occupancy, PLC feeder inhibit and third-carton release</h3>
   <p className="sandbox-help">Enable original belt zoneSensorMode=1 and
    zoneCapacity=2. Original worker-owned zoneCount, zoneOccupied and zoneFull
    reflect conserved cartons physically supported within this conveyor,
    not PLC counters, rendered meshes or assumed feeder pulses.
    Wire belt.OUT_zoneFull to genuine PLC I0.5. The private offline worker
    supplies a temporary 24 V third-carton request at I0.6.</p>
   <p className="sandbox-help">Your own PLC must inhibit Q0.0 upon the
    third-carton request when two real cartons occupy the source lane,
    BEFORE P21's timed accumulation stop. Then physically retract the gate,
    divert original b1 with the powered pusher, wait for a fresh reset and
    recover original b2 before supplying a NEW requested b3. This is
    limited educational occupancy telemetry, not certified machine guarding.</p>
   {zoneBlockers.length>0&&<div data-p22-preflight>
    <strong>Prepare the original source lane and 24 V I/O:</strong>
    <ul>{zoneBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p22-run-zone
    disabled={pending||zoneBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-zone-backpressure')}>{pending?
     'Testing genuine PLC feed inhibition and physical originals…':
     'Prove zone-full feeder inhibit, original recovery and b3 release'}</button>
   {zoneReport&&<div data-p22-result data-p22-result-state={zoneReport.status}>
    <p role="status"><strong>{zoneReport.status==='passed'?
     'P22 physical backpressure control passed':
     'P22 physical backpressure control did not pass'}</strong>.
     {' '}{zoneReport.diagnostic}</p>
    <p className="sandbox-help">Original feeder-generated cartons:
     {' '}{zoneReport.totalOriginals} in three independent material lots;
     source-only evidence, invalidated on edit, never saved as a certificate.</p>
    <ol>{zoneReport.lots.map((lot,i)=><li key={i}
     data-p22-lot={i} data-p22-lot-state={lot.pass?'pass':'fail'}>
     <strong>{lot.pass?'✓':'○'} Lot {lot.seed}</strong>
     {' '}· pre-trip count {lot.initialZoneCount}
     {' '}· original IDs {lot.originalIds.join(', ')||'missing'}
     <details><summary>Original-body / powered PLC checks</summary>
      <ul>{lot.cases.map(c=><li key={c.id}
       data-p22-case={c.id} data-p22-case-state={c.pass?'pass':'fail'}>
       {c.pass?'✓':'○'} {c.id}: {c.detail}</li>)}</ul>
      <p>{lot.diagnostic}</p>
     </details>
    </li>)}</ol>
    <p data-p22-replay={zoneReport.deterministicReplay?'pass':'fail'}>
     Exact seed replay: {zoneReport.deterministicReplay?'passed':'failed'}.</p>
   </div>}
  </section>}
  {scene.id==='gate-accumulation'&&<section className="sandbox-p21-queue"
   data-p21-queue data-p21-state={pending?'running':queueReport?.status??'setup'}>
   <h3>P21 · Sustained physical carton queue and overload recovery</h3>
   <p className="sandbox-help">Commission two genuine original feeder cartons.
    The front carton is physically held at the extended stopper; the
    second must collide with the FIRST carton for at least 200 ms of
    continuous worker-owned contact. Only then may the belt report
    <strong> accumulationTripped</strong> and stop. Your PLC must release
    the original stopper, activate a REAL pusher to divert the leading
    carton off the belt, then respond to a fresh powered operator reset.
    The same trailing carton must travel beyond the gate. No assessment
    body or PLC coil is faked, and no scores are stored.</p>
   <p className="sandbox-help">Use accumulationTripMode=1,
    accumulationDwellMs=200, jamResetMode=1, obstructionTripMode=0 and a
    600 × 150 mm belt. Place original feeder at (430,225), stopper
    at (481,225), and pusher at (479,225). Wire actual 24V PLC
    Q0.0 feeder feed, Q0.1 belt run, Q0.2 stopper extend, Q0.3
    resetJam, Q0.4 pusher extend. Connect belt accumulationTripped
    to I0.1, stopper retracted to I0.2 and pusher extended to I0.3.
    The isolated Worker provides temporary powered Start at I0.0
    and maintenance acknowledgement at I0.4. This is not a
    safety-rated or real industrial overload detector.</p>
   {queueBlockers.length>0&&<div data-p21-preflight>
    <strong>Complete true two-carton machine commissioning:</strong>
    <ul>{queueBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p21-run-queue
    disabled={pending||queueBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-queue-accumulation')}>{pending?
     'Checking two real cartons, contact dwell, pusher and PLC…':
     'Prove physical queue overload, true pusher clearance and PLC reset'}</button>
   {queueReport&&<div data-p21-result data-p21-result-state={queueReport.status}>
    <p role="status"><strong>{queueReport.status==='passed'?
     'P21 original-body accumulation passed':
     'P21 original-body accumulation did not pass'}</strong>.
     {' '}{queueReport.diagnostic}</p>
    <p className="sandbox-help">Original physical cartons:
     {' '}{queueReport.originalBodies}; received:
     {' '}{queueReport.receivedBodies}; diverted by real pusher:
     {' '}{queueReport.divertedBodies}.
     Model-only evidence; no actual industrial force or machine safety claim.</p>
    <ol>{queueReport.lots.map((lot,i)=><li key={i}
     data-p21-lot={i} data-p21-lot-state={lot.pass?'pass':'fail'}>
     <strong>{lot.pass?'✓':'○'} Lot {lot.seed}</strong>
     {' '}· leader {lot.leaderId??'missing'} ({lot.leaderMaterial})
     {' '}· queued {lot.queuedBodyId??'missing'} ({lot.queuedMaterial})
     {' '}· physical dwell {lot.contactDwellMs} ms
     <details><summary>Original body and powered PLC evidence</summary>
      <ul>{lot.cases.map(g=><li key={g.id}
       data-p21-case={g.id} data-p21-case-state={g.pass?'pass':'fail'}>
       {g.pass?'✓':'○'} {g.id}: {g.detail}
      </li>)}</ul>
     </details>
    </li>)}</ol>
    <p data-p21-replay={queueReport.deterministicReplay?'pass':'fail'}>
     Exact original-worker lot replay:
     {' '}{queueReport.deterministicReplay?'passed':'failed'}.</p>
   </div>}
  </section>}
  {scene.id==='gate-accumulation'&&<section className="sandbox-p20-obstruction"
   data-p20-obstruction data-p20-state={pending?'running':gateReport?.status??'setup'}>
   <h3>P20 · Actual gate obstruction and PLC recovery</h3>
   <p className="sandbox-help">Unlike instructor-injected equipment faults,
    this trial waits for a genuine carton to physically collide with
    your PLC-controlled extended stopper. Only actual worker-owned body
    contact can trip the source belt and assert obstructionTripped.
    A passing program must retract the real stopper, keep the belt
    stopped until an independent 24 V operator acknowledgement,
    then command a fresh Q0.3 resetJam edge. The same original carton
    must travel past the gate with no duplicate or replacement.</p>
   <p className="sandbox-help">Set belt obstructionTripMode=1 and
    jamResetMode=1. Move the original feeder into the belt's pickup zone,
    wire its pulse feed and run coils plus the stopper control, and connect
    belt OUT_obstructionTripped to PLC I0.1 and stopper OUT_retracted to
    I0.2. The private worker uses I0.0 for Start and I0.3 for operator
    acknowledgement. This is an educational physical model,
    <strong> not a certified safety stop</strong>.</p>
   {gateBlockers.length>0&&<div data-p20-preflight>
    <strong>Prepare the original gate workcell:</strong>
    <ul>{gateBlockers.map(x=><li key={x}>{x}</li>)}</ul>
   </div>}
   <button type="button" className="btn ghost small" data-p20-run-obstruction
    disabled={pending||gateBlockers.length>0||debug||!!snapshot.lastError}
    onClick={()=>begin('run-gate-obstruction')}>{pending?
     'Checking real collision and powered gate release…':
     'Prove physical gate collision, release and PLC reset'}</button>
   {gateReport&&<div data-p20-result data-p20-result-state={gateReport.status}>
    <p role="status"><strong>{gateReport.status==='passed'?
     'P20 physical gate drill passed':'P20 physical gate drill did not pass'}</strong>.
     {' '}{gateReport.diagnostic}</p>
    <p className="sandbox-help">Original products recovered:
     {' '}{gateReport.recoveredProducts}/{gateReport.originalProducts}
     across three seeded private real-worker lots. All scores are
     discarded on project changes; no production-grade safety claim.</p>
    <ol>{gateReport.lots.map((lot,i)=><li key={i}
      data-p20-lot={i} data-p20-lot-state={lot.pass?'pass':'fail'}>
      <strong>{lot.pass?'✓':'○'} Feeder lot {lot.seed}</strong>
      {' '}· original {lot.bodyId??'missing'} · {lot.material}
      {' '}· contact x {lot.contactXmm??'n/a'} mm
      {' '}· outbound x {lot.finalXmm??'n/a'} mm
      <details><summary>Real machine and PLC evidence</summary>
       <ul>{lot.cases.map(g=><li key={g.id}
        data-p20-case={g.id} data-p20-case-state={g.pass?'pass':'fail'}>
        {g.pass?'✓':'○'} {g.id}: {g.detail}
       </li>)}</ul>
      </details>
     </li>)}</ol>
    <p data-p20-replay={gateReport.deterministicReplay?'pass':'fail'}>
     Exact independent feeder/PLC replay:
     {' '}{gateReport.deterministicReplay?'passed':'failed'}.</p>
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
