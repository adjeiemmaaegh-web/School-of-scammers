const fs=require('node:fs');const assert=require('node:assert/strict');
const src=fs.readFileSync('src/components/InstructionLab.tsx','utf8');
let checks=0;
function check(ok,msg){assert.ok(ok,msg);checks++;}
check(src.includes('const clearSequenceEvidence=()=>{'),'sequence invalidation exists');
for(const setter of ['setSequenceReport(null)','setMutationReport(null)','setCoverageReport(null)','setContactReport(null)','setIndependenceReport(null)','setDifferentialReport(null)','setSafetyReport(null)','setResponseReport(null)','setFaultReport(null)','setFaultScanTrace(null)','setFaultMatrix(null)','setStabilityReport(null)','setGeneratedVectors(null)'])check(src.split('const clearSequenceEvidence=()=>{')[1].split('};')[0].includes(setter),setter);
check(src.includes('const updateSequenceText=(next:string)=>{clearSequenceEvidence();setSequenceText(next);};'),'sequence changes clear evidence');
check(src.includes('const updateReferenceText=(next:string)=>{setReferenceText(next);setDifferentialReport(null);setSuiteReport(null);};'),'reference changes clear comparisons');
check(src.includes('const updateSuiteText=(next:string)=>{setSuiteText(next);setSuiteReport(null);setSuiteMutationReport(null);setSuiteOptimization(null);};'),'suite changes clear analysis');
check(src.includes('const changeLesson=(id:string)=>{clearProgramEvidence();'),'lesson changes clear analysis');
check(src.includes('setSelectedScan(null);clearProgramEvidence();'),'program changes clear analysis');
check(!src.includes('onChange={e=>setSequenceText('),'no unguarded sequence edits');
check(!src.includes('onChange={e=>setSuiteText('),'no unguarded suite edits');
check(!src.includes('onChange={e=>setReferenceText('),'no unguarded reference edits');
console.log(`PASS: ${checks} source-level evidence freshness checks`);
