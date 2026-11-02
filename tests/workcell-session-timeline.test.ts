import {describe,it,expect} from 'vitest';
import {workcellLadder} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
import {replaySession,replaySessionTimeline,sessionFingerprint} from '../src/engineering/workcell-session';

describe('offline replay timeline',()=>{
 it('reconstructs final state and all short-session scans',()=>{const a=['tick','press-start','release-start','tick'] as const;const t=replaySessionTimeline(workcellLadder,newBoard(),false,a);expect(t.history.map(s=>s.scan)).toEqual([1,2,3,4]);expect(t.firstScan).toBe(1);expect(sessionFingerprint(t.final)).toBe(sessionFingerprint(replaySession(workcellLadder,newBoard(),false,a)));});
 it('retains last 200 scans without resetting timer or latch memory',()=>{const a=Array(250).fill('tick') as 'tick'[];const t=replaySessionTimeline(workcellLadder,newBoard(),false,a);expect(t.history.length).toBe(200);expect(t.firstScan).toBe(51);expect(t.history.at(-1)?.scan).toBe(250);expect(sessionFingerprint(t.final)).toBe(sessionFingerprint(replaySession(workcellLadder,newBoard(),false,a)));});
 it('handles empty sessions',()=>{const t=replaySessionTimeline(workcellLadder,newBoard(),false,[]);expect(t.history).toEqual([]);expect(t.firstScan).toBe(0);});
 it('rejects invalid retention limits',()=>{for(const n of [0,201,1.5,NaN])expect(()=>replaySessionTimeline(workcellLadder,newBoard(),false,[],n)).toThrow(/limit/);});
});
