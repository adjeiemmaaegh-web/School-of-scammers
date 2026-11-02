import {describe,it,expect} from 'vitest';
import {analyzeSession,sessionAnalysisCsv} from '../src/engineering/session-analysis';
import {workcellLadder} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
describe('session analysis',()=>{
 it('handles empty recording',()=>{const r=analyzeSession(workcellLadder,newBoard(),false,[]);expect(r.actions).toBe(0);expect(r.transitions).toHaveLength(0);});
 it('counts all actions even with capped evidence',()=>{const actions=Array.from({length:40},(_,i)=>i%2?'restore-power':'isolate-power') as ('restore-power'|'isolate-power')[];const r=analyzeSession(workcellLadder,newBoard(),false,actions,2);expect(r.actions).toBe(40);expect(r.transitions.length).toBe(2);expect(r.truncated).toBe(true);});
 it('does not truncate full output metrics',()=>{const a=['restore-power','press-start','release-start','tick'] as const;const x=analyzeSession(workcellLadder,newBoard(),false,a,1);const y=analyzeSession(workcellLadder,newBoard(),false,a,300);expect(x.outputTransitions).toBe(y.outputTransitions);expect(x.motorOnScans).toBe(y.motorOnScans);});
 it('rejects invalid evidence cap',()=>expect(()=>analyzeSession(workcellLadder,newBoard(),false,[],0)).toThrow());
 it('exports CSV with header',()=>expect(sessionAnalysisCsv(analyzeSession(workcellLadder,newBoard(),false,['tick']))).toContain('action_index,scan,time_ms'));
});
