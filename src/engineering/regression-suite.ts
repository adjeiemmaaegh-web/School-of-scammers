/** Repeatable, bounded PLC regression suite with independent behavioral assertions. */
import {compareLadderPrograms,type DifferentialReport} from './ladder-differential';
import {runLadderSequence,type VectorStep} from './ladder-sequences';
import type {LadderDocument} from './ladder';
export type RegressionCase={id:string;description?:string;steps:VectorStep[];requireEquivalent?:boolean};
export type RegressionCaseResult={id:string;passed:boolean;behaviorPassed:boolean;equivalent:boolean;divergences:number;firstDifference?:{scan:number;tag:string};failedAssertions:string[];scans:number;warnings:string[]};
export type RegressionSuiteReport={passed:boolean;cases:RegressionCaseResult[];totalScans:number;warnings:string[]};
const idPattern=/^[A-Za-z][\w-]{0,63}$/;
export function runRegressionSuite(reference:LadderDocument,candidate:LadderDocument,cases:readonly RegressionCase[],deltaMs=20):RegressionSuiteReport{
 if(!Array.isArray(cases)||cases.length<1||cases.length>20)throw RangeError('Suite must have 1..20 cases');
 const ids=new Set<string>();let totalScans=0;
 const results:RegressionCaseResult[]=[];
 for(const test of cases){
  if(!test||!idPattern.test(test.id)||ids.has(test.id))throw Error('Each case needs a unique valid ID');
  ids.add(test.id);
  if(test.description!==undefined&&(typeof test.description!=='string'||test.description.length>240))throw Error(`${test.id}: invalid description`);
  if(test.requireEquivalent!==undefined&&typeof test.requireEquivalent!=='boolean')throw Error(`${test.id}: invalid equivalence policy`);
  // Compare first, so every test gets the same input validation and scan limits.
  const diff:DifferentialReport=compareLadderPrograms(reference,candidate,test.steps,deltaMs,1);
  totalScans+=diff.scans;
  if(totalScans>50000)throw RangeError('Suite exceeds 50,000 simulated scans');
  const sequence=runLadderSequence(candidate,test.steps,deltaMs);
  const failures=sequence.rows.flatMap(row=>row.failures.map(f=>`Step ${row.step}: ${f}`));
  const equivalent=diff.divergences.length===0;
  const passed=sequence.passed&&(test.requireEquivalent===false||equivalent);
  results.push({id:test.id,passed,behaviorPassed:sequence.passed,equivalent,divergences:diff.divergences.length,firstDifference:diff.divergences[0]&&{scan:diff.divergences[0].scan,tag:diff.divergences[0].tag},failedAssertions:failures,scans:diff.scans,warnings:diff.warnings});
 }
 return {passed:results.every(x=>x.passed),cases:results,totalScans,warnings:['Equivalence checks only compare shared outputs. Independent expected-output assertions are needed to verify intended behavior.']};
}
export function regressionSuiteCsv(report:RegressionSuiteReport):string{
 const q=(v:unknown)=>`"${String(v).replace(/"/g,'""')}"`;
 return [['case','passed','assertions_passed','equivalent','scans','first_difference_scan','first_difference_tag','failed_assertions'],...report.cases.map(c=>[c.id,c.passed,c.behaviorPassed,c.equivalent,c.scans,c.firstDifference?.scan??'',c.firstDifference?.tag??'',c.failedAssertions.join('; ')])].map(row=>row.map(q).join(',')).join('\r\n');
}
export const REGRESSION_SUITE_EXAMPLE:RegressionCase[]=[{id:'start-stop',description:'Start and stop latch with independently reviewed expectations',steps:[{scans:1,inputs:{EStopOK:true,GuardClosed:true,Start:false,Stop:false},expect:{RunLatch:false}},{scans:1,inputs:{Start:true},expect:{RunLatch:true}},{scans:1,inputs:{Start:false},expect:{RunLatch:true}},{scans:1,inputs:{Stop:true},expect:{RunLatch:false}}]}];
