import {describe,it,expect} from 'vitest';
import {minimizeDifferential} from '../src/engineering/differential-minimizer';
const reference={id:'ref',version:'1',rungs:[{id:'r1',elements:[{type:'contact' as const,tag:'Start'}],coil:'Run'}]};
const candidate={id:'new',version:'1',rungs:[{id:'r1',elements:[{type:'contact' as const,tag:'Start',normallyClosed:true}],coil:'Run'}]};
describe('differential counterexample minimizer',()=>{
 it('preserves disagreement and reduces redundant steps and scans',()=>{const result=minimizeDifferential(reference,candidate,[{scans:10,inputs:{Start:false,Unused:true}},{scans:15,inputs:{Start:true}},{scans:5,inputs:{Start:false}}]);expect(result.report.divergences.length).toBeGreaterThan(0);expect(result.steps.length).toBe(1);expect(result.report.scans).toBe(1);expect(result.targetOutput).toBe('Run');});
 it('rejects no-divergence programs',()=>expect(()=>minimizeDifferential(reference,reference,[{scans:1,inputs:{Start:true}}])).toThrow(/No divergence/));
 it('enforces budget',()=>expect(()=>minimizeDifferential(reference,candidate,[{scans:1,inputs:{Start:true}}],20,0)).toThrow(/budget/));
});
