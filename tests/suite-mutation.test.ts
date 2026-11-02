import {describe,it,expect} from 'vitest';
import {assessSuiteMutations,suiteMutationCsv} from '../src/engineering/suite-mutation';
import type {LadderDocument} from '../src/engineering/ladder';
const program:LadderDocument={id:'mutation-demo',version:'1',rungs:[{id:'run',elements:[{type:'contact',tag:'Start',normallyClosed:false}],coil:'Run'}]};
const cases=[{id:'off',steps:[{scans:1,inputs:{Start:false},expect:{Run:false}}]},{id:'on',steps:[{scans:1,inputs:{Start:true},expect:{Run:true}}]}];
describe('suite mutation campaign',()=>{
 it('detects contact inversion using multiple independent cases',()=>{const r=assessSuiteMutations(program,cases);expect(r.total).toBe(1);expect(r.detected).toBe(1);expect(r.caseContributions).toHaveLength(2);});
 it('rejects suites without independent assertions',()=>expect(()=>assessSuiteMutations(program,[{id:'empty',steps:[{scans:1,inputs:{}}]}])).toThrow(/assertion/));
 it('rejects a scan-work budget below baseline cost',()=>expect(()=>assessSuiteMutations(program,cases,20,1)).toThrow(/budget/));
 it('exports mutant attribution as CSV',()=>expect(suiteMutationCsv(assessSuiteMutations(program,cases))).toContain('detected_by'));
});
