import {describe,it,expect} from 'vitest';
import {workcellLadder} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
import {makeSession,parseSession,SESSION_CHECKPOINT_INTERVAL} from '../src/engineering/workcell-session';
const make=(n:number)=>makeSession('Checkpoint drill',workcellLadder,newBoard(),false,Array(n).fill('tick'));
describe('portable replay checkpoint ledger',()=>{
 it('records exact 50-scan boundaries and the final scan',()=>{const s=make(123);expect(s.checkpoints?.map(c=>c.scan)).toEqual([50,100,123]);expect(parseSession(JSON.stringify(s)).final.scan).toBe(123);expect(SESSION_CHECKPOINT_INTERVAL).toBe(50);});
 it('handles empty sessions',()=>{const s=make(0);expect(s.checkpoints).toEqual([]);expect(parseSession(JSON.stringify(s)).final.scan).toBe(0);});
 it('accepts legacy sessions with only a final fingerprint',()=>{const s=make(55);delete s.checkpoints;expect(parseSession(JSON.stringify(s)).final.scan).toBe(55);});
 it('rejects an altered intermediate checkpoint',()=>{const s=make(105);s.checkpoints![0].fingerprint='00000000';expect(()=>parseSession(JSON.stringify(s))).toThrow(/checkpoint mismatch at scan 50/i);});
 it('rejects missing, extra and reordered checkpoints',()=>{const s=make(105);s.checkpoints!.pop();expect(()=>parseSession(JSON.stringify(s))).toThrow(/checkpoint ledger/);const t=make(105);t.checkpoints!.reverse();expect(()=>parseSession(JSON.stringify(t))).toThrow(/checkpoint mismatch/);});
});
