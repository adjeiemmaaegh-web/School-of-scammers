import {describe,it,expect} from 'vitest';
import {analyzeSession,sessionHazardsCsv} from '../src/engineering/session-analysis';
import {workcellLadder} from '../src/engineering/workcell';
import {newBoard} from '../src/engineering/wiring-board';
const analyze=(actions:Parameters<typeof analyzeSession>[3],limit=300)=>analyzeSession(workcellLadder,newBoard(),false,actions,limit);
describe('session safety indicator review',()=>{
 it('reports no hazards for an empty session',()=>{const r=analyze([]);expect(r.hazards).toEqual([]);expect(Object.values(r.hazardScans)).toEqual([0,0,0]);});
 it('retains consistent hazard counts across evidence limits',()=>{const actions=['restore-power','press-start','release-start',...Array(30).fill('tick')] as Parameters<typeof analyzeSession>[3];const a=analyze(actions,1),b=analyze(actions,300);expect(a.hazardScans).toEqual(b.hazardScans);expect(a.hazardEpisodes).toEqual(b.hazardEpisodes);});
 it('rejects invalid evidence caps',()=>expect(()=>analyze([],2001)).toThrow());
 it('exports a standalone hazard CSV',()=>expect(sessionHazardsCsv(analyze([]))).toBe('scan,action_index,hazard,trigger_action\r\n'));
 it('never reports more hazard onset rows than the cap',()=>{const r=analyze(Array(100).fill('tick'),1);expect(r.hazards.length).toBeLessThanOrEqual(1);});
});
