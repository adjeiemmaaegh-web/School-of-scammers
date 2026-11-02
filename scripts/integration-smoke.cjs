/** Dependency-free integration checks for the PLC engineering layer. Run after compiling engineering TS to CommonJS. */
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.argv[2];
if(!base)throw Error('Pass compiled engineering directory');
const load=n=>require(path.join(base,n+'.js'));
const {runLadderSequence}=load('ladder-sequences');
const {traceInputFaultScans}=load('input-fault-scan-trace');
const {runFaultMatrix}=load('fault-matrix');
const {checkSafetyInvariants}=load('safety-invariants');
const {runRegressionSuite}=load('regression-suite');
const doc={id:'integration',version:'1',rungs:[
 {id:'instant',elements:[{type:'contact',tag:'Start'}],coil:'Motor'},
 {id:'delayed',elements:[{type:'contact',tag:'Start'}],coil:'Ready',operation:{kind:'ton',presetMs:400}}
]};
const steps=[{scans:1100,inputs:{Start:true},expect:{Motor:true,Ready:true}}];
// Sequence runner limits individual steps to 1000; keep total at 1100 using two steps.
const bounded=[{scans:900,inputs:{Start:true},expect:{Motor:true,Ready:true}},{scans:200,inputs:{},expect:{Motor:true,Ready:true}}];
assert.equal(runLadderSequence(doc,bounded).passed,true);
const trace=traceInputFaultScans(doc,bounded,{tag:'Start',mode:'stuck-off',startScan:1,durationScans:1100},1000);
assert.equal(trace.truncated,true);
assert.deepEqual(new Set(trace.impactWindows.map(x=>x.output)),new Set(['Motor','Ready']));
assert.equal(trace.differentScans,1100);
const matrix=runFaultMatrix(doc,bounded,['Start'],6);
const stuckOff=matrix.cases.find(c=>c.fault.mode==='stuck-off'&&c.fault.durationScans===1100);
assert.deepEqual(stuckOff.affectedOutputs,['Motor','Ready']);
assert.equal(stuckOff.evidenceTruncated,true);
assert.equal(stuckOff.changedScans,1100);
// Baseline and fault campaigns must not mutate source programs or input vectors.
assert.equal(doc.rungs[0].coil,'Motor');
assert.deepEqual(bounded[0].inputs,{Start:true});
console.log('PASS: sequential simulation, bounded evidence, complete impact attribution, fault matrix, immutable inputs (8 checks)');
