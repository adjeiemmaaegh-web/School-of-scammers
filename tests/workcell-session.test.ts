import {describe,it,expect} from 'vitest';
import {workcellLadder,initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
import {makeSession,parseSession,replaySession,sessionFingerprint,MAX_SESSION_ACTIONS} from '../src/engineering/workcell-session';
const actions=['isolate-power','connect-sensor','restore-power','press-start','release-start','tick','press-stop'] as const;
describe('offline workcell session',()=>{
 it('replays the same simulated state',()=>{const board=newBoard();const session=makeSession('Exercise',workcellLadder,board,false,actions);const loaded=parseSession(JSON.stringify(session));expect(sessionFingerprint(loaded.final)).toBe(session.fingerprint);expect(loaded.final.scan).toBe(actions.length);});
 it('does not retain mutable input arrays',()=>{const board=newBoard();const input=['tick'] as ('tick'|'press-start')[];const session=makeSession('Test',workcellLadder,board,false,input);input.push('press-start');expect(session.actions).toEqual(['tick']);});
 it('rejects tampered fingerprint',()=>{const session=makeSession('Test',workcellLadder,newBoard(),false,actions);expect(()=>parseSession(JSON.stringify({...session,fingerprint:'00000000'}))).toThrow(/mismatch/);});
 it('rejects unknown actions',()=>{const session=makeSession('Test',workcellLadder,newBoard(),false,actions);expect(()=>parseSession(JSON.stringify({...session,actions:[{kind:'delete-program'}]}))).toThrow(/action/);});
 it('enforces action limit',()=>{expect(()=>replaySession(workcellLadder,newBoard(),false,Array(MAX_SESSION_ACTIONS+1).fill('tick'))).toThrow(/2000/);});
 it('matches direct workcell execution',()=>{const direct=actions.reduce((s,a)=>stepWorkcell(s,a,20,workcellLadder),initialWorkcell());const replayed=replaySession(workcellLadder,newBoard(),false,actions);expect(sessionFingerprint(replayed)).toBe(sessionFingerprint(direct));});
});
