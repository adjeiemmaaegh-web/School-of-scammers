import {describe,it,expect} from 'vitest';
import {runRegressionSuite,regressionSuiteCsv} from '../src/engineering/regression-suite';
import type {LadderDocument} from '../src/engineering/ladder';
const base:LadderDocument={id:'base',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'Start'}],coil:'Run'}]};
const inverse:LadderDocument={...base,rungs:[{id:'r1',elements:[{type:'contact',tag:'Start',normallyClosed:true}],coil:'Run'}]};
const test={id:'start',steps:[{scans:1,inputs:{Start:true},expect:{Run:true}}]};
describe('PLC regression suite',()=>{
 it('passes matching implementation and independent assertion',()=>{const r=runRegressionSuite(base,base,[test]);expect(r.passed).toBe(true);expect(r.totalScans).toBe(1);});
 it('detects reference divergence',()=>{const r=runRegressionSuite(inverse,base,[test]);expect(r.passed).toBe(false);expect(r.cases[0].firstDifference?.tag).toBe('Run');});
 it('can explicitly allow intentional differences',()=>{const r=runRegressionSuite(inverse,base,[{...test,requireEquivalent:false}]);expect(r.passed).toBe(true);expect(r.cases[0].equivalent).toBe(false);});
 it('fails independently specified behavior',()=>{const r=runRegressionSuite(base,base,[{id:'bad',steps:[{scans:1,inputs:{Start:true},expect:{Run:false}}]}]);expect(r.cases[0].behaviorPassed).toBe(false);});
 it('rejects duplicate IDs and invalid policy',()=>{expect(()=>runRegressionSuite(base,base,[test,test])).toThrow();expect(()=>runRegressionSuite(base,base,[{...test,requireEquivalent:'no' as never}])).toThrow();});
 it('exports escaped CSV',()=>{expect(regressionSuiteCsv(runRegressionSuite(base,base,[test]))).toContain('"start"');});
});
